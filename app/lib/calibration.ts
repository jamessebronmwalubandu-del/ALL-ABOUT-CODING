// Calibration utilities for scale conversion
import type { CalibrationSettings } from './types';

/**
 * Standard reference objects and their sizes in mm
 */
export const REFERENCE_OBJECTS = {
  'credit-card-width': { name: 'Credit Card (width)', size: 85.6 },
  'credit-card-height': { name: 'Credit Card (height)', size: 53.98 },
  'us-quarter': { name: 'US Quarter', size: 24.26 },
  'us-dime': { name: 'US Dime', size: 17.91 },
  'us-nickel': { name: 'US Nickel', size: 21.21 },
  'ruler-10cm': { name: '10cm Ruler Mark', size: 100 },
  'ruler-5cm': { name: '5cm Ruler Mark', size: 50 },
  'ruler-1cm': { name: '1cm Ruler Mark', size: 10 },
  'a4-short': { name: 'A4 Paper (short edge)', size: 210 },
  'a4-long': { name: 'A4 Paper (long edge)', size: 297 },
  'golf-ball': { name: 'Golf Ball', size: 42.67 },
  'tennis-ball': { name: 'Tennis Ball', size: 67 },
  'custom': { name: 'Custom Size', size: 0 },
} as const;

export type ReferenceObjectKey = keyof typeof REFERENCE_OBJECTS;

/**
 * Calculate pixels per mm from a reference object measurement
 */
export function calculateCalibrationFromReference(
  referencePixels: number,
  referenceObjectSize: number
): number {
  if (referenceObjectSize === 0) return 10; // Default fallback
  return referencePixels / referenceObjectSize;
}

/**
 * Calculate pixels per mm from camera distance and sensor specs
 * This is a more technical calibration method
 */
export function calculateCalibrationFromCamera(
  sensorWidth: number, // mm
  focalLength: number, // mm
  distanceToSubject: number, // mm
  imageWidthPixels: number
): number {
  // Field of view width = (sensor width * distance) / focal length
  const fieldOfViewWidth = (sensorWidth * distanceToSubject) / focalLength;
  return imageWidthPixels / fieldOfViewWidth;
}

/**
 * Create calibration settings from manual input
 */
export function createManualCalibration(pixelsPerMm: number): CalibrationSettings {
  return {
    pixelsPerMm,
    method: 'manual',
  };
}

/**
 * Create calibration settings from reference object measurement
 */
export function createReferenceCalibration(
  measuredPixels: number,
  referenceSize: number
): CalibrationSettings {
  const pixelsPerMm = calculateCalibrationFromReference(measuredPixels, referenceSize);
  return {
    pixelsPerMm,
    method: 'reference',
    referenceObjectSize: referenceSize,
    referenceObjectPixels: measuredPixels,
  };
}

/**
 * Convert pixel measurement to mm
 */
export function pixelsToMm(pixels: number, calibration: CalibrationSettings): number {
  return pixels / calibration.pixelsPerMm;
}

/**
 * Convert pixel area to mm²
 */
export function pixelAreaToMm2(pixelArea: number, calibration: CalibrationSettings): number {
  return pixelArea / (calibration.pixelsPerMm * calibration.pixelsPerMm);
}

/**
 * Convert mm to pixels
 */
export function mmToPixels(mm: number, calibration: CalibrationSettings): number {
  return mm * calibration.pixelsPerMm;
}

/**
 * Estimate camera working distance from known reference
 */
export function estimateWorkingDistance(
  referencePixels: number,
  referenceSizeMm: number,
  sensorWidthMm: number = 6.17, // typical 1/2.3" sensor
  focalLengthMm: number = 4.5, // typical webcam
  imageWidthPixels: number = 1920
): number {
  const fieldOfViewWidth = (referencePixels / imageWidthPixels) * referenceSizeMm;
  return (fieldOfViewWidth * focalLengthMm) / sensorWidthMm;
}

/**
 * Validate calibration settings
 */
export function validateCalibration(calibration: CalibrationSettings): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  
  if (calibration.pixelsPerMm <= 0) {
    return { valid: false, warnings: ['Pixels per mm must be positive'] };
  }
  
  if (calibration.pixelsPerMm < 1) {
    warnings.push('Very low resolution: each pixel represents more than 1mm');
  }
  
  if (calibration.pixelsPerMm > 100) {
    warnings.push('Very high resolution: less than 0.01mm per pixel');
  }
  
  if (calibration.method === 'reference') {
    if (!calibration.referenceObjectSize || calibration.referenceObjectSize <= 0) {
      return { valid: false, warnings: ['Reference object size must be specified'] };
    }
    if (!calibration.referenceObjectPixels || calibration.referenceObjectPixels <= 0) {
      return { valid: false, warnings: ['Reference object pixel measurement required'] };
    }
  }
  
  return { valid: true, warnings };
}

/**
 * Format calibration info for display
 */
export function formatCalibrationInfo(calibration: CalibrationSettings): string {
  const mmPerPixel = (1 / calibration.pixelsPerMm).toFixed(4);
  const method = calibration.method === 'manual' ? 'Manual Entry' : 'Reference Object';
  
  let info = `${calibration.pixelsPerMm.toFixed(2)} px/mm (${mmPerPixel} mm/px)\nMethod: ${method}`;
  
  if (calibration.method === 'reference' && calibration.referenceObjectSize) {
    info += `\nReference: ${calibration.referenceObjectSize}mm = ${calibration.referenceObjectPixels}px`;
  }
  
  return info;
}

/**
 * Generate calibration scale bar dimensions
 */
export function generateScaleBar(
  calibration: CalibrationSettings,
  canvasWidth: number
): { length: number; label: string; pixels: number } {
  // Target scale bar to be about 1/5 of the canvas width
  const targetPixels = canvasWidth / 5;
  const targetMm = pixelsToMm(targetPixels, calibration);
  
  // Round to a nice number
  const niceNumbers = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  let bestMm = niceNumbers[0];
  let bestDiff = Math.abs(targetMm - bestMm);
  
  for (const n of niceNumbers) {
    const diff = Math.abs(targetMm - n);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestMm = n;
    }
  }
  
  const pixels = mmToPixels(bestMm, calibration);
  const label = bestMm >= 1 ? `${bestMm} mm` : `${bestMm * 1000} μm`;
  
  return { length: bestMm, label, pixels };
}
