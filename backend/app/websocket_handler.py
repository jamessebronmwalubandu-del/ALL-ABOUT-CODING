# backend/app/websocket_handler.py
"""WebSocket handler and connection manager.

Provides a `/ws/particle-stream` endpoint that receives base64-encoded
JPEG frames, decodes them, runs particle detection and returns JSON
responses containing particle lists with mm measurements.
"""
from __future__ import annotations

import base64
import io
import json
import logging
import time
from typing import Dict

import numpy as np
import cv2
from fastapi import WebSocket, WebSocketDisconnect

from .config import settings
from .detection import ParticleDetector
from .schemas import FrameRequest, FrameResponse

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        cid = id(websocket)
        self.active_connections[str(cid)] = websocket
        logger.info("WebSocket connected: %s", cid)
        return str(cid)

    def disconnect(self, cid: str):
        if cid in self.active_connections:
            del self.active_connections[cid]
            logger.info("WebSocket disconnected: %s", cid)

    def get(self, cid: str) -> WebSocket:
        return self.active_connections[cid]


manager = ConnectionManager()

# initialize detector lazily to avoid slow import at module load
_detector: ParticleDetector | None = None


def get_detector() -> ParticleDetector:
    global _detector
    if _detector is None:
        _detector = ParticleDetector(
            model_path=settings.YOLO_MODEL,
            conf=settings.DETECTION_CONFIDENCE,
            iou=settings.NMS_IOU_THRESHOLD,
            device="cpu",
        )
    return _detector


def decode_frame_data(b64: str) -> np.ndarray:
    """Decode base64-encoded JPEG into a BGR numpy array usable by OpenCV.

    Raises ValueError on decode errors.
    """
    try:
        data = base64.b64decode(b64)
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Decoded image is None")
        return img
    except Exception as exc:
        logger.exception("Failed to decode frame: %s", exc)
        raise ValueError(f"Failed to decode frame: {exc}") from exc


async def handle_particle_detection(websocket: WebSocket):
    cid = await manager.connect(websocket)
    detector = get_detector()

    try:
        while True:
            data_text = await websocket.receive_text()
            t_recv = time.time()

            try:
                payload = json.loads(data_text)
                req = FrameRequest(**payload)
            except Exception as exc:
                logger.error("Invalid frame payload: %s", exc)
                # always echo frameId if present
                fid = payload.get("frameId") if isinstance(payload, dict) else None
                await websocket.send_text(json.dumps({"frameId": fid, "error": str(exc)}))
                continue

            try:
                frame = decode_frame_data(req.frame)
            except ValueError as exc:
                logger.error("Decode error for frameId=%s: %s", req.frameId, exc)
                await websocket.send_text(json.dumps({"frameId": req.frameId, "error": str(exc)}))
                continue

            try:
                particles, processing_ms = detector.process_frame(frame, req.calibration, req.settings)
                response = FrameResponse(frameId=req.frameId, particles=particles, processingTimeMs=round(processing_ms, 2), stats={"recvLatencyMs": round((time.time()-t_recv)*1000.0,2)})
                await websocket.send_text(response.json())
                logger.info("Sent detection result frameId=%s particles=%d time=%.2fms", req.frameId, len(particles), processing_ms)
            except Exception as exc:
                logger.exception("Detection error for frameId=%s: %s", req.frameId, exc)
                await websocket.send_text(json.dumps({"frameId": req.frameId, "error": str(exc)}))

    except WebSocketDisconnect:
        manager.disconnect(cid)

