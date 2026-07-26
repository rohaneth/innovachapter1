# 🎙️ MeetFlow AI — AI Meeting & Follow-Up Agent

> **Hackathon Track:** AI Meeting & Follow-Up Agent (Problem Statement 2)
> An autonomous agent that turns raw meeting recordings into tracked decisions, assigned action items, and self-driven follow-up reminders — so nothing said in a meeting is ever forgotten.

---

## 🧩 Problem We're Solving

Meetings generate decisions and action items constantly, but the moment the call ends, most of it evaporates. No one is fully sure who owes what, by when — and follow-ups only happen if someone manually chases people down.

**MeetFlow AI** closes that gap end-to-end: upload a recording → get a transcript → extract decisions and action items → auto-assign owners and deadlines → send automated reminders until each task is marked done — all visible on a live dashboard.

---

## 💡 Our Solution

MeetFlow AI is a full-stack, AI-powered agent pipeline that directly mirrors every focus area in the problem statement:

| Problem Statement Focus Area | How MeetFlow AI Delivers It |
|---|---|
| Transcript / action-item extraction | Groq Whisper-large-v3 transcribes meeting video/audio; Llama-3.3-70b-versatile extracts action items in a single structured LLM pass |
| Owner & deadline assignment | The same extraction pass infers the most plausible owner, priority (High/Medium/Low), and a realistic deadline per task |
| Automated reminder / follow-up loop | Live countdown timers per task + one-click / autonomous professional HTML email reminders via SendGrid or SMTP, re-triggerable until completion |
| Simple dashboard of pending vs. completed items | React + Recharts analytics dashboard shows pending vs. completed items, priorities, and per-meeting breakdowns at a glance |
| (Bonus) Decision tracking | A dedicated decisions engine catalogs *what* was decided, *why*, and *by whom* — not just tasks, but the reasoning behind them |
| (Bonus) Ask-your-meeting chat | Chat directly with any transcript to clarify context without re-watching the recording |

---

## ✨ Key Features

- 🎥 **Video Ingestion & Transcription** — Upload a recording, get a precise transcript via **Groq Whisper-large-v3**.
- 📋 **Unified Action-Item Extraction** — Tasks, owners, priority, and deadlines generated in one aligned AI call (no drift between fields).
- 🧠 **Key Decision Archiving** — Captures category, decider, and reasoning for every decision made in the meeting.
- ⏱️ **Live Countdown Reminders** — Real-time deadline countdowns embedded directly in the Action Items dashboard.
- ✉️ **Autonomous Follow-Ups** — Professional HTML reminder emails sent via SendGrid or SMTP fallback, so tasks get chased automatically instead of manually.
- 💬 **Interactive AI Chat** — Ask the transcript questions directly using **Llama-3.3-70b-versatile**.
- 📊 **Pending vs. Completed Dashboard** — At-a-glance analytics across all meetings.
- ⚡ **Stateless, Serverless-Ready Backend** — No database dependency; deploys instantly to Vercel.

---

## 🚀 Why This Stands Out (Innovation & Differentiation)

- **Single aligned LLM call** for owner + priority + deadline extraction, avoiding the inconsistency that comes from separate prompts/models per field.
- **Decisions as first-class data**, not just action items — most competing tools only extract tasks, losing the "why" behind a decision.
- **Reminder loop is autonomous, not a static list** — countdowns and emails actively push follow-through instead of relying on someone remembering to check a board.
- **Zero-database, serverless-first architecture** — trivially cheap to run and deploy, making it realistic for small teams to actually adopt post-hackathon.

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** (Python 3) — async, high-performance API layer
- **Groq SDK** — Whisper-large-v3 (transcription) + Llama-3.3-70b-versatile (chat, extraction)
- **SendGrid Web API** with **SMTP fallback** (e.g., Gmail App Password) for reminder emails
- **Stateless design** — no backend database required

### Frontend
- **React 18** (functional components)
- **TailwindCSS** for responsive UI
- **Lucide React** for icons
- **Recharts** for the analytics dashboard
- **Browser `localStorage`** for lightweight client-side persistence

### Infra / Deployment
- **Docker Compose** for local multi-container orchestration
- **Vercel** — serverless deployment (frontend static hosting + backend as Serverless Functions)
- One-click `deploy.bat` / `deploy.sh` scripts for judges to spin up the demo fast

---

## 🏗️ Architecture Overview

```
Meeting Recording
      │
      ▼
[Groq Whisper-large-v3] ──► Transcript
      │
      ▼
[Llama-3.3-70b-versatile]
  ├──► Action Items (owner, priority, deadline)
  ├──► Key Decisions (category, decider, reasoning)
  └──► Conversational Chat (ask the transcript anything)
      │
      ▼
[React Dashboard] ──► Pending vs. Completed, countdowns, charts
      │
      ▼
[SendGrid / SMTP] ──► Automated reminder emails until task is marked complete
```

---

## 📋 Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- A **Groq API Key** — free at the [Groq Console](https://console.groq.com/)
- *(Optional)* **SendGrid API Key** or an **SMTP-enabled email account** (e.g., Gmail App Password) for testing reminders

---

## 🚀 Getting Started

### Option A: Quick Start (One-Click)
- **Windows**: run `.\deploy.bat`
- **Mac/Linux**:
  ```bash
  chmod +x deploy.sh
  ./deploy.sh
  ```

### Option B: Docker Compose
1. Create a `.env` file (see `.env.example`):
   ```env
   # Required
   GROQ_API_KEY=your_groq_api_key_here
   REACT_APP_API_URL=http://localhost:8000

   # Optional: SendGrid
   SENDGRID_API_KEY=your_sendgrid_key
   SENDGRID_FROM_EMAIL=sender@yourdomain.com

   # Optional: SMTP fallback
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USERNAME=your_email@gmail.com
   SMTP_PASSWORD=your_app_password
   SMTP_SENDER=your_email@gmail.com
   ```
2. Build and start:
   ```bash
   docker-compose up --build
   ```
3. Access:
   - Frontend → http://localhost
   - Backend API → http://localhost:8000
   - Swagger Docs → http://localhost:8000/docs

### Option C: Manual Dev Setup
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py   # runs on http://localhost:8000

# Frontend (new terminal)
cd frontend
npm install
npm start        # runs on http://localhost:3000
```

### Option D: Vercel Serverless Deployment
Fully pre-configured for a unified single-repo Vercel deploy:
- Frontend served via static hosting / Nginx
- Backend mapped to Serverless Functions via `frontend/api/index.py` and `frontend/vercel.json`
- Add `GROQ_API_KEY` (and email provider keys) in Vercel project settings

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/upload-video` | Uploads a video, transcribes via Whisper-large-v3, returns transcript text |
| `POST` | `/api/chat` | Chat with a meeting transcript via Llama-3.3-70b-versatile |
| `POST` | `/api/action-items` | Extracts tasks, owners, priorities, deadlines from a transcript in one AI pass |
| `POST` | `/api/decisions` | Extracts key decisions, categories, reasoning, and deciders |
| `POST` | `/api/send-reminder` | Sends a professional HTML reminder email via SendGrid or SMTP fallback (falls back to console log if no credentials set) |

Example `send-reminder` payload:
```json
{
  "email": "recipient@domain.com",
  "task": "Task description details",
  "owner": "Assignee Name",
  "priority": "High",
  "status": "Pending",
  "deadline": "31/12/2026"
}
```

---

## 📁 Project Structure

```
freshinnova/
├── backend/
│   ├── app.py              # Main FastAPI application
│   ├── requirements.txt
│   ├── Dockerfile
│   └── uploads/             # Temporary video processing dir
├── frontend/
│   ├── api/index.py         # Vercel Serverless Function entry point
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActionItems.js   # Task dashboard, decisions, countdowns
│   │   │   ├── ChatInterface.js # Transcript-bound AI chat
│   │   │   ├── Dashboard.js     # Analytics charts & meeting selector
│   │   │   └── VideoUpload.js   # Video upload UI
│   │   ├── App.js
│   │   └── index.js
│   ├── public/
│   ├── vercel.json
│   ├── Dockerfile
│   └── nginx.conf
├── deploy.bat
├── deploy.sh
├── docker-compose.yml
└── .env
```

---

## 📈 Scalability & Real-World Impact

- **Stateless backend** means horizontal scaling is trivial — spin up more serverless instances with zero session/data migration concerns.
- **Provider-agnostic email layer** (SendGrid + SMTP fallback) means it works for solo users and enterprise teams alike.
- **Any team that runs recurring meetings** (product, sales, ops, client calls) can adopt this immediately to cut down on missed follow-ups and "who owns this?" confusion.
- Natural extensions: Slack/Teams notifications, calendar integration for deadline sync, multi-language transcription, and a persistent database for cross-meeting analytics at scale.

---

## 🎯 Roadmap (Post-Hackathon)

- [ ] Slack / Microsoft Teams reminder delivery
- [ ] Calendar sync for deadlines
- [ ] Persistent database + multi-user auth
- [ ] Recurring/escalating reminder cadence (not just one-shot)
- [ ] Meeting-to-meeting trend analytics (who's overdue most often, decision velocity, etc.)

---

## 🛡️ License

Licensed under the MIT License — free to customize and extend for your organization.
