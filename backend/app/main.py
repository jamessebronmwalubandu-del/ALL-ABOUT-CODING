# backend/app/main.py
"""FastAPI application entrypoint.

Exposes health and root endpoints and the WebSocket route for particle streaming.
"""
from __future__ import annotations

import logging
import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .websocket_handler import handle_particle_detection

logger = logging.getLogger("psd_backend")
logging.basicConfig(level=logging.INFO)


app = FastAPI(title="PSD Analyzer Backend", version="0.1")

# Configure CORS from environment config; support comma-separated values
origins = settings.CORS_ORIGINS
if isinstance(origins, str):
    origins = [o.strip() for o in origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    logger.info("Starting PSD Analyzer backend")
    logger.info("YOLO model: %s", settings.YOLO_MODEL)


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {"message": "PSD Analyzer backend is running"}


@app.websocket("/ws/particle-stream")
async def websocket_endpoint(websocket: WebSocket):
    # delegate handling to the handler
    await handle_particle_detection(websocket)


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
