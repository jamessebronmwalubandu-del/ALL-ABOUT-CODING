import asyncio
import base64
import io
import logging
import uuid
from datetime import datetime

import cv2
import numpy as np
from backend.schemas import (
    AnalysisResult,
    BoundingBox,
    CalibrationSettings,
    Centroid,
    DetectionSettings,
    Particle,
    PSDMetrics,
    SizeClass,
)

logger = logging.getLogger(__name__)

# Standard size classes (Tyler mesh equivalents in mm)
STANDARD_SIZE_CLASSES = [
    150, 125, 106, 90, 75, 63, 53, 45, 37.5, 31.5,
    26.5, 22.4, 19, 16, 13.2, 11.2, 9.5, 8, 6.7, 5.6,
    4.75, 4, 3.35, 2.8, 2.36, 2, 1.7, 1.4, 1.18, 1,
    0.85, 0.71, 0.6, 0.5, 0.425, 0.355, 0.3, 0.25,
    0.212, 0.18, 0.15, 0.125, 0.106, 0.09, 0.075, 0.063, 0.053, 0.045,
]


def _load_image(image_bytes: bytes, filename: str) -> np.ndarray:
    """
    Load image from bytes.

    Supports: JPEG, PNG, BMP, TIFF

    Args:
        image_bytes: Raw image file bytes
        filename: Original filename (for logging)

    Returns:
        BGR image array (OpenCV format)

    Raises:
        ValueError: If image cannot be decoded
    """
    logger.debug("Loading image: filename=%s size_bytes=%s", filename, len(image_bytes))

    try:
        # Decode image from bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Failed to decode image - file may be corrupted")

        if len(image.shape) != 3 or image.shape[2] != 3:
            raise ValueError("Image must be in color format (3 channels)")

        logger.debug(
            "Image loaded successfully: shape=%s dtype=%s",
            image.shape,
            image.dtype,
        )
        return image

    except Exception as exc:
        logger.exception("Failed to load image")
        raise ValueError(f"Failed to load image: {str(exc)}") from exc


def _build_threshold_mask(
    blurred: np.ndarray,
    settings: DetectionSettings,
) -> np.ndarray:
    if settings.useAdaptiveThreshold:
        block_size = settings.adaptiveBlockSize if settings.adaptiveBlockSize % 2 == 1 else settings.adaptiveBlockSize + 1
        thresh = cv2.adaptiveThreshold(
            blurred,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            block_size,
            settings.adaptiveC,
        )
        logger.debug("Applied adaptive threshold: blockSize=%d C=%s invert=%s", block_size, settings.adaptiveC, settings.invertImage)
        if settings.invertImage:
            thresh = cv2.bitwise_not(thresh)
        return thresh

    threshold_type = cv2.THRESH_BINARY_INV if settings.invertImage else cv2.THRESH_BINARY
    _, thresh = cv2.threshold(blurred, settings.threshold, 255, threshold_type)
    logger.debug("Applied fixed threshold: value=%d invert=%s", settings.threshold, settings.invertImage)
    return thresh


def _build_fallback_mask(
    blurred: np.ndarray,
    settings: DetectionSettings,
) -> np.ndarray:
    if settings.useAdaptiveThreshold:
        block_size = settings.adaptiveBlockSize if settings.adaptiveBlockSize % 2 == 1 else settings.adaptiveBlockSize + 1
        thresh = cv2.adaptiveThreshold(
            blurred,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY_INV,
            block_size,
            settings.adaptiveC,
        )
        logger.debug("Applied fallback adaptive threshold (inverted): blockSize=%d C=%s", block_size, settings.adaptiveC)
    else:
        _, thresh = cv2.threshold(
            blurred,
            0,
            255,
            cv2.THRESH_BINARY + cv2.THRESH_OTSU,
        )
        logger.debug("Applied fallback Otsu threshold: invert=%s", settings.invertImage)
        if settings.invertImage:
            thresh = cv2.bitwise_not(thresh)

    return thresh


def _merge_canny_edges(
    thresh: np.ndarray,
    blurred: np.ndarray,
    settings: DetectionSettings,
) -> np.ndarray:
    if settings.cannyLow > 0 and settings.cannyHigh > 0:
        edges = cv2.Canny(blurred, settings.cannyLow, settings.cannyHigh)
        thresh = cv2.bitwise_or(thresh, edges)
        logger.debug("Merged Canny edges into threshold mask: low=%d high=%d", settings.cannyLow, settings.cannyHigh)
    return thresh


def _morphological_cleanup(
    mask: np.ndarray,
    morph_kernel: int,
) -> np.ndarray:
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (morph_kernel, morph_kernel))
    morphed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    morphed = cv2.morphologyEx(morphed, cv2.MORPH_OPEN, kernel)
    logger.debug("Applied morphological operations: kernel=%d", morph_kernel)
    return morphed


def _detect_particles(
    image: np.ndarray,
    settings: DetectionSettings,
) -> list[dict]:
    """
    Detect particles in image using contour detection.

    Pipeline:
    1. Convert to grayscale
    2. Optional: invert image
    3. Apply blur for noise reduction
    4. Apply threshold (adaptive or fixed)
    5. Morphological operations
    6. Find contours
    7. Filter by size

    Args:
        image: BGR image array
        settings: Detection settings

    Returns:
        List of particle dicts with contour info
    """
    logger.debug("Starting particle detection with settings: %s", settings.dict())

    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    logger.debug("Converted to grayscale: shape=%s", gray.shape)

    # Apply blur
    blur_kernel = settings.blurKernel if settings.blurKernel % 2 == 1 else settings.blurKernel + 1
    blurred = cv2.GaussianBlur(gray, (blur_kernel, blur_kernel), 0)
    logger.debug("Applied Gaussian blur: kernel=%d", blur_kernel)

    # Apply threshold and optionally merge edges
    thresh = _build_threshold_mask(blurred, settings)
    thresh = _merge_canny_edges(thresh, blurred, settings)
    morphed = _morphological_cleanup(thresh, settings.morphKernel)

    contours, _ = cv2.findContours(morphed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    logger.debug("Found %d contours on primary mask", len(contours))

    particles = []
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        if area < settings.minParticleSize or area > settings.maxParticleSize:
            continue
        particles.append({
            "id": i,
            "contour": contour,
            "area": area,
        })

    if not particles:
        logger.info("No particles found on primary threshold. Trying fallback thresholding.")
        fallback_thresh = _build_fallback_mask(blurred, settings)
        fallback_thresh = _merge_canny_edges(fallback_thresh, blurred, settings)
        morphed_fallback = _morphological_cleanup(fallback_thresh, settings.morphKernel)

        contours, _ = cv2.findContours(morphed_fallback, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        logger.debug("Found %d contours on fallback mask", len(contours))

        for i, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            if area < settings.minParticleSize or area > settings.maxParticleSize:
                continue
            particles.append({
                "id": i,
                "contour": contour,
                "area": area,
            })

    logger.info("Detected particles after filtering: count=%d", len(particles))
    if len(particles) == 0:
        raise ValueError(
        "No particles detected in image. Try adjusting threshold mode, invertImage, or min/max particle size settings."
    )

    return particles


def _extract_particle_properties(
    contour: np.ndarray,
    area: float,
    pixel_scale: float,  # mm per pixel
) -> dict:
    """
    Extract properties from particle contour.

    Args:
        contour: OpenCV contour
        area: Particle area in pixels²
        pixel_scale: Conversion factor (mm per pixel)

    Returns:
        Dict with particle properties
    """
    # Perimeter
    perimeter = cv2.arcLength(contour, True)

    # Bounding box
    x, y, w, h = cv2.boundingRect(contour)

    # Centroid
    m = cv2.moments(contour)
    if m["m00"] != 0:
        cx = m["m10"] / m["m00"]
        cy = m["m01"] / m["m00"]
    else:
        cx = x + w / 2
        cy = y + h / 2

    # Aspect ratio
    aspect_ratio = float(w) / h if h > 0 else 1.0
    aspect_ratio = min(aspect_ratio, 1.0 / aspect_ratio)  # Always <= 1

    # Circularity: 4*π*area / perimeter²
    if perimeter > 0:
        circularity = (4 * np.pi * area) / (perimeter ** 2)
        circularity = min(circularity, 1.0)  # Clamp to [0, 1]
    else:
        circularity = 0.0

    # Equivalent circular diameter (mm)
    diameter_px = 2 * np.sqrt(area / np.pi)
    diameter_mm = diameter_px * pixel_scale

    return {
        "perimeter": perimeter,
        "centroid": {"x": float(cx), "y": float(cy)},
        "boundingBox": {"x": float(x), "y": float(y), "width": float(w), "height": float(h)},
        "aspectRatio": float(aspect_ratio),
        "circularity": float(circularity),
        "diameter": float(diameter_mm),
    }


def _compute_psd_metrics(diameters: np.ndarray) -> PSDMetrics:
    """
    Compute PSD metrics from particle diameters.

    Args:
        diameters: Array of particle diameters in mm

    Returns:
        PSDMetrics object
    """
    logger.debug("Computing PSD metrics from %d particles", len(diameters))

    if len(diameters) == 0:
        raise ValueError("No particles to compute metrics")

    # Sort diameters in ascending order
    sorted_diameters = np.sort(diameters)

    # Compute percentile sizes
    d10 = float(np.percentile(sorted_diameters, 10))
    d50 = float(np.percentile(sorted_diameters, 50))
    d80 = float(np.percentile(sorted_diameters, 80))
    d90 = float(np.percentile(sorted_diameters, 90))

    # p80 and f80 are same as d80 in standard PSD sample analysis
    p80 = d80
    f80 = d80  # Feed 80% in work index calculations
    reduction_ratio = float(f80 / p80) if p80 > 0 else 0.0

    # Mean and mode
    mean = float(np.mean(sorted_diameters))
    
    # Mode: most frequent bin
    hist, bin_edges = np.histogram(sorted_diameters, bins=50)
    mode_bin = np.argmax(hist)
    mode = float((bin_edges[mode_bin] + bin_edges[mode_bin + 1]) / 2)

    # Span: (d90 - d10) / d50
    if d50 > 0:
        span = float((d90 - d10) / d50)
    else:
        span = 0.0

    # Min and max
    min_size = float(np.min(sorted_diameters))
    max_size = float(np.max(sorted_diameters))

    # Coefficient of variation: (std / mean) * 100
    std = float(np.std(sorted_diameters))
    if mean > 0:
        cv = float((std / mean) * 100)
    else:
        cv = 0.0

    metrics = PSDMetrics(
        d10=d10,
        d50=d50,
        d80=d80,
        d90=d90,
        p80=p80,
        f80=f80,
        reductionRatio=reduction_ratio,
        mean=mean,
        mode=mode,
        span=span,
        min=min_size,
        max=max_size,
        count=len(sorted_diameters),
        cv=cv,
    )

    logger.info(
        "Metrics computed: d10=%.2f d50=%.2f d80=%.2f d90=%.2f span=%.2f cv=%.2f",
        metrics.d10,
        metrics.d50,
        metrics.d80,
        metrics.d90,
        metrics.span,
        metrics.cv,
    )

    return metrics


def _generate_size_classes(diameters: np.ndarray) -> list[SizeClass]:
    """
    Generate size class distribution using standard Tyler mesh sizes.

    Args:
        diameters: Array of particle diameters in mm

    Returns:
        List of SizeClass objects
    """
    logger.debug("Generating size classes for %d particles", len(diameters))

    # Filter size classes to relevant range
    min_diam = np.min(diameters)
    max_diam = np.max(diameters)
    
    # Include a few classes above and below for context
    relevant_classes = [s for s in STANDARD_SIZE_CLASSES if min_diam * 0.5 <= s <= max_diam * 2]
    
    if not relevant_classes:
        relevant_classes = STANDARD_SIZE_CLASSES[:20]  # Default to larger classes

    size_classes = []

    for i in range(len(relevant_classes) - 1):
        size_max = relevant_classes[i]
        size_min = relevant_classes[i + 1]
        
        # Count particles in this class
        count = np.sum((diameters >= size_min) & (diameters < size_max))
        
        if count == 0:
            continue  # Skip empty classes

        midpoint = (size_min + size_max) / 2
        frequency = (count / len(diameters)) * 100

        size_classes.append(
            SizeClass(
                sizeMin=float(size_min),
                sizeMax=float(size_max),
                midpoint=float(midpoint),
                count=int(count),
                frequency=float(frequency),
                cumRetained=0.0,  # Will be computed below
                cumPassing=0.0,  # Will be computed below
            )
        )

    # Sort by size (ascending)
    size_classes.sort(key=lambda x: x.sizeMax, reverse=True)

    # Compute cumulative values
    total_count = sum(sc.count for sc in size_classes)
    cum_retained = 0.0
    
    for sc in size_classes:
        cum_retained += sc.frequency
        sc.cumRetained = cum_retained
        sc.cumPassing = 100.0 - cum_retained

    logger.info("Generated %d size classes", len(size_classes))
    return size_classes


def detect_particles(
    image: np.ndarray,
    settings: DetectionSettings,
) -> list[dict]:
    """Detect particle contours from an image using configured settings."""
    return _detect_particles(image, settings)


def compute_metrics(
    particles: list[Particle],
) -> PSDMetrics:
    """Compute PSD metrics from a list of detected particle objects."""
    diameters = np.array([particle.diameter for particle in particles], dtype=float)
    return _compute_psd_metrics(diameters)


def classify_sizes(
    particles: list[Particle],
) -> list[SizeClass]:
    """Classify detected particles into standard size classes."""
    diameters = np.array([particle.diameter for particle in particles], dtype=float)
    return _generate_size_classes(diameters)


def _encode_image_to_base64(image: np.ndarray) -> str:
    """
    Encode image to base64 data URL.

    Args:
        image: BGR image array

    Returns:
        Base64 data URL string
    """
    _, buffer = cv2.imencode(".png", image)
    img_str = base64.b64encode(buffer).decode()
    return f"data:image/png;base64,{img_str}"


async def analyze_particle_image(
    image_bytes: bytes,
    filename: str,
    calibration: CalibrationSettings,
    settings: DetectionSettings,
) -> AnalysisResult:
    """
    Perform complete image-based particle size distribution analysis.

    Pipeline:
    1. Load image
    2. Detect particles
    3. Extract particle properties
    4. Compute PSD metrics
    5. Generate size classes
    6. Package results

    Args:
        image_bytes: Raw image file bytes
        filename: Original filename
        calibration: Calibration settings
        settings: Detection settings

    Returns:
        AnalysisResult with particles, metrics, size classes

    Raises:
        ValueError: If analysis fails
    """
    logger.info(
        "Starting particle analysis: filename=%s calibration=%s settings=%s",
        filename,
        calibration.dict(),
        settings.dict(),
    )

    # Run analysis in thread to avoid blocking
    result = await asyncio.to_thread(
        _analyze_particle_image_sync,
        image_bytes,
        filename,
        calibration,
        settings,
    )

    return result


def _analyze_particle_image_sync(
    image_bytes: bytes,
    filename: str,
    calibration: CalibrationSettings,
    settings: DetectionSettings,
) -> AnalysisResult:
    """Synchronous particle analysis (runs in thread pool)."""

    # Load image
    image = _load_image(image_bytes, filename)

    # Detect particles
    detected_particles = _detect_particles(image, settings)

    # Extract particle properties
    pixel_scale = 1.0 / calibration.pixelsPerMm  # mm per pixel
    particles: list[Particle] = []

    diameters = np.zeros(len(detected_particles))

    for idx, detected in enumerate(detected_particles):
        props = _extract_particle_properties(
            detected["contour"],
            detected["area"],
            pixel_scale,
        )

        particle = Particle(
            id=idx,
            area=detected["area"],
            perimeter=props["perimeter"],
            diameter=props["diameter"],
            centroid=Centroid(**props["centroid"]),
            boundingBox=BoundingBox(**props["boundingBox"]),
            aspectRatio=props["aspectRatio"],
            circularity=props["circularity"],
        )

        particles.append(particle)
        diameters[idx] = particle.diameter

    # Compute PSD metrics
    metrics = _compute_psd_metrics(diameters)

    # Generate size classes
    size_classes = _generate_size_classes(diameters)

    # Encode processed image
    image_data_url = _encode_image_to_base64(image)

    # Create analysis result
    analysis_id = str(uuid.uuid4())
    timestamp = datetime.utcnow()

    result = AnalysisResult(
        id=analysis_id,
        timestamp=timestamp,
        particles=particles,
        metrics=metrics,
        sizeClasses=size_classes,
        imageDataUrl=image_data_url,
        settings=settings,
        calibration=calibration,
    )

    logger.info(
        "Analysis complete: id=%s particles=%d d50=%.2f d80=%.2f",
        analysis_id,
        metrics.count,
        metrics.d50,
        metrics.d80,
    )

    return result
