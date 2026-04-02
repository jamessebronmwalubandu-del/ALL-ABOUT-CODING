'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ImageSourceSelector } from './components/image-source-selector';
import { WebcamCapture, type WebcamCaptureHandle } from './components/webcam-capture';
import { CalibrationPanel } from './components/calibration-panel';
import { SettingsPanel } from './components/settings-panel';
import { MetricsPanel } from './components/metrics-panel';
import { PSDChart } from './components/psd-chart';
import { HistogramChart } from './components/histogram-chart';
import { TrendChart } from './components/trend-chart';
import { ExportPanel } from './components/export-panel';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Activity, 
  Settings, 
  Eye, 
  EyeOff, 
  Maximize2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

import type { 
  Particle, 
  ImageSourceType, 
  ImageSourceConfig, 
  DetectionSettings, 
  CalibrationSettings,
  PSDMetrics,
  SizeClass,
  TrendDataPoint,
  AnalysisResult
} from './lib/types';
import { DEFAULT_DETECTION_SETTINGS, DEFAULT_CALIBRATION } from './lib/types';
import { generateStandardSizeClasses, classifyParticles, calculatePSDMetrics } from './lib/psd-calculations';
import { loadImageFromFile } from './lib/image-sources';

export default function PSDAnalyzer() {
  // State
  const [activeSource, setActiveSource] = useState<ImageSourceType>('webcam');
  const [isStreaming, setIsStreaming] = useState(false);
  const [settings, setSettings] = useState<DetectionSettings>(DEFAULT_DETECTION_SETTINGS);
  const [calibration, setCalibration] = useState<CalibrationSettings>(DEFAULT_CALIBRATION);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showScaleBar, setShowScaleBar] = useState(true);
  const [processingEnabled, setProcessingEnabled] = useState(true);
  const [externalImage, setExternalImage] = useState<HTMLImageElement | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Analysis results
  const [particles, setParticles] = useState<Particle[]>([]);
  const [sizeClasses, setSizeClasses] = useState<SizeClass[]>([]);
  const [metrics, setMetrics] = useState<PSDMetrics>({
    d10: 0, d50: 0, d80: 0, d90: 0, p80: 0, f80: 0,
    mean: 0, mode: 0, span: 0, min: 0, max: 0, count: 0, cv: 0
  });
  const [previousMetrics, setPreviousMetrics] = useState<PSDMetrics | null>(null);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [fps, setFps] = useState(0);

  // Refs
  const webcamRef = useRef<WebcamCaptureHandle>(null);

  // Handle source change
  const handleSourceChange = useCallback((type: ImageSourceType, config: ImageSourceConfig) => {
    setActiveSource(type);
    if (type !== 'webcam' && type !== 'ip-camera') {
      setIsStreaming(false);
    }
    // Clear external image if switching to live sources
    if (type === 'webcam' || type === 'ip-camera') {
      setExternalImage(null);
    }
  }, []);

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
  }, []);

  // Handle paste image
  const handlePasteImage = useCallback((img: HTMLImageElement) => {
    setExternalImage(img);
    setIsStreaming(false);
  }, []);

  // Handle particle detection results
  const handleParticlesDetected = useCallback((detectedParticles: Particle[], imageData: ImageData) => {
    setParticles(detectedParticles);
    
    if (detectedParticles.length > 0) {
      // Generate size classes and classify particles
      const classes = generateStandardSizeClasses(detectedParticles);
      const classifiedClasses = classifyParticles(detectedParticles, classes);
      setSizeClasses(classifiedClasses);
      
      // Calculate metrics
      const newMetrics = calculatePSDMetrics(detectedParticles, classifiedClasses);
      setPreviousMetrics(metrics.count > 0 ? metrics : null);
      setMetrics(newMetrics);
      
      // Add to trend data (throttled)
      setTrendData(prev => {
        const now = new Date();
        const last = prev[prev.length - 1];
        
        // Only add if at least 1 second has passed
        if (!last || now.getTime() - last.timestamp.getTime() > 1000) {
          const newPoint: TrendDataPoint = {
            timestamp: now,
            p80: newMetrics.p80,
            d50: newMetrics.d50,
            d10: newMetrics.d10,
            d90: newMetrics.d90,
            count: newMetrics.count,
          };
          
          // Keep last 300 points (5 minutes at 1/sec)
          return [...prev.slice(-299), newPoint];
        }
        return prev;
      });
    }
  }, [metrics]);

  // Handle FPS update
  const handleFpsUpdate = useCallback((newFps: number) => {
    setFps(newFps);
  }, []);

  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error('Capture error:', error);
  }, []);

  // Toggle streaming
  const toggleStreaming = useCallback(() => {
    setIsStreaming(prev => !prev);
    if (!isStreaming) {
      setExternalImage(null);
    }
  }, [isStreaming]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">PSD Analyzer</h1>
              <p className="text-xs text-muted-foreground">
                Particle Size Distribution for Crushing Circuits
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className={`size-2 rounded-full ${isStreaming ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
              {isStreaming ? `${fps} FPS` : 'Idle'}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Particles:</span>
              <span className="font-mono font-medium">{particles.length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <main className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
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
          <div className="flex-1 min-h-[300px]">
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

          {/* Charts */}
          <Tabs defaultValue="psd" className="w-full">
            <TabsList>
              <TabsTrigger value="psd">Cumulative Curve</TabsTrigger>
              <TabsTrigger value="histogram">Histogram</TabsTrigger>
              <TabsTrigger value="trend">Trend</TabsTrigger>
            </TabsList>
            <TabsContent value="psd" className="mt-4">
              <PSDChart sizeClasses={sizeClasses} metrics={metrics} />
            </TabsContent>
            <TabsContent value="histogram" className="mt-4">
              <HistogramChart sizeClasses={sizeClasses} />
            </TabsContent>
            <TabsContent value="trend" className="mt-4">
              <TrendChart data={trendData} />
            </TabsContent>
          </Tabs>
        </main>

        {/* Sidebar */}
        <aside 
          className={`border-l border-border/50 bg-card/50 transition-all duration-300 ${
            sidebarCollapsed ? 'w-12' : 'w-80'
          } flex flex-col`}
        >
          {/* Collapse Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-3 border-b border-border/50 hover:bg-secondary/50 transition-colors flex items-center justify-center"
          >
            {sidebarCollapsed ? (
              <ChevronLeft className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>

          {!sidebarCollapsed && (
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Metrics */}
              <MetricsPanel 
                metrics={metrics} 
                previousMetrics={previousMetrics}
                isProcessing={isStreaming && processingEnabled}
              />

              {/* Settings Tabs */}
              <Tabs defaultValue="calibration">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="calibration" className="text-xs">
                    Calibration
                  </TabsTrigger>
                  <TabsTrigger value="detection" className="text-xs">
                    <Settings className="size-3.5 mr-1" />
                    Detection
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="calibration" className="mt-4">
                  <CalibrationPanel
                    calibration={calibration}
                    onCalibrationChange={setCalibration}
                  />
                </TabsContent>
                <TabsContent value="detection" className="mt-4">
                  <SettingsPanel
                    settings={settings}
                    onSettingsChange={setSettings}
                  />
                </TabsContent>
              </Tabs>

              {/* Export */}
              <ExportPanel
                results={results}
                sizeClasses={sizeClasses}
                metrics={metrics}
                trendData={trendData}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
