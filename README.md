# Syllabus Surgeon

AI-powered syllabus-to-study-system converter.

## Features

- Upload a syllabus PDF
- Extract text with `pdfplumber`
- Use OpenAI-compatible LLM (Ollama locally or Groq cloud) to extract structured syllabus items
- Validate output with Pydantic
- Rank tasks using deterministic urgency × grade impact scoring
- Generate practice questions for the highest-priority topic
- Flag unclear dates instead of silently guessing

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL=http://localhost:8000` in `frontend/.env` if needed.

## LLM Provider Configuration

The backend uses an OpenAI-compatible interface supporting both local and cloud options:

### Option A — Ollama (Recommended for local development)

1. Install and start Ollama:
   ```bash
   ollama pull llama3.2:3b
   ollama serve
   ```
2. Configure `.env`:
   ```env
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434/v1
   OLLAMA_MODEL=llama3.2:3b
   ```
   *No API key required. Your syllabus stays completely on your machine.*

### Option B — Groq (Fast cloud fallback)

1. Get a Groq API key from https://console.groq.com
2. Configure `.env`:
   ```env
   LLM_PROVIDER=groq
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   ```
