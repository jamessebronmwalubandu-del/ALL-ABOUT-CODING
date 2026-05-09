import type {
  DetectionSettings,
  CalibrationSettings,
  AnalysisResult,
} from '@/lib/types';
import { DEFAULT_DETECTION_SETTINGS, DEFAULT_CALIBRATION } from '@/lib/types';

interface PersistedState {
  detectionSettings: DetectionSettings;
  calibrationSettings: CalibrationSettings;
  results: AnalysisResult[];
}

const STORAGE_KEYS = {
  DETECTION_SETTINGS: 'psd-analyzer:detection-settings',
  CALIBRATION_SETTINGS: 'psd-analyzer:calibration-settings',
  RESULTS: 'psd-analyzer:results',
};

export function loadPersistedState(): PersistedState {
  // Only run on client side
  if (typeof window === 'undefined') {
    return {
      detectionSettings: DEFAULT_DETECTION_SETTINGS,
      calibrationSettings: DEFAULT_CALIBRATION,
      results: [],
    };
  }

  try {
    const detectionSettings = localStorage.getItem(STORAGE_KEYS.DETECTION_SETTINGS);
    const calibrationSettings = localStorage.getItem(STORAGE_KEYS.CALIBRATION_SETTINGS);
    const results = localStorage.getItem(STORAGE_KEYS.RESULTS);

    return {
      detectionSettings: detectionSettings
        ? JSON.parse(detectionSettings)
        : DEFAULT_DETECTION_SETTINGS,
      calibrationSettings: calibrationSettings
        ? JSON.parse(calibrationSettings)
        : DEFAULT_CALIBRATION,
      results: results ? JSON.parse(results) : [],
    };
  } catch (error) {
    console.error('Failed to load persisted state:', error);
    return {
      detectionSettings: DEFAULT_DETECTION_SETTINGS,
      calibrationSettings: DEFAULT_CALIBRATION,
      results: [],
    };
  }
}

export function persistState(state: Partial<PersistedState>): void {
  // Only run on client side
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (state.detectionSettings) {
      localStorage.setItem(
        STORAGE_KEYS.DETECTION_SETTINGS,
        JSON.stringify(state.detectionSettings)
      );
    }
    if (state.calibrationSettings) {
      localStorage.setItem(
        STORAGE_KEYS.CALIBRATION_SETTINGS,
        JSON.stringify(state.calibrationSettings)
      );
    }
    if (state.results) {
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(state.results));
    }
  } catch (error) {
    console.error('Failed to persist state:', error);
  }
}

export function clearPersistedState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Failed to clear persisted state:', error);
  }
}
