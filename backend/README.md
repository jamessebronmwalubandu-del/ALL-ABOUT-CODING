# Backend PSD API

## Local setup

1. Create and activate a Python 3.11+ virtual environment.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy environment file and fill values:
   ```bash
   cp .env.example .env
   ```
4. Start the API:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## Docker setup

1. Build image:
   ```bash
   docker build -t psd-backend .
   ```
2. Run container:
   ```bash
   docker run --rm -p 8000:8000 --env-file .env psd-backend
   ```

## Supabase setup

1. Open Supabase SQL editor.
2. Run `supabase_schema.sql`.
3. Ensure `SUPABASE_SERVICE_ROLE_KEY` is configured only on backend runtime.
