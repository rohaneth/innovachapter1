# Meeting Transcription & Task Management App

A full-stack application for meeting video transcription, AI-powered chat, and action item management.

## Features

- **Video Upload & Transcription**: Upload meeting videos and get automatic AI-powered transcription
- **AI Chat Interface**: Chat with your meeting transcript using AI to extract insights
- **Action Item Management**: Create, assign, and track action items with deadlines
- **Dashboard**: Visual overview of pending vs completed tasks with analytics
- **Easy Deployment**: One-command deployment using Docker Compose
- **No Database**: All data stored in browser localStorage - no server-side persistence

## Tech Stack

### Backend
- FastAPI (Python)
- Groq API (Whisper for transcription, Llama for chat)
- Uvicorn server
- Stateless architecture (no database)

### Frontend
- React 18
- TailwindCSS
- Lucide React (icons)
- Recharts (charts)
- localStorage for data persistence

## Prerequisites

- Docker and Docker Compose installed
- Groq API key (get one at https://console.groq.com/)

## Quick Start (Docker Deployment)

### 1. Set up environment variables

Create a `.env` file in the root directory:

```bash
# Groq API Configuration
GROQ_API_KEY=your_groq_api_key_here
REACT_APP_API_URL=http://localhost:8000

# Optional: Email Reminder Configuration (SendGrid)
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=sender@yourdomain.com

# Optional: Email Reminder Configuration (SMTP fallback)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_SENDER=your_email@gmail.com
```

### 2. Deploy with one command

```bash
docker-compose up --build
```

That's it! The application will be available at:
- Frontend: http://localhost
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Manual Development Setup

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set environment variable:
```bash
export GROQ_API_KEY=your_key_here  # On Windows: set GROQ_API_KEY=your_key_here
```

5. Run backend:
```bash
python app.py
```

Backend will run on http://localhost:8000

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Set environment variable:
```bash
export REACT_APP_API_URL=http://localhost:8000  # On Windows: set REACT_APP_API_URL=http://localhost:8000
```

4. Run frontend:
```bash
npm start
```

Frontend will run on http://localhost:3000

## Usage

1. **Upload Video**: Go to "Upload Video" tab and upload a meeting video file
2. **View Transcript**: After upload, you'll be redirected to the chat interface with the transcript
3. **Chat with AI**: Ask questions about the meeting content
4. **Manage Action Items**: Go to "Action Items" tab to create and assign tasks
5. **View Dashboard**: Check the dashboard for analytics and task overview

**Note**: All data (meetings, transcripts, action items, chat history) is stored in your browser's localStorage. Clearing browser data will remove all stored information.

## API Endpoints

### Video & Transcription
- `POST /api/upload-video` - Upload and transcribe video (returns transcript)

### Chat
- `POST /api/chat` - Send chat message with transcript context (requires transcript and message in body)

## Project Structure

```
freshinnova/
├── backend/
│   ├── app.py              # FastAPI application (stateless)
│   ├── requirements.txt    # Python dependencies
│   ├── Dockerfile          # Backend Docker config
│   └── uploads/            # Temporary video storage
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── App.js          # Main app component with localStorage
│   │   └── index.js        # Entry point
│   ├── public/             # Static files
│   ├── package.json        # Node dependencies
│   ├── Dockerfile          # Frontend Docker config
│   └── nginx.conf          # Nginx configuration
├── docker-compose.yml      # Docker Compose configuration
└── .env                    # Environment variables
```

## Troubleshooting

### Docker Issues
- If ports are already in use, change them in `docker-compose.yml`
- Check Docker logs: `docker-compose logs`

### API Key Issues
- Ensure your Groq API key is valid and has sufficient credits
- Check that the API key is properly set in `.env` file

### Frontend Issues
- Clear browser cache if UI doesn't update
- Check browser console for errors
- Ensure `REACT_APP_API_URL` is set correctly
- If data disappears, check that localStorage is enabled in your browser

### Data Persistence
- All data is stored in browser localStorage
- Clearing browser data will remove all meetings and action items
- Data is not shared between different browsers or devices
- For production use, consider implementing a backend database

## Production Deployment

For production deployment:

1. **Update environment variables in production:** Ensure Groq, SendGrid/SMTP credentials are fully configured.
2. **Enable HTTPS:** Secures authentication headers and data transit.
3. **Configure nginx for production:** If self-hosting using Docker.
4. **Add authentication/authorization:** Restrict access to authorized meeting members.
5. **Consider database persistence:** Port local storage to standard PostgreSQL/MongoDB databases.
6. **Vercel Serverless Function Deployment:** 
   - The project is fully pre-configured to run out of the box on Vercel. 
   - The frontend uses `/api/index.py` serverless functions for zero-configuration backend scalability, automatically routed via `frontend/vercel.json`.
   - Setup project on Vercel and attach your environment variables to host instantly.

## License

MIT
