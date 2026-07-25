from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import os
import shutil
import logging
import urllib.request
import json
import re
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


class ReminderRequest(BaseModel):
    email: str
    task: str
    owner: str
    priority: str
    status: str
    deadline: str


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
    """
    Single unified extraction: returns task, priority, status, owner and
    deadline together in ONE model call. Doing owner/deadline assignment in
    the same call as task extraction guarantees each field lines up with the
    correct task -- there is no separate list to reconcile afterwards.
    """
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    system_prompt = f"""
You are an expert AI project manager and meeting assistant.

Meeting Transcript:
{request.transcript}

Analyse the transcript and extract EVERY actionable task discussed. For each
action item, return a single JSON object containing ALL of the following
fields together:

- task: short, clear description of the actionable task
- priority: "High", "Medium", or "Low"
- status: always "Pending" (unless the transcript explicitly says it is already done, then "Completed")
- owner: who is responsible for the task
- deadline: when the task is due

Owner Rules:
1. Determine who is responsible for the task from the conversation.
2. Infer responsibility from context, including who is speaking, who is
   being asked to do something, and pronouns such as "he", "she", "they",
   "you", and "we".
3. Do NOT require explicit words like "owner", "assigned to", or "responsible".
4. If multiple people are responsible, return them as a comma-separated string.
5. If the owner truly cannot be determined:
   - Choose a person already mentioned anywhere in the meeting transcript.
   - If the transcript contains no names, generate a realistic first name such as:
     Alex, Sarah, Rahul, Priya, Emma, David, John, Sophia, Michael, Emily.
   - Never return "Unassigned" or an empty string.

Deadline Rules:
1. Extract the actual deadline if one is mentioned (explicit date, or
   expressions such as "tomorrow", "Friday", "next Monday", "end of this week",
   "before the client meeting").
2. If no deadline is mentioned, generate a plausible date between
   01/08/2026 and 09/08/2026 (inclusive), formatted as DD/MM/YYYY.
3. Never return "No deadline specified" or an empty string.

Task Rules:
- Extract every actionable task.
- Ignore casual discussion, opinions, greetings, and completed small talk.
- Do not invent tasks that are not implied by the transcript.
- Keep task descriptions short and clear.

Output Rules:
- Return ONLY a valid JSON array of objects, each with exactly the fields:
  task, priority, status, owner, deadline.
- Do not include markdown, backticks, or any explanations.
- Do not wrap the JSON in any other structure.

Example Output:
[
  {{
    "task": "Prepare the project report",
    "priority": "High",
    "status": "Pending",
    "owner": "Alice",
    "deadline": "Friday"
  }},
  {{
    "task": "Deploy the backend",
    "priority": "Medium",
    "status": "Pending",
    "owner": "Bob",
    "deadline": "03/08/2026"
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
        items = extract_json_array(raw_content)

        # Normalize / guarantee every field is present and non-empty
        normalized = []
        for item in items:
            if not isinstance(item, dict):
                continue
            normalized.append({
                "task": (item.get("task") or "").strip() or "Untitled task",
                "priority": (item.get("priority") or "Medium").strip(),
                "status": (item.get("status") or "Pending").strip(),
                "owner": (item.get("owner") or "Unassigned").strip(),
                "deadline": (item.get("deadline") or "TBD").strip(),
            })

        return {"action_items": normalized}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/owner-deadlines")
async def assign_owner_deadline(request: OwnerDeadlineRequest):
    """
    Kept for backwards compatibility with any other callers, but the
    /api/action-items endpoint above now returns owner + deadline directly
    and should be preferred -- it avoids the need to reconcile two
    independently generated lists.
    """
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    system_prompt = f"""
You are an expert AI project manager and meeting assistant.

Your job is to analyse the meeting transcript and extract EVERY actionable task.

For each action item, return:

- task
- owner
- deadline

Owner Rules:

1. Determine who is responsible for the task from the conversation.
2. Infer responsibility from context, including:
   - who is speaking
   - who is being asked to do something
   - pronouns such as "he", "she", "they", "you", and "we"
3. Do NOT require words like "owner", "assigned to", or "responsible".
4. If multiple people are responsible, return them as a comma-separated string.
5. If the owner cannot be determined:
   - Choose a random person already mentioned anywhere in the meeting transcript.
   - If the transcript contains no names, generate a realistic first name such as:
     Alex, Sarah, Rahul, Priya, Emma, David, John, Sophia, Michael, Emily.
   - Never return "Unassigned".

Deadline Rules:

1. Extract the actual deadline if one is mentioned.
2. Deadlines may be explicit dates or expressions such as:
   - Tomorrow
   - Friday
   - Next Monday
   - End of this week
   - Before the client meeting
3. If no deadline is mentioned, generate a random date between
   01/08/2026 and 09/08/2026 (inclusive).
4. Format generated dates as DD/MM/YYYY.
5. Never return "No deadline specified".

Task Rules:

- Extract every actionable task.
- Ignore casual discussion, opinions, greetings, and completed work.
- Do not invent tasks that are not implied by the transcript.
- Keep task descriptions short and clear.

Output Rules:

- Return ONLY a valid JSON array.
- Do not include markdown.
- Do not include explanations.
- Do not wrap the JSON in backticks.

Meeting Transcript:
{request.transcript}
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


@app.post("/api/send-reminder")
async def send_reminder(request: ReminderRequest):
    # 1. Validate fields
    if not request.email or "@" not in request.email or "." not in request.email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    if not request.task.strip():
        raise HTTPException(status_code=400, detail="Task description cannot be empty")
    if not request.owner.strip():
        raise HTTPException(status_code=400, detail="Owner name cannot be empty")

    # 2. Compose professional email contents
    subject = f"Meeting Action Item Reminder: {request.task[:50]}" + ("..." if len(request.task) > 50 else "")

    priority_lower = request.priority.strip().lower()
    status_lower = request.status.strip().lower()

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f4f5f7;
            color: #333333;
            margin: 0;
            padding: 20px;
        }}
        .container {{
            max-width: 600px;
            background: #ffffff;
            margin: 0 auto;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
            border: 1px solid #e1e4e8;
        }}
        .header {{
            background: linear-gradient(135deg, #4f46e5, #06b6d4);
            color: #ffffff;
            padding: 30px 20px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }}
        .content {{
            padding: 30px 25px;
        }}
        .greeting {{
            font-size: 16px;
            margin-bottom: 20px;
            line-height: 1.5;
        }}
        .task-card {{
            background-color: #f9fafb;
            border-left: 4px solid #4f46e5;
            padding: 20px;
            border-radius: 4px;
            margin-bottom: 25px;
        }}
        .task-title {{
            font-size: 18px;
            font-weight: 700;
            margin-top: 0;
            margin-bottom: 15px;
            color: #111827;
        }}
        .task-details {{
            border-collapse: collapse;
            width: 100%;
        }}
        .task-details td {{
            padding: 6px 0;
            font-size: 14px;
            vertical-align: top;
        }}
        .label {{
            color: #6b7280;
            font-weight: 600;
            width: 120px;
        }}
        .value {{
            color: #1f2937;
        }}
        .badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: capitalize;
        }}
        .badge-high {{ background-color: #fee2e2; color: #991b1b; }}
        .badge-medium {{ background-color: #fef3c7; color: #92400e; }}
        .badge-low {{ background-color: #e0f2fe; color: #075985; }}
        .badge-pending {{ background-color: #ffedd5; color: #9a3412; }}
        .badge-completed {{ background-color: #d1fae5; color: #065f46; }}

        .footer {{
            background-color: #f9fafb;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            border-top: 1px solid #e5e7eb;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Action Item Reminder</h1>
        </div>
        <div class="content">
            <div class="greeting">
                Hello <strong>{request.owner}</strong>,<br><br>
                This is a reminder regarding an action item assigned to you. Please see the task details below:
            </div>
            <div class="task-card">
                <div class="task-title">{request.task}</div>
                <table class="task-details">
                    <tr>
                        <td class="label">Priority:</td>
                        <td class="value">
                            <span class="badge badge-{priority_lower}">{request.priority}</span>
                        </td>
                    </tr>
                    <tr>
                        <td class="label">Status:</td>
                        <td class="value">
                            <span class="badge badge-{status_lower}">{request.status}</span>
                        </td>
                    </tr>
                    <tr>
                        <td class="label">Deadline:</td>
                        <td class="value"><strong>{request.deadline}</strong></td>
                    </tr>
                </table>
            </div>
            <div class="greeting">
                If you have completed this task, please update the status in the Meeting Transcription dashboard.
            </div>
        </div>
        <div class="footer">
            This is an automated email notification from the Meeting Transcription App. Please do not reply directly to this email.
        </div>
    </div>
</body>
</html>
"""

    text_content = (
        f"Hello {request.owner},\n\n"
        f"This is a reminder regarding an action item assigned to you.\n\n"
        f"Task: {request.task}\n"
        f"Priority: {request.priority}\n"
        f"Status: {request.status}\n"
        f"Deadline: {request.deadline}\n\n"
        f"Please update the status in the dashboard once completed.\n"
    )

    # 3. Email dispatch configuration checks
    sendgrid_key = os.getenv("SENDGRID_API_KEY")
    sendgrid_from = os.getenv("SENDGRID_FROM_EMAIL")

    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port_str = os.getenv("SMTP_PORT")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    sender_email = os.getenv("SMTP_SENDER") or smtp_username

    email_sent = False
    errors = []

    # SendGrid Web API Execution path
    if sendgrid_key and sendgrid_from:
        logger.info("Attempting to send email via SendGrid Web API...")
        try:
            url = "https://api.sendgrid.com/v3/mail/send"
            headers = {
                "Authorization": f"Bearer {sendgrid_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "personalizations": [
                    {
                        "to": [{"email": request.email}],
                        "subject": subject
                    }
                ],
                "from": {"email": sendgrid_from},
                "content": [
                    {
                        "type": "text/html",
                        "value": html_content
                    },
                    {
                        "type": "text/plain",
                        "value": text_content
                    }
                ]
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req) as response:
                if response.status in (200, 201, 202):
                    email_sent = True
                    logger.info(f"Email successfully sent to {request.email} via SendGrid API.")
                else:
                    err_msg = f"SendGrid API responded with status: {response.status}"
                    errors.append(err_msg)
                    logger.error(err_msg)
        except Exception as e:
            err_msg = f"SendGrid API exception: {str(e)}"
            errors.append(err_msg)
            logger.error(err_msg)

    # SMTP Execution path (either as primary or fallback if SendGrid fails/not configured)
    if not email_sent:
        if smtp_server and smtp_username and smtp_password:
            logger.info("Attempting to send email via SMTP...")
            try:
                try:
                    smtp_port = int(smtp_port_str) if smtp_port_str else 587
                except ValueError:
                    smtp_port = 587

                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = sender_email
                msg["To"] = request.email

                part1 = MIMEText(text_content, "plain")
                part2 = MIMEText(html_content, "html")
                msg.attach(part1)
                msg.attach(part2)

                if smtp_port == 465:
                    server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
                else:
                    server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
                    server.starttls()

                server.login(smtp_username, smtp_password)
                server.sendmail(sender_email, request.email, msg.as_string())
                server.quit()

                email_sent = True
                logger.info(f"Email successfully sent to {request.email} via SMTP.")
            except Exception as e:
                err_msg = f"SMTP exception: {str(e)}"
                errors.append(err_msg)
                logger.error(err_msg)
        else:
            if not sendgrid_key:
                err_msg = "No email credentials configured. Please set SENDGRID_API_KEY or SMTP_SERVER/SMTP_USERNAME/SMTP_PASSWORD in your .env file."
                errors.append(err_msg)
                logger.error(err_msg)

    # 4. Return success or failure response
    if email_sent:
        return {"success": True, "message": f"Reminder email successfully sent to {request.email}"}
    else:
        # Logging email content to terminal for development/debugging purposes
        logger.info("--- FAILED EMAIL LOG (Simulated output due to missing configuration) ---")
        logger.info(f"To: {request.email}")
        logger.info(f"Subject: {subject}")
        logger.info(f"Body:\n{text_content}")
        logger.info("---------------------------------------------------------------------")
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Failed to send email. Ensure the server has valid email configuration.",
                "errors": errors
            }
        )


from fastapi.staticfiles import StaticFiles

static_path = Path(__file__).resolve().parent / "static"
if static_path.exists():
    app.mount("/", StaticFiles(directory=str(static_path), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)