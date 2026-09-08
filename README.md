# Syllabus Surgeon

AI-powered syllabus-to-study-system converter and smart academic planner.

## Main features

* **User registration and login**: JWT-based authentication with bcrypt password hashing and user-specific workspaces.
* **Workspace management**: Multiple semester workspaces with independent course portfolios and study targets.
* **Course and assessment management**: Complete CRUD support with topic extraction, grade weightings, estimated hours, and completed hours.
* **Official deadline and personal target date tracking**: Separate tracking for institutional due dates and personal preparation targets.
* **Weekly study calendar**: Interactive Monday–Sunday study session scheduling with 8 AM–10 PM time blocks.
* **Persistent study sessions**: Full study session management backed by PostgreSQL with real-time updates.
* **Course-wise progress analytics**: Live analytics cards, overall completion rates, and individual course progress bars.
* **Overdue and upcoming assessment tracking**: Automatic countdowns and overdue flags for timely study intervention.
* **AI practice studio**: Intelligent practice question generator for syllabus topics with explanations and multiple question types.

---

## Running locally

### 1. Start PostgreSQL

```powershell
docker run --name syllabus-postgres `
  -e POSTGRES_USER=syllabus_user `
  -e POSTGRES_PASSWORD=syllabus_password `
  -e POSTGRES_DB=syllabus_surgeon `
  -p 5432:5432 `
  -d postgres:16
```

Or start an existing container:

```powershell
docker start syllabus-postgres
```

### 2. Start the backend

```powershell
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

### 3. Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

### 4. Open the application

Open the URL shown by Vite:
```
http://localhost:5173
```

---

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

### Option B — Groq (Fast cloud fallback)

1. Get a Groq API key from https://console.groq.com
2. Configure `.env`:
   ```env
   LLM_PROVIDER=groq
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   ```
