# Stage 1: Build the React frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
# Set REACT_APP_API_URL empty so it dynamically resolves using window.location.origin
ENV REACT_APP_API_URL=""
RUN npm run build

# Stage 2: Build the FastAPI backend and package the frontend
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
# Copy built React files into backend/static
COPY --from=frontend-builder /frontend/build ./static
RUN mkdir -p uploads

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
