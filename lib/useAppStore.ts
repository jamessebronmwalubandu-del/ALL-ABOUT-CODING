'use client';

import { create } from 'zustand';
import type {
  Particle,
  PSDMetrics,
  SizeClass,
  TrendDataPoint,
  AnalysisResult,
  DetectionSettings,
  CalibrationSettings,
} from '@/lib/types';
import { DEFAULT_DETECTION_SETTINGS, DEFAULT_CALIBRATION } from '@/lib/types';
import { loadPersistedState, persistState } from './storage';

interface AppStore {
  // Settings
  detectionSettings: DetectionSettings;
  calibrationSettings: CalibrationSettings;
  setDetectionSettings: (settings: DetectionSettings) => void;
  setCalibrationSettings: (settings: CalibrationSettings) => void;

  // Live Analysis Data
  particles: Particle[];
  setParticles: (particles: Particle[]) => void;
  
  metrics: PSDMetrics;
  setMetrics: (metrics: PSDMetrics) => void;
  
  previousMetrics: PSDMetrics | null;
  setPreviousMetrics: (metrics: PSDMetrics | null) => void;
  
  sizeClasses: SizeClass[];
  setSizeClasses: (classes: SizeClass[]) => void;
  
  trendData: TrendDataPoint[];
  setTrendData: (data: TrendDataPoint[]) => void;
  addTrendDataPoint: (point: TrendDataPoint) => void;

  // History / Results
  results: AnalysisResult[];
  setResults: (results: AnalysisResult[]) => void;
  addResult: (result: AnalysisResult) => void;
  deleteResult: (id: string) => void;

  // Streaming State
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  
  showOverlay: boolean;
  setShowOverlay: (show: boolean) => void;
  
  showScaleBar: boolean;
  setShowScaleBar: (show: boolean) => void;
  
  processingEnabled: boolean;
  setProcessingEnabled: (enabled: boolean) => void;
  
  fps: number;
  setFps: (fps: number) => void;

  // Initialization
  initialize: () => void;
}

export const useAppStore = create<AppStore>((set) => {
  // Load persisted state on creation
  const persistedState = loadPersistedState();

  return {
    // Settings
    detectionSettings: persistedState.detectionSettings,
    calibrationSettings: persistedState.calibrationSettings,
    setDetectionSettings: (settings) =>
      set((state) => {
        persistState({
          detectionSettings: settings,
          calibrationSettings: state.calibrationSettings,
          results: state.results,
        });
        return { detectionSettings: settings };
      }),
    setCalibrationSettings: (settings) =>
      set((state) => {
        persistState({
          detectionSettings: state.detectionSettings,
          calibrationSettings: settings,
          results: state.results,
        });
        return { calibrationSettings: settings };
      }),

    // Live Analysis Data
    particles: [],
    setParticles: (particles) => set({ particles }),

    metrics: {
      d10: 0,
      d50: 0,
      d80: 0,
      d90: 0,
      p80: 0,
      f80: 0,
      mean: 0,
      mode: 0,
      span: 0,
      min: 0,
      max: 0,
      count: 0,
      cv: 0,
    },
    setMetrics: (metrics) => set({ metrics }),

    previousMetrics: null,
    setPreviousMetrics: (metrics) => set({ previousMetrics: metrics }),

    sizeClasses: [],
    setSizeClasses: (classes) => set({ sizeClasses: classes }),

    trendData: [],
    setTrendData: (data) => set({ trendData: data }),
    addTrendDataPoint: (point) =>
      set((state) => {
        // Keep last 300 points (5 minutes at 1/sec)
        const newTrendData = [...state.trendData.slice(-299), point];
        return { trendData: newTrendData };
      }),

    // History / Results
    results: persistedState.results,
    setResults: (results) =>
      set((state) => {
        persistState({
          detectionSettings: state.detectionSettings,
          calibrationSettings: state.calibrationSettings,
          results,
        });
        return { results };
      }),
    addResult: (result) =>
      set((state) => {
        const newResults = [result, ...state.results];
        persistState({
          detectionSettings: state.detectionSettings,
          calibrationSettings: state.calibrationSettings,
          results: newResults,
        });
        return { results: newResults };
      }),
    deleteResult: (id) =>
      set((state) => {
        const newResults = state.results.filter((r) => r.id !== id);
        persistState({
          detectionSettings: state.detectionSettings,
          calibrationSettings: state.calibrationSettings,
          results: newResults,
        });
        return { results: newResults };
      }),

    // Streaming State
    isStreaming: false,
    setIsStreaming: (streaming) => set({ isStreaming: streaming }),

    showOverlay: true,
    setShowOverlay: (show) => set({ showOverlay: show }),

    showScaleBar: true,
    setShowScaleBar: (show) => set({ showScaleBar: show }),

    processingEnabled: true,
    setProcessingEnabled: (enabled) => set({ processingEnabled: enabled }),

    fps: 0,
    setFps: (fps) => set({ fps }),

    // Initialization
    initialize: () => {
      const persistedState = loadPersistedState();
      set({
        detectionSettings: persistedState.detectionSettings,
        calibrationSettings: persistedState.calibrationSettings,
        results: persistedState.results,
      });
    },
  };
});
