# backend/app/config.py
"""Application configuration using Pydantic BaseSettings.

Settings are loaded from environment variables (.env). Using Pydantic ensures
typed, validated configuration with sensible defaults for detection.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, AnyUrl


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Keep defaults sensible for local development. Values can be overridden
    via `backend/.env` or environment variables in deployment.
    """

    # Infrastructure
    SUPABASE_URL: Optional[AnyUrl] = Field(None, env="SUPABASE_URL")
    CORS_ORIGINS: List[str] = Field(["http://localhost:3000"], env="CORS_ORIGINS")

    # YOLO detection defaults
    YOLO_MODEL: str = Field("yolov8n.pt", env="YOLO_MODEL")
    DETECTION_CONFIDENCE: float = Field(0.4, env="DETECTION_CONFIDENCE")
    NMS_IOU_THRESHOLD: float = Field(0.45, env="NMS_IOU_THRESHOLD")

    # WebSocket / server tuning
    WS_MAX_MESSAGE_SIZE: int = Field(10 * 1024 * 1024)  # 10 MB

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"


settings = Settings()
