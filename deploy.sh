#!/bin/bash

echo "========================================"
echo "Meeting Transcription App - Quick Deploy"
echo "========================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    echo "GROQ_API_KEY=your_groq_api_key_here" > .env
    echo ""
    echo "IMPORTANT: Please edit .env file and add your Groq API key"
    echo "Get your API key from: https://console.groq.com/"
    echo ""
    read -p "Press Enter after adding your API key..."
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed"
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "ERROR: Docker Compose is not installed"
    echo "Please install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "Starting deployment..."
echo "This will build and start both frontend and backend containers"
echo ""

docker-compose up --build

echo ""
echo "========================================"
echo "Deployment complete!"
echo "========================================"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo "========================================"
