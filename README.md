# 🩺 Syllabus Surgeon

<div align="center">

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)

**Turn chaotic course syllabi into an actionable, intelligent, semester-long study system.**

[Features](#-key-features) • [Architecture](#-system-architecture) • [Getting Started](#-getting-started) • [API Reference](#-api-endpoints-reference) • [LLM Providers](#-llm-provider-configuration)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Database Setup (Docker)](#1-database-setup-docker)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
- [Environment Variables](#-environment-variables)
- [LLM Provider Configuration](#-llm-provider-configuration)
- [API Endpoints Reference](#-api-endpoints-reference)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Roadmap](#-future-roadmap)
- [License](#-license)

---

## 🎯 Overview

Academic syllabi are notoriously dense, fragmented, and difficult to manage. Important deliverables, examination dates, and grading criteria get buried in multi-page PDFs.

**Syllabus Surgeon** extracts, structures, and organizes course requirements into a clean, modern, interactive academic dashboard. It provides dual-deadline tracking (institutional due dates vs. personal target dates), time-blocked weekly study calendar scheduling, automated study session persistence, dynamic progress analytics, and an integrated AI practice question studio.

---

## ✨ Key Features

### 🔐 1. Secure Multi-User Authentication
- JWT access tokens with HS256 encryption.
- Secure password hashing with `passlib` (`bcrypt`).
- Complete user isolation — each user accesses exclusively their own workspaces, courses, assessments, and study sessions.

### 🗂️ 2. Workspace & Course Portfolios
- Multi-workspace architecture (e.g., *Fall 2026*, *Spring 2027*, *Board Exam Prep*).
- Course organization with custom course codes, descriptions, and color-coded topics.

### 📊 3. Dual-Deadline Assessment Management
- **Official Deadline vs. Personal Target Date**: Keep institutional due dates intact while planning personal prep targets ahead of time.
- Status tracking (`not_started`, `in_progress`, `completed`).
- Priority labeling (`low`, `medium`, `high`, `urgent`) with weighting percentages and hour estimation.
- Automatic countdowns and overdue assessment tracking.

### 📅 4. Interactive Weekly Study Calendar
- Monday–Sunday interactive scheduler with 8:00 AM – 10:00 PM time slots.
- Direct slot-click creation, intuitive placement, and modal-based session editing/deletion.
- Real-time persistence backed by PostgreSQL `study_sessions` table.

### 📈 5. Live Academic Progress & Analytics
- Dynamic status calculation (*"On track"*, *"Needs focus"*, *"Getting started"*).
- Visual course-wise progress bars and completion percentages.
- Planned vs. completed study hour breakdown.

### 🤖 6. AI Practice Studio & Syllabus Parser
- Direct syllabus PDF/text extraction and structure parsing.
- Topic-based practice question generation (MCQ, Short Answer, Conceptual) with explanations.
- Plug-and-play LLM providers supporting **Ollama** (offline/local) and **Groq** (cloud/ultra-fast).

---

## 🏗️ System Architecture

```
                                  +---------------------------+
                                  |    React 19 + Vite SPA    |
                                  | (Dashboard, Calendar, UI) |
                                  +-------------+-------------+
                                                |
                                        REST API / JSON
                                      (Bearer JWT Tokens)
                                                |
                                                v
                                  +---------------------------+
                                  |     FastAPI Backend       |
                                  |  (Pydantic, OAuth2, Auth) |
                                  +------+-------------+------+
                                         |             |
                        +----------------+             +---------------+
                        |                                              |
                        v                                              v
         +-----------------------------+                +-----------------------------+
         |     SQLAlchemy 2.0 ORM      |                |   LLM Extraction Engine     |
         |     (PostgreSQL + Alembic)  |                |  (Ollama / Groq Provider)   |
         +--------------+--------------+                +-----------------------------+
                        |
                        v
         +-----------------------------+
         |   PostgreSQL 16 Database    |
         | (Users, Workspaces, Courses,|
         |  Assessments, StudySessions)|
         +-----------------------------+
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + Vite 6
- **Styling**: Modern Vanilla CSS Design Tokens (Glassmorphism, Dark/Light palettes, Micro-animations)
- **Icons**: Lucide React
- **HTTP Client**: Native Fetch API with structured request wrappers and JWT auth interception

### Backend
- **Framework**: FastAPI (Python 3.11+)
- **ORM & Migrations**: SQLAlchemy 2.0 + Alembic
- **Database Driver**: Psycopg2-binary
- **Authentication**: `python-jose` (Cryptographic JWT) + `passlib` (Bcrypt) + `python-multipart`
- **Validation**: Pydantic v2 + Email-Validator
- **Testing**: Pytest

### Infrastructure & AI
- **Database**: PostgreSQL 16 (Dockerized container)
- **Local AI**: Ollama (`llama3.2:3b`, `llama3.1:8b`)
- **Cloud AI**: Groq (`llama-3.3-70b-versatile`)

---

## 📁 Project Structure

```
syllabus-surgeon/
├── backend/
│   ├── alembic.ini              # Alembic migration configuration
│   ├── migrations/              # Database migration versions
│   ├── core/                    # Core configs, database engine, security & dependencies
│   │   ├── config.py            # Environment & app settings
│   │   ├── database.py          # SQLAlchemy session & Base
│   │   ├── security.py          # Hashing & JWT token logic
│   │   └── auth_dependencies.py # get_current_user dependency
│   ├── models/                  # Database entity models
│   │   └── database.py          # User, Workspace, Course, Assessment, StudySession
│   ├── routes/                  # API routers
│   │   ├── auth.py              # Register, Login, Me, Logout
│   │   ├── workspaces.py        # Workspace CRUD
│   │   ├── courses.py           # Course CRUD
│   │   ├── assessments.py       # Assessment CRUD
│   │   ├── study_sessions.py    # Study session CRUD
│   │   ├── practice.py          # AI practice generator
│   │   └── upload.py            # Syllabus file extraction
│   ├── schemas/                 # Pydantic schemas
│   │   ├── auth.py
│   │   ├── workspace.py
│   │   ├── course.py
│   │   ├── assessment.py
│   │   ├── study_session.py
│   └── practice.py
│   ├── tests/                   # Pytest test suite
│   ├── main.py                  # FastAPI application entrypoint & CORS
│   └── requirements.txt         # Python dependencies
│
├── frontend/
│   ├── src/
│   │   ├── api.js               # API service layer & token storage
│   │   ├── main.jsx             # React dashboard, auth screen, & state logic
│   │   └── styles.css           # Premium styling & responsive design tokens
│   ├── .env.example             # Example frontend environment variables
│   ├── .env.production          # Production frontend configuration
│   ├── package.json             # NPM dependencies & scripts
│   └── vite.config.js           # Vite configuration
│
└── README.md                    # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ and **npm**
- **Python** 3.11+
- **Docker Desktop** (for PostgreSQL)

---

### 1. Database Setup (Docker)

Run PostgreSQL 16 using Docker:

```powershell
docker run --name syllabus-postgres `
  -e POSTGRES_USER=syllabus_user `
  -e POSTGRES_PASSWORD=syllabus_password `
  -e POSTGRES_DB=syllabus_surgeon `
  -p 5432:5432 `
  -d postgres:16
```

To restart an existing container:
```powershell
docker start syllabus-postgres
```

---

### 2. Backend Setup

1. Navigate to the backend directory:
   ```powershell
   cd backend
   ```

2. Create and activate a virtual environment:
   ```powershell
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS/Linux:
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

4. Create a `.env` file in `backend/`:
   ```env
   DATABASE_URL=postgresql+psycopg2://syllabus_user:syllabus_password@localhost:5432/syllabus_surgeon
   SECRET_KEY=replace-this-with-a-very-long-random-secret-key-at-least-32-chars!
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   CORS_ORIGINS=http://localhost:5173
   LLM_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434/v1
   OLLAMA_MODEL=llama3.2:3b
   ```

5. Apply database migrations:
   ```powershell
   alembic upgrade head
   ```

6. Start the development server:
   ```powershell
   uvicorn main:app --reload --port 8000
   ```
   *The Swagger UI will be available at [http://localhost:8000/docs](http://localhost:8000/docs)*.

---

### 3. Frontend Setup

1. Navigate to the frontend directory:
   ```powershell
   cd ../frontend
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Start the Vite development server:
   ```powershell
   npm run dev
   ```

4. Open the application in your browser:
   ```
   http://localhost:5173
   ```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg2://syllabus_user:syllabus_password@localhost:5432/syllabus_surgeon` |
| `SECRET_KEY` | Secret key for JWT token signing | `minimum-32-character-random-secret` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiration in minutes | `1440` (24 hours) |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,https://your-domain.com` |
| `LLM_PROVIDER` | Active LLM provider (`ollama` or `groq`) | `ollama` |
| `OLLAMA_BASE_URL` | Base URL for Ollama service | `http://localhost:11434/v1` |
| `OLLAMA_MODEL` | Ollama model identifier | `llama3.2:3b` |
| `GROQ_API_KEY` | Groq cloud API key | `gsk_...` |
| `GROQ_MODEL` | Groq model identifier | `llama-3.3-70b-versatile` |

### Frontend (`frontend/.env`)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | URL of the backend FastAPI service | `http://localhost:8000` |

---

## 🧠 LLM Provider Configuration

The backend supports OpenAI-compatible LLM backends:

### Option A — Ollama (Local & Private)
1. Install [Ollama](https://ollama.ai) and pull the model:
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

### Option B — Groq (Ultra-Fast Cloud)
1. Obtain an API key from [Groq Console](https://console.groq.com).
2. Configure `.env`:
   ```env
   LLM_PROVIDER=groq
   GROQ_API_KEY=your_groq_api_key_here
   GROQ_MODEL=llama-3.3-70b-versatile
   ```

---

## 📡 API Endpoints Reference

### 🔒 Authentication
- `POST /api/auth/register` — Register a new user account
- `POST /api/auth/login` — Authenticate and receive a JWT Bearer token
- `GET /api/auth/me` — Retrieve the currently authenticated user
- `POST /api/auth/logout` — Invalidate user session

### 🗂️ Workspaces
- `GET /api/workspaces` — List all workspaces owned by the user
- `POST /api/workspaces` — Create a new workspace
- `GET /api/workspaces/{id}` — Get workspace details
- `PATCH /api/workspaces/{id}` — Update workspace name/description
- `DELETE /api/workspaces/{id}` — Delete a workspace and its nested resources

### 📚 Courses
- `GET /api/workspaces/{workspace_id}/courses` — List courses in a workspace
- `POST /api/workspaces/{workspace_id}/courses` — Add a new course
- `GET /api/courses/{id}` — Get course details
- `PATCH /api/courses/{id}` — Update course code, name, or description
- `DELETE /api/courses/{id}` — Delete a course

### 📝 Assessments
- `GET /api/courses/{course_id}/assessments` — List assessments in a course
- `POST /api/courses/{course_id}/assessments` — Create a new assessment
- `GET /api/assessments/{id}` — Get assessment details
- `PATCH /api/assessments/{id}` — Update status, target date, deadlines, hours
- `DELETE /api/assessments/{id}` — Delete an assessment

### ⏱️ Study Sessions
- `GET /api/courses/{course_id}/study-sessions` — List study sessions for a course
- `POST /api/courses/{course_id}/study-sessions` — Schedule a new study session
- `PATCH /api/study-sessions/{id}` — Update session timing or notes
- `DELETE /api/study-sessions/{id}` — Delete a scheduled session

### 🤖 AI Practice & Parser
- `POST /api/practice/generate` — Generate practice questions for course topics
- `POST /api/upload/syllabus` — Parse uploaded syllabus documents

### 🩺 System
- `GET /health` — Health check endpoint

---

## 🧪 Testing & Quality Assurance

### Run Backend Pytest Suite
```powershell
cd backend
python -m pytest tests/ -q
```

### Run Frontend Production Build
```powershell
cd frontend
npm run build
```

---

## 🗺️ Future Roadmap

- [ ] **Google Calendar / iCal Synchronization**: Two-way sync for study sessions and deadlines.
- [ ] **Automated Syllabus Ingestion OCR**: Enhanced OCR support for scanned physical course handouts.
- [ ] **Collaborative Study Groups**: Shared workspaces and group study sessions.
- [ ] **Spaced Repetition Flashcards**: Auto-generated Anki-compatible flashcard decks.

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute with attribution.
