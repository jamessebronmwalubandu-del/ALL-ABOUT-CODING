# backend/app/detection.py
"""Particle detection module using YOLOv8.

This module provides `ParticleDetector` which encapsulates model loading,
preprocessing, inference and particle property calculation. Measurements are
returned in millimeters (mm) by applying the provided calibration.
"""
from __future__ import annotations

import time
import logging
from typing import List, Tuple

import numpy as np
import cv2

try:
    from ultralytics import YOLO
except Exception:
    YOLO = None  # will raise on init if missing

from .schemas import Particle, CalibrationSettings, DetectionSettings

logger = logging.getLogger(__name__)


class ParticleDetector:
    """Wraps YOLO model and exposes a simple process_frame API.

    Rationale: use YOLO detection boxes to approximate particles. For more
    accurate area/perimeter use instance segmentation model; this implementation
    approximates area by bbox area which is sufficient for many PSD tasks and
    remains fast.
    """

    def __init__(self, model_path: str = "yolov8n.pt", conf: float = 0.4, iou: float = 0.45, device: str = "cpu"):
        if YOLO is None:
            raise RuntimeError("ultralytics package is required but not installed")

        self.model_path = model_path
        self.conf = float(conf)
        self.iou = float(iou)
        self.device = device

        try:
            # loading model will auto-download if missing; keep this bounded
            logger.info("Loading YOLO model: %s", model_path)
            self.model = YOLO(model_path)
            # set device if provided
            try:
                self.model.fuse()
            except Exception:
                # not critical; continues
                pass
        except Exception as exc:
            logger.exception("Failed to load YOLO model: %s", exc)
            raise

    def preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """Apply lightweight preprocessing to improve detection robustness.

        Steps: convert to gray (if needed), Gaussian blur, CLAHE (adaptive
        histogram equalization) to improve contrast with variable lighting.
        """
        img = frame
        if len(img.shape) == 3 and img.shape[2] == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img

        # small blur to reduce noise while preserving edges
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)

        # CLAHE for contrast-limited adaptive histogram equalization
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(blurred)

        # convert back to BGR for YOLO which expects 3 channels
        prepped = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)
        return prepped

    def detect_with_yolo(self, image: np.ndarray, calibration: CalibrationSettings, settings: DetectionSettings) -> Tuple[List[Particle], float]:
        """Run YOLO inference and convert detections to Particle objects.

        This method filters by confidence and approximates particle area using
        bounding box area (pixels -> mm conversion via calibration.pixelsPerMm).
        """
        t0 = time.time()

        # prediction: ultralytics returns a Results object; use model.predict
        results = self.model.predict(source=image, conf=self.conf, iou=self.iou, device=self.device, verbose=False)

        particles: List[Particle] = []
        pid = 0

        for res in results:
            boxes = getattr(res, "boxes", None)
            if boxes is None:
                continue

            xyxy = boxes.xyxy.cpu().numpy() if hasattr(boxes.xyxy, "cpu") else np.array(boxes.xyxy)
            confs = boxes.conf.cpu().numpy() if hasattr(boxes.conf, "cpu") else np.array(boxes.conf)

            for i, box in enumerate(xyxy):
                conf = float(confs[i]) if i < len(confs) else 1.0
                if conf < self.conf:
                    continue

                x1, y1, x2, y2 = box.astype(float)
                w = max(1.0, x2 - x1)
                h = max(1.0, y2 - y1)

                area_pixels = w * h

                # filter by pixel area thresholds from settings
                if area_pixels < settings.minParticleSize or area_pixels > settings.maxParticleSize:
                    continue

                # convert to mm using calibration
                px_per_mm = float(calibration.pixelsPerMm)
                x_mm = x1 / px_per_mm
                y_mm = y1 / px_per_mm
                w_mm = w / px_per_mm
                h_mm = h / px_per_mm

                area_mm2 = (area_pixels) / (px_per_mm * px_per_mm)
                perimeter_mm = 2.0 * (w_mm + h_mm)
                diameter_mm = 2.0 * np.sqrt(max(0.0, area_mm2) / np.pi)
                aspect_ratio = float(w_mm / max(1e-6, h_mm))
                circularity = float((4.0 * np.pi * area_mm2) / max(1e-6, perimeter_mm * perimeter_mm))

                particle = Particle(
                    id=pid,
                    area_mm2=round(float(area_mm2), 3),
                    perimeter_mm=round(float(perimeter_mm), 3),
                    diameter_mm=round(float(diameter_mm), 3),
                    centroid={"x": round(float(x_mm + w_mm / 2.0), 3), "y": round(float(y_mm + h_mm / 2.0), 3)},
                    bounding_box={"x": round(float(x_mm), 3), "y": round(float(y_mm), 3), "width": round(float(w_mm), 3), "height": round(float(h_mm), 3)},
                    aspect_ratio=round(aspect_ratio, 3),
                    circularity=round(min(max(circularity, 0.0), 1.0), 3),
                    confidence=round(conf, 3),
                )
                particles.append(particle)
                pid += 1

        t1 = time.time()
        processing_time_ms = (t1 - t0) * 1000.0
        return particles, processing_time_ms

    def process_frame(self, frame: np.ndarray, calibration: CalibrationSettings, settings: DetectionSettings) -> Tuple[List[Particle], float]:
        """Full processing pipeline: preprocess → detect → postprocess.

        Returns list of `Particle` Pydantic objects and processing time in ms.
        """
        t_start = time.time()
        prepped = self.preprocess_frame(frame)
        particles, infer_ms = self.detect_with_yolo(prepped, calibration, settings)
        total_ms = (time.time() - t_start) * 1000.0
        logger.info("Processed frame: particles=%d total_ms=%.2f infer_ms=%.2f", len(particles), total_ms, infer_ms)
        return particles, total_ms
