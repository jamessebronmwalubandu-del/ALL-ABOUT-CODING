# backend/app/schemas.py
"""Pydantic schemas for particle detection and calibration.

All particle measurement fields are in millimeters (mm) for consistency with
frontend expectations. Calibration settings are provided in pixels-per-mm and
are applied server-side when converting pixel measurements to mm.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class Centroid(BaseModel):
    x: float = Field(..., description="X coordinate in mm")
    y: float = Field(..., description="Y coordinate in mm")


class BoundingBox(BaseModel):
    x: float = Field(..., description="Top-left X in mm")
    y: float = Field(..., description="Top-left Y in mm")
    width: float = Field(..., description="Width in mm")
    height: float = Field(..., description="Height in mm")


class Particle(BaseModel):
    id: int
    area_mm2: float = Field(..., description="Particle area in mm^2")
    perimeter_mm: float = Field(..., description="Perimeter in mm")
    diameter_mm: float = Field(..., description="Equivalent circular diameter in mm")
    centroid: Centroid
    bounding_box: BoundingBox
    aspect_ratio: float
    circularity: float = Field(..., description="4πA / P^2 (dimensionless, 0..1)")
    confidence: Optional[float] = Field(None, description="Detection confidence (0-1)")


class CalibrationSettings(BaseModel):
    pixelsPerMm: float = Field(..., gt=0.0, description="Pixels per millimeter")
    method: Optional[str] = Field("manual")


class DetectionSettings(BaseModel):
    threshold: Optional[int] = Field(None)
    minParticleSize: int = Field(100, description="Minimum particle area in pixels")
    maxParticleSize: int = Field(500_000, description="Maximum particle area in pixels")
    blurKernel: Optional[int] = None
    useAdaptiveThreshold: Optional[bool] = None


class PSDMetrics(BaseModel):
    d10: float
    d50: float
    d80: float
    d90: float
    p80: float
    mean: float
    mode: float
    span: float
    min: float
    max: float
    count: int
    cv: float


class FrameRequest(BaseModel):
    frameId: str
    timestamp: float
    calibration: CalibrationSettings
    settings: DetectionSettings
    frame: str  # base64-encoded JPEG


class FrameResponse(BaseModel):
    frameId: str
    particles: List[Particle]
    processingTimeMs: float
    stats: Optional[dict] = None
