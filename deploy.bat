@echo off
echo ========================================
echo Meeting Transcription App - Quick Deploy
echo ========================================
echo.

REM Check if .env file exists
if not exist .env (
    echo Creating .env file...
    echo GROQ_API_KEY=your_groq_api_key_here > .env
    echo.
    echo IMPORTANT: Please edit .env file and add your Groq API key
    echo Get your API key from: https://console.groq.com/
    echo.
    pause
)

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Compose is not installed or not in PATH
    echo It should be included with Docker Desktop
    pause
    exit /b 1
)

echo Starting deployment...
echo This will build and start both frontend and backend containers
echo.

docker-compose up --build

echo.
echo ========================================
echo Deployment complete!
echo ========================================
echo Frontend: http://localhost
echo Backend API: http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo ========================================
