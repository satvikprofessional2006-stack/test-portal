# Exam Portal

Production-quality online coding examination platform for colleges/institutions.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Monaco Editor, Tailwind CSS |
| Backend API | Django 4.2, Django REST Framework |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 |
| Task Queue | Celery 5 |
| Code Execution | Subprocess sandbox (dev) / Docker (production) |

## Development Setup

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL (or use Docker Compose)
- Redis (or use Docker Compose)

### Backend

```bash
cd backend
python -m venv ../venv
source ../venv/bin/activate   # Windows: ..\venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env with your local settings

# Local dev with SQLite (no postgres needed):
DJANGO_SETTINGS_MODULE=config.settings_local python manage.py migrate
DJANGO_SETTINGS_MODULE=config.settings_local python manage.py createsuperuser
DJANGO_SETTINGS_MODULE=config.settings_local python manage.py runserver

# Run tests
DJANGO_SETTINGS_MODULE=config.settings_local python manage.py test tests -v2
```

### Full Stack (Docker Compose)

```bash
docker compose up --build
```

Services:
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/api/docs/
- Django Admin: http://localhost:8000/admin/
- Frontend: http://localhost:3000

## Project Structure

```
test-portal/
├── backend/
│   ├── config/          # Settings, URLs, Celery, exceptions
│   ├── accounts/        # User model, JWT auth
│   ├── exams/           # Exam, Question, TestCase, Enrollment
│   ├── sessions/        # ExamSession, CodeDraft (autosave)
│   ├── submissions/     # Submission, SubmissionResult, RunRequest
│   ├── execution/       # ExecutionJob, sandbox workers
│   ├── security/        # SecurityEvent audit log
│   └── tests/           # Test suite
├── frontend/            # Next.js app (Milestone 3)
├── docker-compose.yml
└── README.md
```

## Milestones

- [x] M1 — Project Scaffold & Database Models
- [ ] M2 — Authentication & Exam Sessions API
- [ ] M3 — Student Exam Interface (Frontend)
- [ ] M4 — Run Code (Execution Service)
- [ ] M5 — Submit + Hidden Test Cases
- [ ] M6 — Autosave
- [ ] M7 — Admin Dashboard
- [ ] M8 — Security Event Logging
- [ ] M9 — macOS/Windows Lockdown Integration
- [ ] M10 — Tests, Load Testing, Reliability
