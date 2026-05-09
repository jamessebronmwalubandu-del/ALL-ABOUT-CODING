'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ImageSourceType, ImageSourceConfig, Particle } from '@/lib/types';
import { ImageSourceSelector } from '@/app/components/image-source-selector';
import { WebcamCapture, type WebcamCaptureHandle } from '@/app/components/webcam-capture';
import { MetricsPanel } from '@/app/components/metrics-panel';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Eye,
  EyeOff,
  Activity,
} from 'lucide-react';
import { useAppStore } from '@/lib/useAppStore';
import { generateStandardSizeClasses, classifyParticles, calculatePSDMetrics } from '@/lib/psd-calculations';
import { loadImageFromFile } from '@/lib/image-sources';

export default function DashboardPage() {
  const [activeSource, setActiveSource] = useState<ImageSourceType>('webcam');
  const [externalImage, setExternalImage] = useState<HTMLImageElement | null>(null);

  const webcamRef = useRef<WebcamCaptureHandle>(null);

  // Store selectors
  const isStreaming = useAppStore((state) => state.isStreaming);
  const setIsStreaming = useAppStore((state) => state.setIsStreaming);
  const settings = useAppStore((state) => state.detectionSettings);
  const calibration = useAppStore((state) => state.calibrationSettings);
  const showOverlay = useAppStore((state) => state.showOverlay);
  const setShowOverlay = useAppStore((state) => state.setShowOverlay);
  const showScaleBar = useAppStore((state) => state.showScaleBar);
  const setShowScaleBar = useAppStore((state) => state.setShowScaleBar);
  const processingEnabled = useAppStore((state) => state.processingEnabled);
  const setProcessingEnabled = useAppStore((state) => state.setProcessingEnabled);
  const fps = useAppStore((state) => state.fps);
  const setFps = useAppStore((state) => state.setFps);

  // Update store with particles, metrics
  const setParticles = useAppStore((state) => state.setParticles);
  const setSizeClasses = useAppStore((state) => state.setSizeClasses);
  const setMetrics = useAppStore((state) => state.setMetrics);
  const setPreviousMetrics = useAppStore((state) => state.setPreviousMetrics);
  const addTrendDataPoint = useAppStore((state) => state.addTrendDataPoint);
  const metrics = useAppStore((state) => state.metrics);
  const previousMetrics = useAppStore((state) => state.previousMetrics);

  // Handle source change
  const handleSourceChange = useCallback((type: ImageSourceType, config: ImageSourceConfig) => {
    setActiveSource(type);
    if (type !== 'webcam' && type !== 'ip-camera') {
      setIsStreaming(false);
    }
    if (type === 'webcam' || type === 'ip-camera') {
      setExternalImage(null);
    }
  }, [setIsStreaming]);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      try {
        const img = await loadImageFromFile(files[0]);
        setExternalImage(img);
        setIsStreaming(false);
      } catch (error) {
        console.error('Failed to load image:', error);
      }
    }
  }, [setIsStreaming]);

  // Handle paste image
  const handlePasteImage = useCallback((img: HTMLImageElement) => {
    setExternalImage(img);
    setIsStreaming(false);
  }, [setIsStreaming]);

  // Handle particle detection results
  const handleParticlesDetected = useCallback(
    (detectedParticles: Particle[], imageData?: ImageData) => {
      setParticles(detectedParticles);

      if (detectedParticles.length > 0) {
        const classes = generateStandardSizeClasses(detectedParticles);
        const classifiedClasses = classifyParticles(detectedParticles, classes);
        setSizeClasses(classifiedClasses);

        const newMetrics = calculatePSDMetrics(detectedParticles, classifiedClasses);
        setPreviousMetrics(metrics.count > 0 ? metrics : null);
        setMetrics(newMetrics);

        // Add to trend data (throttled)
        const now = new Date();
        const last = useAppStore.getState().trendData[useAppStore.getState().trendData.length - 1];

        if (!last || now.getTime() - last.timestamp.getTime() > 1000) {
          addTrendDataPoint({
            timestamp: now,
            p80: newMetrics.p80,
            d50: newMetrics.d50,
            d10: newMetrics.d10,
            d90: newMetrics.d90,
            count: newMetrics.count,
          });
        }
      }
    },
    [setParticles, setSizeClasses, setMetrics, setPreviousMetrics, addTrendDataPoint, metrics.count]
  );

  // Handle FPS update
  const handleFpsUpdate = useCallback(
    (newFps: number) => {
      setFps(newFps);
    },
    [setFps]
  );

  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error('Capture error:', error);
  }, []);

  // Toggle streaming
  const toggleStreaming = useCallback(() => {
    setIsStreaming(!isStreaming);
    if (!isStreaming) {
      setExternalImage(null);
    }
  }, [isStreaming, setIsStreaming]);

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-xs text-muted-foreground">Live capture and particle detection</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className={`size-2 rounded-full ${isStreaming ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
            {isStreaming ? `${fps} FPS` : 'Idle'}
          </div>
        </div>
      </div>

      {/* Image Source Selector */}
      <ImageSourceSelector
        activeSource={activeSource}
        onSourceChange={handleSourceChange}
        onFileSelect={handleFileSelect}
        onPasteImage={handlePasteImage}
        isStreaming={isStreaming}
        onToggleStream={toggleStreaming}
      />

      {/* Video/Image Display */}
      <div className="flex-1 min-h-[400px] rounded-lg border border-border/50 overflow-hidden">
        <WebcamCapture
          ref={webcamRef}
          isStreaming={isStreaming}
          settings={settings}
          calibration={calibration}
          onParticlesDetected={handleParticlesDetected}
          onFpsUpdate={handleFpsUpdate}
          onError={handleError}
          externalImage={externalImage}
          showOverlay={showOverlay}
          showScaleBar={showScaleBar}
          processingEnabled={processingEnabled}
        />
      </div>

      {/* Display Controls */}
      <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="overlay"
              checked={showOverlay}
              onCheckedChange={setShowOverlay}
            />
            <Label htmlFor="overlay" className="text-sm flex items-center gap-1.5 cursor-pointer">
              {showOverlay ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              Particle Overlay
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="scalebar"
              checked={showScaleBar}
              onCheckedChange={setShowScaleBar}
            />
            <Label htmlFor="scalebar" className="text-sm cursor-pointer">
              Scale Bar
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="processing"
              checked={processingEnabled}
              onCheckedChange={setProcessingEnabled}
            />
            <Label htmlFor="processing" className="text-sm cursor-pointer">
              Processing
            </Label>
          </div>
        </div>
      </div>

      {/* Quick Metrics Preview */}
      <div className="bg-card/50 rounded-lg border border-border/50 p-4">
        <MetricsPanel
          metrics={metrics}
          previousMetrics={previousMetrics}
          isProcessing={isStreaming && processingEnabled}
        />
      </div>
    </div>
  );
}
