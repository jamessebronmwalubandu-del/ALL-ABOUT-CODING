export interface ImageAnalysisResponse {
  id: string;
  particleCount: number;
  particles: Array<{
    id: number;
    area: number;
    perimeter: number;
    diameter: number;
    centroid: { x: number; y: number };
    boundingBox: { x: number; y: number; width: number; height: number };
    aspectRatio: number;
    circularity: number;
  }>;
  metrics: {
    d10: number;
    d50: number;
    d80: number;
    d90: number;
    p80: number;
    f80: number;
    mean: number;
    mode: number;
    span: number;
    min: number;
    max: number;
    count: number;
    cv: number;
    reductionRatio: number;
  };
  sizeClasses: Array<{
    sizeMin: number;
    sizeMax: number;
    midpoint: number;
    count: number;
    frequency: number;
    cumRetained: number;
    cumPassing: number;
  }>;
  timestamp: string;
}

export interface ImageAnalysisParams {
  calibration: {
    pixelsPerMm: number;
    method: 'manual' | 'reference';
    referenceObjectSize?: number;
    referenceObjectPixels?: number;
  };
  settings: {
    threshold: number;
    minParticleSize: number;
    maxParticleSize: number;
    blurKernel: number;
    cannyLow: number;
    cannyHigh: number;
    adaptiveBlockSize: number;
    adaptiveC: number;
    morphKernel: number;
    useAdaptiveThreshold: boolean;
    invertImage: boolean;
  };
}

function mapImageAnalysisError(detail: string): string {
  const normalized = detail.trim().toLowerCase();

  if (!normalized) {
    return 'Unable to analyze the image.';
  }
  if (normalized.includes('invalid image type')) {
    return 'Unsupported image type. Use JPEG, PNG, BMP, or TIFF.';
  }
  if (normalized.includes('image file is empty')) {
    return 'The uploaded image file is empty.';
  }
  if (normalized.includes('image exceeds')) {
    return 'The image is too large. Please upload a smaller file.';
  }
  if (normalized.includes('invalid calibration_json')) {
    return 'Calibration settings are invalid JSON.';
  }
  if (normalized.includes('invalid calibration settings')) {
    return 'Calibration settings are invalid.';
  }
  if (normalized.includes('invalid settings_json')) {
    return 'Detection settings are invalid JSON.';
  }
  if (normalized.includes('invalid detection settings')) {
    return 'Detection settings are invalid.';
  }
  if (normalized.includes('no particles detected')) {
    return 'No particles were detected in the image. Adjust your detection settings.';
  }
  if (normalized.includes('failed to analyze image')) {
    return 'The server failed to analyze the image.';
  }

  return detail;
}

export async function analyzeImage(
  file: File,
  params: ImageAnalysisParams
): Promise<ImageAnalysisResponse> {
  const rawBaseUrl = process.env.NEXT_PUBLIC_FASTAPI_URL;
  const baseUrl = (rawBaseUrl || 'http://localhost:8000').replace(/\/+$/, '');
  const url = `${baseUrl}/api/analyze/image`;

  const formData = new FormData();
  formData.append('image', file);
  formData.append('calibration_json', JSON.stringify(params.calibration));
  formData.append('settings_json', JSON.stringify(params.settings));

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to reach the image analysis backend.';
    throw new Error(
      `Failed to fetch image analysis from ${url}. ${message}`
    );
  }

  if (!response.ok) {
    let message = 'Failed to analyze image.';
    try {
      const errorData = await response.json();
      if (errorData?.detail) {
        message = mapImageAnalysisError(String(errorData.detail));
      }
    } catch {
      // Keep default if non-JSON response.
    }
    throw new Error(message);
  }

  return (await response.json()) as ImageAnalysisResponse;
}
