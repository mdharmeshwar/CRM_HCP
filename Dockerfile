# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve Backend & Frontend
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1

# Copy build dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI backend code
COPY backend/ ./backend

# Copy compiled frontend assets from Stage 1 into /app/dist
COPY --from=frontend-builder /app/dist ./dist

# Expose port and launch backend
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
