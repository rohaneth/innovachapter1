from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import os
import shutil
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="Meeting Transcription App")

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




# API Routes
@app.post("/api/upload-video")
async def upload_video(file: UploadFile = File(...), title: str = Form("")):
    # Create uploads directory if it doesn't exist
    os.makedirs("uploads", exist_ok=True)
    
    # Save video file
    file_path = f"uploads/{file.filename}"
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





from fastapi.staticfiles import StaticFiles

static_path = Path(__file__).resolve().parent / "static"
if static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
