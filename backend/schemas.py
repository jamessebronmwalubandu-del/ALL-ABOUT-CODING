from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


CalibrationMethod = Literal["manual", "reference"]


class Centroid(BaseModel):
    """Particle centroid coordinates in pixels."""
    x: float
    y: float


class BoundingBox(BaseModel):
    """Particle bounding box in pixels."""
    x: float
    y: float
    width: float
    height: float


class Particle(BaseModel):
    """Individual particle detected from image."""

    id: int
    area: float = Field(gt=0, description="Particle area in pixels²")
    perimeter: float = Field(gt=0, description="Particle perimeter in pixels")
    diameter: float = Field(gt=0, description="Equivalent circular diameter in mm (after calibration)")
    centroid: Centroid
    boundingBox: BoundingBox
    aspectRatio: float = Field(ge=0, le=1, description="Width/height ratio")
    circularity: float = Field(ge=0, le=1, description="4*π*area/perimeter² - measure of roundness")


class PSDMetrics(BaseModel):
    """Particle Size Distribution metrics from image analysis."""

    d10: float = Field(ge=0, description="10% cumulative passing size (mm)")
    d50: float = Field(ge=0, description="50% cumulative passing size - median (mm)")
    d80: float = Field(ge=0, description="80% cumulative passing size (mm)")
    d90: float = Field(ge=0, description="90% cumulative passing size (mm)")
    p80: float = Field(ge=0, description="80% passing size - metallurgical notation (mm)")
    f80: float = Field(ge=0, description="Feed 80% passing for work index (mm)")
    reductionRatio: float = Field(ge=0, description="F80/P80 reduction ratio")
    mean: float = Field(ge=0, description="Arithmetic mean particle size (mm)")
    mode: float = Field(ge=0, description="Most frequent particle size (mm)")
    span: float = Field(ge=0, description="(d90-d10)/d50 - distribution spread")
    min: float = Field(ge=0, description="Minimum particle size (mm)")
    max: float = Field(ge=0, description="Maximum particle size (mm)")
    count: int = Field(ge=0, description="Total particle count")
    cv: float = Field(ge=0, description="Coefficient of variation (%)")


class SizeClass(BaseModel):
    """Size class bin for PSD distribution."""

    sizeMin: float = Field(ge=0, description="Lower bound of size class (mm)")
    sizeMax: float = Field(ge=0, description="Upper bound of size class (mm)")
    midpoint: float = Field(ge=0, description="Midpoint of size class (mm)")
    count: int = Field(ge=0, description="Number of particles in class")
    frequency: float = Field(ge=0, le=100, description="Percentage frequency (%)")
    cumRetained: float = Field(ge=0, le=100, description="Cumulative % retained")
    cumPassing: float = Field(ge=0, le=100, description="Cumulative % passing")


class CalibrationSettings(BaseModel):
    """Calibration parameters for pixel-to-mm conversion."""

    pixelsPerMm: float = Field(gt=0, description="Conversion factor: pixels per mm")
    method: CalibrationMethod = Field(description="Calibration method: manual or reference object")
    referenceObjectSize: float | None = Field(default=None, ge=0, description="Reference object size in mm")
    referenceObjectPixels: float | None = Field(default=None, gt=0, description="Reference object measured size in pixels")


class DetectionSettings(BaseModel):
    """Image processing parameters for particle detection."""

    threshold: int = Field(ge=0, le=255, description="Binary threshold value (0-255)")
    minParticleSize: int = Field(gt=0, description="Minimum particle area (pixels²)")
    maxParticleSize: int = Field(gt=0, description="Maximum particle area (pixels²)")
    blurKernel: int = Field(ge=1, description="Gaussian blur kernel size (odd number)")
    cannyLow: int = Field(ge=0, le=255, description="Canny edge low threshold")
    cannyHigh: int = Field(ge=0, le=255, description="Canny edge high threshold")
    adaptiveBlockSize: int = Field(ge=1, description="Adaptive threshold block size (odd number)")
    adaptiveC: float = Field(description="Adaptive threshold constant")
    morphKernel: int = Field(ge=1, description="Morphological operations kernel size")
    useAdaptiveThreshold: bool = Field(description="Use adaptive thresholding instead of fixed")
    invertImage: bool = Field(description="Invert image for dark particles on light background")


class AnalysisResult(BaseModel):
    """Complete image-based particle size distribution analysis result."""

    id: str = Field(description="Unique analysis ID (UUID)")
    timestamp: datetime = Field(description="Analysis timestamp")
    particles: list[Particle] = Field(default_factory=list, description="Detected particles")
    metrics: PSDMetrics = Field(description="Computed PSD metrics")
    sizeClasses: list[SizeClass] = Field(default_factory=list, description="Size class distribution")
    imageDataUrl: str | None = Field(default=None, description="Base64 encoded processed image")
    settings: DetectionSettings = Field(description="Detection settings used")
    calibration: CalibrationSettings = Field(description="Calibration settings used")

    @field_validator("particles")
    @classmethod
    def validate_particles_not_empty(cls, value: list[Particle]) -> list[Particle]:
        """At least one particle must be detected."""
        if len(value) == 0:
            raise ValueError("At least one particle must be detected in image")
        return value

    @field_validator("sizeClasses")
    @classmethod
    def validate_size_classes(cls, value: list[SizeClass], info) -> list[SizeClass]:
        """Size classes must be consistent with particles."""
        if len(value) == 0:
            raise ValueError("Size classes must be generated from particle analysis")
        return value


class ImageAnalysisRequest(BaseModel):
    """Request model for image-based particle analysis."""

    # Image file is sent as multipart/form-data (not in this model)
    calibration: CalibrationSettings = Field(description="Calibration settings")
    settings: DetectionSettings = Field(description="Detection settings")


class ImageAnalysisResponse(BaseModel):
    """Response model for successful image analysis."""

    id: str = Field(description="Analysis result ID")
    particleCount: int = Field(ge=0, description="Number of particles detected")
    particles: list[Particle] = Field(description="Detected particle measurements")
    metrics: PSDMetrics = Field(description="Computed metrics")
    sizeClasses: list[SizeClass] = Field(description="Size class distribution")
    timestamp: datetime = Field(description="Analysis timestamp")


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str = Field(description="Error message")
    code: str = Field(description="Error code")
