from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import os
import shutil
import re
import json
import logging
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to load local .env file if it exists (for local development)
env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

app = FastAPI(title="Meeting Transcription App")


# =========================================================================
# FUTURE PRODUCTION SCALABILITY NOTE:
# Currently, this application uses a stateless backend architecture with
# client-side persistence (localStorage) to store meetings and action items.
# For production scale, a database layer (e.g., MongoDB/Document Store for 
# transcripts/chats or PostgreSQL for relational action items) should be
# integrated here using ORM like SQLAlchemy or motor client.
# APIs are designed to be easily extensible to fetch from/save to a DB.
# =========================================================================

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ChatRequest(BaseModel):
    transcript: str
    message: str


class ActionItemRequest(BaseModel):
    transcript: str


class OwnerDeadlineRequest(BaseModel):
    transcript: str


class DecisionRequest(BaseModel):
    transcript: str


def extract_json_array(raw_text: str):
    """
    Robustly pull a JSON array out of an LLM response, stripping markdown
    fences or any stray preamble/postamble text the model might add.
    """
    if not raw_text:
        return []

    text = raw_text.strip()

    # Strip ```json ... ``` or ``` ... ``` fences if present
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence_match:
        text = fence_match.group(1).strip()

    # If there's still leading/trailing junk, grab the first [...] block
    if not text.startswith("["):
        bracket_match = re.search(r"\[[\s\S]*\]", text)
        if bracket_match:
            text = bracket_match.group(0)

    try:
        data = json.loads(text)
        if isinstance(data, list):
            return data
        return []
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from model output: {e}\nRaw text: {raw_text}")
        return []



# API Routes
@app.post("/api/upload-video")
async def upload_video(file: UploadFile = File(...), title: str = Form("")):
    # Use /tmp on Vercel (Linux), or local uploads folder on Windows/others
    upload_dir = "/tmp" if os.name != "nt" else "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Save video file
    file_path = os.path.join(upload_dir, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Transcribe using Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    
    try:
        with open(file_path, "rb") as video_file:
            transcription = client.audio.transcriptions.create(
                file=video_file,
                model="whisper-large-v3"
            )
        
        transcript_text = transcription.text
        
        # Delete the video file after transcription
        os.remove(file_path)
        
        return {
            "title": title or file.filename,
            "transcript": transcript_text,
            "created_at": datetime.now().isoformat()
        }
    except Exception as e:
        # Clean up file in case of error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_with_transcript(request: ChatRequest):
    # Get AI response from Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    
    system_prompt = f"""You are a helpful assistant analyzing meeting transcripts. 
Here is the meeting transcript for context:

{request.transcript}

Answer questions about the meeting, summarize key points, and help extract action items."""
    
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message}
            ]
        )
        
        ai_response = response.choices[0].message.content
        
        return {"response": ai_response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/action-items")
async def extract_action_items(request: ActionItemRequest):
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    system_prompt = f"""
You are an expert meeting assistant.

Meeting Transcript:
{request.transcript}

Extract only actionable tasks from the meeting.

Return the result in this JSON format:

[
  {{
    "task": "Task description",
    "priority": "High/Medium/Low",
    "status": "Pending"
  }}
]

Rules:
- Ignore discussions that are not action items.
- Do not include explanations.
- Return valid JSON only.
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt}
            ],
            temperature=0
        )

        return {
            "action_items": response.choices[0].message.content
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/decisions")
async def extract_decisions(request: DecisionRequest):
    """
    Extract key decisions from the meeting transcript.
    """
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    system_prompt = f"""
You are an expert meeting assistant and business analyst.

Meeting Transcript:
{request.transcript}

Analyse the transcript and extract EVERY key decision made during the meeting. For each decision, return a JSON object containing:

- decision: clear, concise description of the decision made
- category: category of the decision (e.g., Tech Stack, Timeline, Product Design, Strategy, Budget, Policy, Operations)
- reasoning: brief explanation of why this decision was made or the reasoning/context behind it
- decider: who made/proposed the decision (e.g. "CEO", "John", "Team agreement", etc.)

Rules:
- Ignore casual discussion, greetings, small talk, and open questions (only extract actual decisions).
- Keep descriptions concise and clear.
- Return ONLY a valid JSON array of objects, each with exactly the fields:
  decision, category, reasoning, decider.
- Do not include markdown, backticks, or any explanations.
- Do not wrap the JSON in any other structure.

Example Output:
[
  {{
    "decision": "Use PostgreSQL for the database",
    "category": "Tech Stack",
    "reasoning": "Need relational mapping and solid transaction support",
    "decider": "Tech Lead"
  }}
]
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt}
            ],
            temperature=0
        )

        raw_content = response.choices[0].message.content
        decisions = extract_json_array(raw_content)

        # Normalize / guarantee every field is present and non-empty
        normalized = []
        for item in decisions:
            if not isinstance(item, dict):
                continue
            normalized.append({
                "decision": (item.get("decision") or "").strip() or "Untitled decision",
                "category": (item.get("category") or "General").strip(),
                "reasoning": (item.get("reasoning") or "No explicit reasoning provided").strip(),
                "decider": (item.get("decider") or "Collaborative").strip(),
            })

        return {"decisions": normalized}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/owner-deadlines")
async def assign_owner_deadline(request: OwnerDeadlineRequest):
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    system_prompt = f"""
You are an AI project manager.

Meeting Transcript:
{request.transcript}

Identify every action item and assign:

- owner
- deadline

If owner is not mentioned, use "Unassigned".

If deadline is not mentioned, use "No deadline specified".

Return ONLY valid JSON.

Example:

[
  {{
    "task": "Prepare project report",
    "owner": "Alice",
    "deadline": "Friday"
  }},
  {{
    "task": "Deploy backend",
    "owner": "Unassigned",
    "deadline": "No deadline specified"
  }}
]
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt}
            ],
            temperature=0
        )

        return {
            "assignments": response.choices[0].message.content
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
