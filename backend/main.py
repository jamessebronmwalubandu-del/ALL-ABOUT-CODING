import json
import logging
import os
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from backend.schemas import (
    AnalysisResult,
    CalibrationSettings,
    DetectionSettings,
    ErrorResponse,
    ImageAnalysisResponse,
)
from backend.services.psd_service import analyze_particle_image

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())
logger = logging.getLogger(__name__)

MAX_IMAGE_SIZE_MB = 50  # 50MB limit for image uploads


def _build_cors_origins() -> list[str]:
    """Build CORS origins from environment configuration."""
    configured = os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    if "http://localhost:3000" not in origins:
        origins.append("http://localhost:3000")
    if "http://127.0.0.1:3000" not in origins:
        origins.append("http://127.0.0.1:3000")
    return origins


app = FastAPI(
    title="Particle Size Distribution Image Analysis API",
    version="2.0.0",
    description="Backend for image-based particle detection and PSD analysis",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["System"])
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": "PSD Image Analysis API"}


@app.post(
    "/api/analyze/image",
    response_model=ImageAnalysisResponse,
    tags=["Analysis"],
    responses={
        400: {"model": ErrorResponse, "description": "Invalid image or parameters"},
        413: {"model": ErrorResponse, "description": "Image too large"},
        422: {"model": ErrorResponse, "description": "Validation error"},
        500: {"model": ErrorResponse, "description": "Analysis failed"},
    },
)
async def analyze_image_endpoint(
    image: UploadFile = File(
        ..., description="Image file (JPEG, PNG, BMP, TIFF)"
    ),
    calibration_json: str = Form(
        ...,
        description="CalibrationSettings as JSON: {pixelsPerMm, method, referenceObjectSize?, referenceObjectPixels?}",
    ),
    settings_json: str = Form(
        ...,
        description="DetectionSettings as JSON: {threshold, minParticleSize, maxParticleSize, blurKernel, cannyLow, cannyHigh, adaptiveBlockSize, adaptiveC, morphKernel, useAdaptiveThreshold, invertImage}",
    ),
) -> ImageAnalysisResponse:
    """
    Analyze a particle image for size distribution.

    - **image**: Image file containing particles (JPEG, PNG, BMP, TIFF)
    - **calibration_json**: Calibration settings for pixel-to-mm conversion
    - **settings_json**: Detection settings for particle segmentation

    Returns detected particles, computed metrics, size classes, and analysis metadata.
    """
    logger.info(
        "Received image analysis request: filename=%s content_type=%s",
        image.filename,
        image.content_type,
    )

    # Validate image file
    if not image.filename:
        raise HTTPException(status_code=400, detail="Image filename is required")

    allowed_types = {"image/jpeg", "image/png", "image/bmp", "image/tiff"}
    if image.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image type: {image.content_type}. Allowed: {', '.join(allowed_types)}",
        )

    # Read image bytes
    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image file is empty")

    max_bytes = MAX_IMAGE_SIZE_MB * 1024 * 1024
    if len(image_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Image exceeds {MAX_IMAGE_SIZE_MB}MB size limit",
        )

    # Parse calibration settings
    try:
        calibration_dict = json.loads(calibration_json)
        calibration = CalibrationSettings(**calibration_dict)
        logger.debug(
            "Calibration settings parsed: method=%s pixelsPerMm=%s",
            calibration.method,
            calibration.pixelsPerMm,
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422, detail="Invalid calibration_json: not valid JSON"
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=f"Invalid calibration settings: {str(exc)}"
        ) from exc

    # Parse detection settings
    try:
        settings_dict = json.loads(settings_json)
        settings = DetectionSettings(**settings_dict)
        logger.debug(
            "Detection settings parsed: threshold=%s minParticleSize=%s maxParticleSize=%s",
            settings.threshold,
            settings.minParticleSize,
            settings.maxParticleSize,
        )
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=422, detail="Invalid settings_json: not valid JSON"
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=422, detail=f"Invalid detection settings: {str(exc)}"
        ) from exc

    # Perform analysis
    try:
        analysis_result: AnalysisResult = await analyze_particle_image(
            image_bytes=image_bytes,
            filename=image.filename,
            calibration=calibration,
            settings=settings,
        )

        logger.info(
            "Image analysis success: particles_detected=%d d50=%.2f timestamp=%s",
            analysis_result.metrics.count,
            analysis_result.metrics.d50,
            analysis_result.timestamp,
        )

        return ImageAnalysisResponse(
            id=analysis_result.id,
            particleCount=analysis_result.metrics.count,
            particles=analysis_result.particles,
            metrics=analysis_result.metrics,
            sizeClasses=analysis_result.sizeClasses,
            timestamp=analysis_result.timestamp,
        )

    except ValueError as exc:
        logger.warning("Image analysis validation failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Image analysis failed unexpectedly")
        raise HTTPException(
            status_code=500, detail="Failed to analyze image"
        ) from exc


@app.get("/api/calibration/defaults", tags=["Configuration"])
async def get_default_calibration() -> dict:
    """Get default calibration settings for image analysis."""
    return {
        "pixelsPerMm": 10.0,
        "method": "manual",
        "referenceObjectSize": None,
        "referenceObjectPixels": None,
    }


@app.get("/api/detection/defaults", tags=["Configuration"])
async def get_default_detection_settings() -> dict:
    """Get default detection settings optimized for crushing circuit analysis."""
    return {
        "threshold": 127,
        "minParticleSize": 100,
        "maxParticleSize": 500000,
        "blurKernel": 5,
        "cannyLow": 50,
        "cannyHigh": 150,
        "adaptiveBlockSize": 11,
        "adaptiveC": 2,
        "morphKernel": 3,
        "useAdaptiveThreshold": True,
        "invertImage": False,
    }


@app.post("/api/analyze/save", tags=["Storage"])
async def save_analysis_endpoint(analysis: AnalysisResult) -> dict[str, str]:
    """
    Save analysis result to Supabase.

    This endpoint persists the complete particle analysis including detected particles,
    computed metrics, and size classes.
    """
    logger.info(
        "Received save analysis request: id=%s particles=%d",
        analysis.id,
        analysis.metrics.count,
    )

    try:
        from backend.services.supabase_client import save_analysis_result

        saved_id = await save_analysis_result(analysis)
        logger.info("Analysis saved to Supabase: id=%s", saved_id)
        return {
            "id": saved_id,
            "message": "Analysis result saved successfully",
            "timestamp": analysis.timestamp.isoformat(),
        }

    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured on the backend",
        ) from exc
    except ValueError as exc:
        logger.warning("Save analysis validation failed: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Save analysis failed unexpectedly")
        raise HTTPException(
            status_code=500, detail="Failed to save analysis result"
        ) from exc
