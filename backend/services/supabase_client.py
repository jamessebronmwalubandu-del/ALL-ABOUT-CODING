import asyncio
import json
import logging
import os

from dotenv import load_dotenv
from supabase import Client, create_client

from backend.schemas import AnalysisResult

logger = logging.getLogger(__name__)

# Load .env file (searches upward from current directory)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise ValueError(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables"
    )

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _save_analysis_sync(analysis: AnalysisResult) -> str:
    """
    Save analysis result to Supabase.

    Stores:
    - analysis_results table: metadata + metrics
    - particles table: individual particle data
    - size_classes table: distribution data
    """
    logger.info("Saving analysis to Supabase: id=%s particles=%d", analysis.id, len(analysis.particles))

    try:
        # Save main analysis result
        analysis_data = {
            "id": analysis.id,
            "timestamp": analysis.timestamp.isoformat(),
            "particle_count": analysis.metrics.count,
            "d10": analysis.metrics.d10,
            "d50": analysis.metrics.d50,
            "d80": analysis.metrics.d80,
            "d90": analysis.metrics.d90,
            "p80": analysis.metrics.p80,
            "f80": analysis.metrics.f80,
            "mean": analysis.metrics.mean,
            "mode": analysis.metrics.mode,
            "span": analysis.metrics.span,
            "min_size": analysis.metrics.min,
            "max_size": analysis.metrics.max,
            "cv": analysis.metrics.cv,
            "calibration": analysis.calibration.dict(),
            "settings": analysis.settings.dict(),
            "image_data_url": analysis.imageDataUrl,
        }

        response = supabase.table("analysis_results").insert(analysis_data).execute()

        if not response.data:
            raise RuntimeError("Supabase insert returned no data")

        inserted_id = response.data[0].get("id")
        if inserted_id is None:
            raise RuntimeError("Inserted analysis row did not include an id")

        logger.info("Analysis saved: id=%s", inserted_id)

        # Save particles
        if analysis.particles:
            particles_data = []
            for particle in analysis.particles:
                particles_data.append(
                    {
                        "analysis_id": analysis.id,
                        "particle_id": particle.id,
                        "area": particle.area,
                        "perimeter": particle.perimeter,
                        "diameter": particle.diameter,
                        "centroid": particle.centroid.dict(),
                        "bounding_box": particle.boundingBox.dict(),
                        "aspect_ratio": particle.aspectRatio,
                        "circularity": particle.circularity,
                    }
                )

            supabase.table("particles").insert(particles_data).execute()
            logger.info("Saved %d particles", len(particles_data))

        # Save size classes
        if analysis.sizeClasses:
            size_classes_data = []
            for sc in analysis.sizeClasses:
                size_classes_data.append(
                    {
                        "analysis_id": analysis.id,
                        "size_min": sc.sizeMin,
                        "size_max": sc.sizeMax,
                        "midpoint": sc.midpoint,
                        "count": sc.count,
                        "frequency": sc.frequency,
                        "cum_retained": sc.cumRetained,
                        "cum_passing": sc.cumPassing,
                    }
                )

            supabase.table("size_classes").insert(size_classes_data).execute()
            logger.info("Saved %d size classes", len(size_classes_data))

        return str(inserted_id)

    except Exception as exc:
        logger.exception("Failed to save analysis to Supabase")
        raise RuntimeError(f"Failed to save analysis: {str(exc)}") from exc


async def save_analysis_result(analysis: AnalysisResult) -> str:
    """
    Persist analysis result in Supabase using a worker thread.

    Args:
        analysis: Complete AnalysisResult to save

    Returns:
        Inserted analysis ID

    Raises:
        RuntimeError: If Supabase operation fails
    """
    return await asyncio.to_thread(_save_analysis_sync, analysis)