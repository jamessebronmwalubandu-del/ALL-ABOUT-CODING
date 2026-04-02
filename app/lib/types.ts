// Particle Size Distribution Types for Crushing Circuit Analysis

export interface Particle {
  id: number;
  area: number; // in pixels^2
  perimeter: number; // in pixels
  diameter: number; // equivalent circular diameter in mm (after calibration)
  centroid: { x: number; y: number };
  boundingBox: { x: number; y: number; width: number; height: number };
  aspectRatio: number;
  circularity: number; // 4 * PI * area / perimeter^2
}

export interface PSDMetrics {
  d10: number; // 10% passing size (mm)
  d50: number; // 50% passing size (mm) - median
  d80: number; // 80% passing size (mm)
  d90: number; // 90% passing size (mm)
  p80: number; // 80% passing size (same as d80, common in metallurgy)
  f80: number; // Feed 80% passing (for work index calculations)
  mean: number; // arithmetic mean size
  mode: number; // most frequent size
  span: number; // (d90 - d10) / d50 - distribution spread
  min: number;
  max: number;
  count: number; // total particle count
  cv: number; // coefficient of variation (%)
}

export interface SizeClass {
  sizeMin: number; // mm
  sizeMax: number; // mm
  midpoint: number; // mm
  count: number;
  frequency: number; // percentage
  cumRetained: number; // cumulative % retained
  cumPassing: number; // cumulative % passing
}

export interface AnalysisResult {
  id: string;
  timestamp: Date;
  particles: Particle[];
  metrics: PSDMetrics;
  sizeClasses: SizeClass[];
  imageDataUrl?: string;
  settings: DetectionSettings;
  calibration: CalibrationSettings;
}

export interface TrendDataPoint {
  timestamp: Date;
  p80: number;
  d50: number;
  d10: number;
  d90: number;
  count: number;
}

export interface CalibrationSettings {
  pixelsPerMm: number;
  method: 'manual' | 'reference';
  referenceObjectSize?: number; // mm, for reference object calibration
  referenceObjectPixels?: number; // measured pixel size of reference object
}

export interface DetectionSettings {
  threshold: number; // 0-255, for binary threshold
  minParticleSize: number; // minimum particle area in pixels
  maxParticleSize: number; // maximum particle area in pixels
  blurKernel: number; // gaussian blur kernel size
  cannyLow: number; // canny edge detection low threshold
  cannyHigh: number; // canny edge detection high threshold
  adaptiveBlockSize: number; // for adaptive thresholding
  adaptiveC: number; // constant subtracted from mean
  morphKernel: number; // morphological operations kernel size
  useAdaptiveThreshold: boolean;
  invertImage: boolean; // for dark particles on light background
}

export type ImageSourceType = 
  | 'webcam' 
  | 'ip-camera' 
  | 'file-upload' 
  | 'url' 
  | 'folder-watch' 
  | 'clipboard';

export interface ImageSource {
  type: ImageSourceType;
  label: string;
  active: boolean;
  config: ImageSourceConfig;
}

export interface ImageSourceConfig {
  // Webcam
  deviceId?: string;
  resolution?: { width: number; height: number };
  
  // IP Camera
  streamUrl?: string;
  snapshotUrl?: string;
  refreshInterval?: number; // ms
  authUsername?: string;
  authPassword?: string;
  
  // File Upload
  acceptedFormats?: string[];
  
  // URL
  imageUrl?: string;
  
  // Folder Watch
  folderPath?: string;
  pollInterval?: number; // ms
}

export interface ProcessingState {
  isProcessing: boolean;
  fps: number;
  frameCount: number;
  lastProcessedAt: Date | null;
  error: string | null;
}

export interface ExportOptions {
  includeRawData: boolean;
  includeCharts: boolean;
  includeImages: boolean;
  dateRange?: { start: Date; end: Date };
  format: 'pdf' | 'excel' | 'csv';
}

// Size classes for standard screen analysis (Tyler mesh equivalents in mm)
export const STANDARD_SIZE_CLASSES: number[] = [
  150, 125, 106, 90, 75, 63, 53, 45, 37.5, 31.5,
  26.5, 22.4, 19, 16, 13.2, 11.2, 9.5, 8, 6.7, 5.6,
  4.75, 4, 3.35, 2.8, 2.36, 2, 1.7, 1.4, 1.18, 1,
  0.85, 0.71, 0.6, 0.5, 0.425, 0.355, 0.3, 0.25,
  0.212, 0.18, 0.15, 0.125, 0.106, 0.09, 0.075, 0.063, 0.053, 0.045
];

// Default detection settings optimized for crushing circuit analysis
export const DEFAULT_DETECTION_SETTINGS: DetectionSettings = {
  threshold: 127,
  minParticleSize: 100, // pixels
  maxParticleSize: 500000, // pixels
  blurKernel: 5,
  cannyLow: 50,
  cannyHigh: 150,
  adaptiveBlockSize: 11,
  adaptiveC: 2,
  morphKernel: 3,
  useAdaptiveThreshold: true,
  invertImage: false,
};

export const DEFAULT_CALIBRATION: CalibrationSettings = {
  pixelsPerMm: 10, // 10 pixels per mm default
  method: 'manual',
};
