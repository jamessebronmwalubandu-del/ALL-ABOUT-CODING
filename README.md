# ALL ABOUT CODING

## Local development

### Frontend

```bash
npm install
npm run dev
```

### Backend

From the repository root:

```bash
npm run backend:dev
```

Or directly from the backend folder:

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Notes

- The frontend source is in `app/`.
- The backend FastAPI app is located in `backend/main.py`.
- `uvicorn app:app` is incorrect for this repository because `app/` is the Next.js frontend folder.
