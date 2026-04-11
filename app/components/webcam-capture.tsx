'use client';

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { Particle, DetectionSettings, CalibrationSettings } from '../lib/types';
import { drawParticleOverlay } from '../lib/image-processing';
import { videoFrameToImageData, imageToImageData, getWebcamStream, checkCameraPermissions, requestCameraPermissions } from '../lib/image-sources';
import { generateScaleBar } from '../lib/calibration';

export interface WebcamCaptureHandle {
  captureFrame: () => ImageData | null;
  getVideoElement: () => HTMLVideoElement | null;
}

interface WebcamCaptureProps {
  deviceId?: string;
  isStreaming: boolean;
  settings: DetectionSettings;
  calibration: CalibrationSettings;
  onParticlesDetected: (particles: Particle[], imageData?: ImageData) => void;
  onFpsUpdate: (fps: number) => void;
  onError: (error: string) => void;
  externalImage?: HTMLImageElement | null;
  showOverlay: boolean;
  showScaleBar: boolean;
  processingEnabled: boolean;
}

export const WebcamCapture = forwardRef<WebcamCaptureHandle, WebcamCaptureProps>(
  function WebcamCapture(
    {
      deviceId,
      isStreaming,
      settings,
      calibration,
      onParticlesDetected,
      onFpsUpdate,
      onError,
      externalImage,
      showOverlay,
      showScaleBar,
      processingEnabled,
    },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationRef = useRef<number | null>(null);
    const lastFrameTimeRef = useRef<number>(0);
    const lastUiUpdateRef = useRef<number>(0);
    const frameCountRef = useRef<number>(0);
    const fpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const monitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const workerBusyRef = useRef<boolean>(false);
    const latestParticlesRef = useRef<Particle[]>([]);
    const isMountedRef = useRef<boolean>(true);
    const workerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Performance monitoring refs
    const frameIdRef = useRef<number>(0);
    const perfMetricsRef = useRef({
      frameTimes: [] as number[],
      workerLatencies: [] as number[],
      processingTimes: [] as number[],
      uiUpdateTimes: [] as number[],
      transferLatencies: [] as number[],
      frameDrops: 0,
      lastFrameTime: 0,
      totalFrames: 0,
      processedFrames: 0,
    });
    
    // Per-frame performance tracking
    const framePerformanceRef = useRef<Map<number, {
      frameId: number;
      captureTime: number;
      canvasDrawTime: number;
      imageDataTime: number;
      workerSendTime: number;
      workerReturnTime: number;
      workerLatency: number;
      overlayRenderTime: number;
      uiUpdateTime?: number;
      performanceTrace?: any;
    }>>(new Map());
    
    // Performance stats aggregation
    const perfStatsRef = useRef({
      fps: 0,
      avgProcessingTime: 0,
      avgTotalLatency: 0,
      avgTransferLatency: 0,
      avgWorkerLatency: 0,
      frameCount: 0,
      droppedFrames: 0,
      lastUpdate: 0,
    });
    
    // Debug overlay state
    const [showDebugOverlay, setShowDebugOverlay] = useState(false);

    // Keep callbacks in refs to prevent the processing loop from restarting unnecessarily
    const onParticlesDetectedRef = useRef(onParticlesDetected);
    const onFpsUpdateRef = useRef(onFpsUpdate);
    const settingsRef = useRef(settings);
    const calibrationRef = useRef(calibration);
    const showOverlayRef = useRef(showOverlay);
    const showScaleBarRef = useRef(showScaleBar);
    const processingEnabledRef = useRef(processingEnabled);

    useEffect(() => {
      onParticlesDetectedRef.current = onParticlesDetected;
      onFpsUpdateRef.current = onFpsUpdate;
      settingsRef.current = settings;
      calibrationRef.current = calibration;
      showOverlayRef.current = showOverlay;
      showScaleBarRef.current = showScaleBar;
      processingEnabledRef.current = processingEnabled;
    }, [onParticlesDetected, onFpsUpdate, settings, calibration, showOverlay, showScaleBar, processingEnabled]);

    // Initialize worker
    useEffect(() => {
      try {
        workerRef.current = new Worker(new URL('../../workers/particle-worker.ts', import.meta.url), { type: 'module' });
        
        workerRef.current.onmessage = (event: MessageEvent) => {
          if (!isMountedRef.current) return;
          
          const mainThreadReceiveTime = performance.now();
          const { particles, error, frameId, processingTime, totalTime, performanceTrace } = event.data;
          
          // Performance monitoring
          const now = performance.now();
          perfMetricsRef.current.workerLatencies.push(totalTime);
          perfMetricsRef.current.processingTimes.push(processingTime);
          perfMetricsRef.current.processedFrames++;
          
          // Track transfer latency
          if (performanceTrace?.metrics?.transferLatency) {
            perfMetricsRef.current.transferLatencies.push(performanceTrace.metrics.transferLatency);
          }
          
          // Update per-frame performance data
          if (performanceTrace && framePerformanceRef.current.has(frameId)) {
            const frameData = framePerformanceRef.current.get(frameId)!;
            frameData.workerReturnTime = mainThreadReceiveTime;
            frameData.workerLatency = mainThreadReceiveTime - frameData.workerSendTime;
            frameData.performanceTrace = performanceTrace;
            
            // Log correlated performance data
            console.log(`[Main Thread] Frame ${frameId} correlation:`, {
              workerId: performanceTrace.workerId,
              pipelineLatency: `${frameData.workerLatency.toFixed(2)}ms (send to return)`,
              transferLatency: `${performanceTrace.metrics.transferLatency.toFixed(2)}ms (main→worker)`,
              returnLatency: `${(mainThreadReceiveTime - performanceTrace.timestamps.responseSend).toFixed(2)}ms (worker→main)`,
              totalWorkerTime: `${totalTime.toFixed(2)}ms`,
              processingTime: `${processingTime.toFixed(2)}ms`,
              imageDataSize: `${(performanceTrace.metrics.imageDataSize / 1024 / 1024).toFixed(2)}MB`,
              particlesFound: performanceTrace.metrics.particlesCount,
              memoryUsed: performanceTrace.metrics.memoryUsage ? 
                `${(performanceTrace.metrics.memoryUsage.used / 1024 / 1024).toFixed(2)}MB` : 'N/A',
            });
          }
          
          if (error) {
            onError(`Worker error: ${error}`);
          } else if (particles) {
            latestParticlesRef.current = particles;
            
            // Throttle React UI updates (charts, metrics) to ~4 FPS to prevent freezing
            const uiElapsed = now - lastUiUpdateRef.current;
            if (uiElapsed >= 250) { // 250ms interval
              const uiStart = performance.now();
              onParticlesDetectedRef.current(particles);
              const uiTime = performance.now() - uiStart;
              perfMetricsRef.current.uiUpdateTimes.push(uiTime);
              if (framePerformanceRef.current.has(frameId)) {
                framePerformanceRef.current.get(frameId)!.uiUpdateTime = uiTime;
              }
              lastUiUpdateRef.current = now;
              
              console.log(`[Main Thread] Frame ${frameId} UI update: ${uiTime.toFixed(2)}ms`);
            }
          }
          
          workerBusyRef.current = false;
          if (workerTimeoutRef.current) {
            clearTimeout(workerTimeoutRef.current);
            workerTimeoutRef.current = null;
          }
        };
      } catch (error) {
        onError(`Failed to initialize worker: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return () => {
        isMountedRef.current = false;
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        if (workerTimeoutRef.current) {
          clearTimeout(workerTimeoutRef.current);
          workerTimeoutRef.current = null;
        }
        workerBusyRef.current = false;
        latestParticlesRef.current = [];
        
        // Log final performance metrics
        console.log('Performance Metrics Summary:', {
          totalFrames: perfMetricsRef.current.totalFrames,
          processedFrames: perfMetricsRef.current.processedFrames,
          frameDrops: perfMetricsRef.current.frameDrops,
          avgFrameTime: perfMetricsRef.current.frameTimes.reduce((a, b) => a + b, 0) / perfMetricsRef.current.frameTimes.length || 0,
          avgWorkerLatency: perfMetricsRef.current.workerLatencies.reduce((a, b) => a + b, 0) / perfMetricsRef.current.workerLatencies.length || 0,
          avgProcessingTime: perfMetricsRef.current.processingTimes.reduce((a, b) => a + b, 0) / perfMetricsRef.current.processingTimes.length || 0,
          avgUiUpdateTime: perfMetricsRef.current.uiUpdateTimes.reduce((a, b) => a + b, 0) / perfMetricsRef.current.uiUpdateTimes.length || 0,
        });
      };
    }, [onError]);

    const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

    useImperativeHandle(ref, () => ({
      captureFrame: () => {
        if (externalImage) {
          return imageToImageData(externalImage);
        }
        if (videoRef.current && videoRef.current.readyState >= 2) {
          return videoFrameToImageData(videoRef.current);
        }
        return null;
      },
      getVideoElement: () => videoRef.current,
    }));

    const resizeCanvasToVideo = useCallback(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const overlay = overlayCanvasRef.current;

      if (!video || !canvas || video.readyState < 2) return;

      const { videoWidth, videoHeight } = video;

      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        if (overlay) {
          overlay.width = videoWidth;
          overlay.height = videoHeight;
        }
        setDimensions({ width: videoWidth, height: videoHeight });
      }
    }, []);

    // Start/stop webcam stream
    useEffect(() => {
      if (isStreaming && !externalImage) {
        startStream();
      } else {
        stopStream();
      }

      return () => {
        stopStream();
      };
    }, [isStreaming, deviceId, externalImage]);

    // Handle external image display
    useEffect(() => {
      if (externalImage && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = externalImage.naturalWidth;
        canvas.height = externalImage.naturalHeight;
        setDimensions({ width: externalImage.naturalWidth, height: externalImage.naturalHeight });

        ctx.drawImage(externalImage, 0, 0);

        // Process the image
        if (processingEnabled && workerRef.current && !workerBusyRef.current) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          workerBusyRef.current = true;
          const currentFrameId = frameIdRef.current++;
          const timestamp = performance.now();
          
          workerRef.current.postMessage({
            imageData: imageData,
            settings: settings,
            calibration: calibration,
            frameId: currentFrameId,
            timestamp: timestamp,
          });

          // Set fail-safe timeout
          workerTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              workerBusyRef.current = false;
              perfMetricsRef.current.frameDrops++;
              onError('Worker response timeout');
            }
          }, 1500); // 1.5 second timeout

          // Draw overlay after worker responds
          const handleWorkerResponse = (event: MessageEvent) => {
            if (!isMountedRef.current) return;
            
            const { particles, error, processingTime, totalTime, performanceTrace } = event.data;
            
            // Performance monitoring
            perfMetricsRef.current.workerLatencies.push(totalTime);
            perfMetricsRef.current.processingTimes.push(processingTime);
            perfMetricsRef.current.processedFrames++;
            
            // Enhanced performance tracing for external images
            if (performanceTrace) {
              const now = performance.now();
              console.log(`[Main Thread] External Image correlation:`, {
                workerId: performanceTrace.workerId,
                totalWorkerTime: `${totalTime.toFixed(2)}ms`,
                processingTime: `${processingTime.toFixed(2)}ms`,
                imageDataSize: `${(performanceTrace.metrics.imageDataSize / 1024 / 1024).toFixed(2)}MB`,
                particlesFound: performanceTrace.metrics.particlesCount,
                memoryUsed: performanceTrace.metrics.memoryUsage ? 
                  `${(performanceTrace.metrics.memoryUsage.used / 1024 / 1024).toFixed(2)}MB` : 'N/A',
                workerToMainLatency: `${(now - performanceTrace.timestamps.responseSend).toFixed(2)}ms`,
              });
            }
            
            if (!error && particles && overlayCanvasRef.current) {
              latestParticlesRef.current = particles;
              const overlay = overlayCanvasRef.current;
              overlay.width = canvas.width;
              overlay.height = canvas.height;
              const overlayCtx = overlay.getContext('2d');
              if (overlayCtx) {
                overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
                drawParticleOverlay(overlayCtx, particles, '#00ff00', true);

                if (showScaleBar) {
                  drawScaleBar(overlayCtx, canvas.width, canvas.height);
                }
              }
            }
            
            workerBusyRef.current = false;
            if (workerTimeoutRef.current) {
              clearTimeout(workerTimeoutRef.current);
              workerTimeoutRef.current = null;
            }
            if (workerRef.current) {
              workerRef.current.removeEventListener('message', handleWorkerResponse);
            }
          };

          if (workerRef.current) {
            workerRef.current.addEventListener('message', handleWorkerResponse, { once: true });
          }
        }
      }
    }, [externalImage, settings, calibration, showOverlay, showScaleBar, processingEnabled]);

    const startStream = async () => {
      try {
        // Check camera permissions first
        const permissionState = await checkCameraPermissions();
        if (permissionState === 'denied') {
          onError('Camera access denied. Please enable camera permissions in your browser settings and refresh the page');
          return;
        }

        // Request permissions if not granted
        if (permissionState === 'prompt') {
          const granted = await requestCameraPermissions();
          if (!granted) {
            onError('Camera access denied. Please allow camera permissions when prompted');
            return;
          }
        }

        const stream = await getWebcamStream(deviceId);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          // Add error event listener to catch video element errors
          const handleVideoError = (e: Event) => {
            const video = e.target as HTMLVideoElement;
            let errorMessage = 'Could not start video source';

            if (video.error) {
              switch (video.error.code) {
                case MediaError.MEDIA_ERR_ABORTED:
                  errorMessage = 'Video playback was aborted';
                  break;
                case MediaError.MEDIA_ERR_NETWORK:
                  errorMessage = 'Network error while loading video';
                  break;
                case MediaError.MEDIA_ERR_DECODE:
                  errorMessage = 'Video decoding error';
                  break;
                case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                  errorMessage = 'Video format not supported';
                  break;
                default:
                  errorMessage = `Video error: ${video.error.message}`;
              }
            }

            onError(errorMessage);
          };

          videoRef.current.addEventListener('error', handleVideoError, { once: true });

          await videoRef.current.play();

          // Remove the error listener if play succeeded
          videoRef.current.removeEventListener('error', handleVideoError);

          resizeCanvasToVideo();

          // Start processing loop
          startProcessingLoop();
          startFpsCounter();
          startPerformanceMonitoring();
        }
      } catch (err) {
        const error = err as Error;
        let errorMessage = 'Failed to access camera';

        // Handle specific MediaStream errors
        if (error.name === 'NotReadableError') {
          errorMessage = 'Camera is already in use by another application or not available. Please close other applications using the camera and try again';
        } else if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please allow camera permissions and try again';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera found. Please connect a camera and try again';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Camera does not support the requested resolution. Try a different camera or resolution';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = 'Camera access is not supported in this browser';
        } else if (error.message) {
          errorMessage += `: ${error.message}`;
        }

        onError(errorMessage);
      }
    };

    const stopStream = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
        fpsIntervalRef.current = null;
      }

      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
        monitorIntervalRef.current = null;
      }

      if (workerTimeoutRef.current) {
        clearTimeout(workerTimeoutRef.current);
        workerTimeoutRef.current = null;
      }

      workerBusyRef.current = false;
      latestParticlesRef.current = [];

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const startFpsCounter = () => {
      frameCountRef.current = 0;
      fpsIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        
        // Atomic capture and reset to ensure accuracy
        const currentCount = frameCountRef.current;
        frameCountRef.current = 0; 
        onFpsUpdateRef.current(currentCount);
      }, 1000);
    };

    // Calculate aggregated performance statistics
    const calculatePerformanceStats = useCallback(() => {
      const metrics = perfMetricsRef.current;
      
      // Frame rate from actual frame times
      const fps = metrics.frameTimes.length > 0 ? 
        1000 / (metrics.frameTimes.reduce((a, b) => a + b, 0) / metrics.frameTimes.length) : 0;
      
      // Average processing time
      const avgProcessingTime = metrics.processingTimes.length > 0 ?
        metrics.processingTimes.reduce((a, b) => a + b, 0) / metrics.processingTimes.length : 0;
      
      // Average worker latency (send to return)
      const workerLatencies: number[] = [];
      framePerformanceRef.current.forEach((frame) => {
        if (frame.workerLatency > 0) {
          workerLatencies.push(frame.workerLatency);
        }
      });
      const avgWorkerLatency = workerLatencies.length > 0 ?
        workerLatencies.reduce((a, b) => a + b, 0) / workerLatencies.length : 0;
      
      // Average transfer latency
      const avgTransferLatency = metrics.transferLatencies.length > 0 ?
        metrics.transferLatencies.reduce((a, b) => a + b, 0) / metrics.transferLatencies.length : 0;
      
      // Average total latency
      const avgTotalLatency = metrics.workerLatencies.length > 0 ?
        metrics.workerLatencies.reduce((a, b) => a + b, 0) / metrics.workerLatencies.length : 0;
      
      perfStatsRef.current = {
        fps,
        avgProcessingTime,
        avgTotalLatency,
        avgTransferLatency,
        avgWorkerLatency,
        frameCount: metrics.totalFrames,
        droppedFrames: metrics.frameDrops,
        lastUpdate: performance.now(),
      };
    }, []);

    const drawScaleBar = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      const scaleBar = generateScaleBar(calibrationRef.current, width);
      const padding = 20;
      const barHeight = 8;
      const x = padding;
      const y = height - padding - barHeight;

      // Draw bar background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x - 5, y - 20, scaleBar.pixels + 10, barHeight + 35);

      // Draw bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, scaleBar.pixels, barHeight);

      // Draw end caps
      ctx.fillRect(x, y - 5, 2, barHeight + 10);
      ctx.fillRect(x + scaleBar.pixels - 2, y - 5, 2, barHeight + 10);

      // Draw label
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(scaleBar.label, x + scaleBar.pixels / 2, y + barHeight + 15);
    };

    const processFrame = useCallback(() => {
      if (!isMountedRef.current || !videoRef.current || !canvasRef.current || !processingEnabledRef.current) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState < 2) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const frameStart = performance.now();
      perfMetricsRef.current.totalFrames++;

      // Throttle processing based on settings
      const now = performance.now();
      const elapsed = now - lastFrameTimeRef.current;
      const targetInterval = 1000 / 15; // Max 15 fps for processing

      if (elapsed < targetInterval) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      lastFrameTimeRef.current = now;
      frameCountRef.current++;
      const currentFrameId = frameIdRef.current++;

      // Sync canvas dimensions if they changed (e.g. resolution adjustment)
      const canvasSyncStart = performance.now();
      resizeCanvasToVideo();
      const canvasSyncEnd = performance.now();

      // Draw video frame to canvas
      const drawStart = performance.now();
      ctx.drawImage(video, 0, 0);
      const drawEnd = performance.now();

      // Get image data
      const imageDataStart = performance.now();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const imageDataEnd = performance.now();

      // Initialize per-frame performance tracking
      framePerformanceRef.current.set(currentFrameId, {
        frameId: currentFrameId,
        captureTime: frameStart,
        canvasDrawTime: drawEnd - drawStart,
        imageDataTime: imageDataEnd - imageDataStart,
        workerSendTime: 0,
        workerReturnTime: 0,
        workerLatency: 0,
        overlayRenderTime: 0,
      });

      // Send frame to worker only if worker is not busy and component is mounted
      if (workerRef.current && !workerBusyRef.current && isMountedRef.current) {
        workerBusyRef.current = true;
        const messageSendStart = performance.now();
        workerRef.current.postMessage({
          imageData: imageData,
          settings: settingsRef.current,
          calibration: calibrationRef.current,
          frameId: currentFrameId,
          timestamp: now,
        });
        const messageSendEnd = performance.now();

        // Update frame performance data with worker send time
        if (framePerformanceRef.current.has(currentFrameId)) {
          framePerformanceRef.current.get(currentFrameId)!.workerSendTime = messageSendEnd;
        }

        // Set fail-safe timeout
        workerTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            workerBusyRef.current = false;
            perfMetricsRef.current.frameDrops++;
            console.warn(`[Main Thread] Frame ${currentFrameId} timeout after ${(performance.now() - now).toFixed(2)}ms`);
            onError('Worker response timeout');
          }
        }, 1500); // 1.5 second timeout

        // Log main thread frame processing details
        console.log(`[Main Thread] Frame ${currentFrameId} sent to worker:`, {
          totalFrameTime: `${(performance.now() - frameStart).toFixed(2)}ms`,
          canvasSyncTime: `${(canvasSyncEnd - canvasSyncStart).toFixed(2)}ms`,
          drawTime: `${(drawEnd - drawStart).toFixed(2)}ms`,
          imageDataTime: `${(imageDataEnd - imageDataStart).toFixed(2)}ms`,
          messageSendTime: `${(messageSendEnd - messageSendStart).toFixed(2)}ms`,
          imageSize: `${(imageData.data.length / 1024 / 1024).toFixed(2)}MB`,
        });
      } else {
        // Track frame drops when worker is busy
        perfMetricsRef.current.frameDrops++;
        console.log(`[Main Thread] Frame ${currentFrameId} dropped (worker busy)`);
      }

      // Draw overlay using latest particles
      const overlayStart = performance.now();
      if (showOverlayRef.current && overlayCanvasRef.current) {
        const overlay = overlayCanvasRef.current;
        const overlayCtx = overlay.getContext('2d');
        
        if (overlayCtx) {
          overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
          drawParticleOverlay(overlayCtx, latestParticlesRef.current, '#00ff00', true);

          if (showScaleBarRef.current) {
            drawScaleBar(overlayCtx, canvas.width, canvas.height);
          }
        }
      }
      const overlayEnd = performance.now();

      // Update frame performance data with overlay render time
      if (framePerformanceRef.current.has(currentFrameId)) {
        framePerformanceRef.current.get(currentFrameId)!.overlayRenderTime = overlayEnd - overlayStart;
      }

      // Track frame processing time
      perfMetricsRef.current.frameTimes.push(performance.now() - frameStart);

      console.log(`[Main Thread] Frame ${currentFrameId} overlay time: ${(overlayEnd - overlayStart).toFixed(2)}ms`);

      animationRef.current = requestAnimationFrame(processFrame);
    }, [resizeCanvasToVideo]);

    const startProcessingLoop = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(processFrame);
    };

    const startPerformanceMonitoring = () => {
      // Clear any existing monitor interval
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
      }

      // Set up 5-second monitoring interval
      monitorIntervalRef.current = setInterval(() => {
        if (!isMountedRef.current) return;

        // Calculate and log performance statistics
        calculatePerformanceStats();

        // Log aggregated statistics
        console.log(`[Monitor] Performance Stats (5s window):`, {
          fps: `${perfStatsRef.current.fps.toFixed(2)}`,
          avgProcessingTime: `${perfStatsRef.current.avgProcessingTime.toFixed(2)}ms`,
          avgWorkerLatency: `${perfStatsRef.current.avgWorkerLatency.toFixed(2)}ms`,
          avgTransferLatency: `${perfStatsRef.current.avgTransferLatency.toFixed(2)}ms`,
          avgTotalLatency: `${perfStatsRef.current.avgTotalLatency.toFixed(2)}ms`,
          totalFrames: perfStatsRef.current.frameCount,
          droppedFrames: perfStatsRef.current.droppedFrames,
          dropRate: `${((perfStatsRef.current.droppedFrames / perfStatsRef.current.frameCount) * 100).toFixed(2)}%`,
        });

        // Memory cleanup: keep only last 100 frames to prevent unbounded growth
        if (framePerformanceRef.current.size > 100) {
          const idsToDelete: number[] = [];
          const sortedIds = Array.from(framePerformanceRef.current.keys()).sort((a, b) => a - b);
          const deleteCount = sortedIds.length - 100;

          for (let i = 0; i < deleteCount; i++) {
            idsToDelete.push(sortedIds[i]);
          }

          idsToDelete.forEach((id) => {
            framePerformanceRef.current.delete(id);
          });

          console.log(`[Monitor] Cleaned up ${idsToDelete.length} old frame records, keeping last 100`);
        }
      }, 5000); // 5-second interval
    };

    return (
      <div className="relative bg-black rounded-lg overflow-hidden">
        {/* Hidden video element for webcam stream */}
        <video
          ref={videoRef}
          className="hidden"
          playsInline
          muted
        />

        {/* Main canvas for image display */}
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-auto"
        />

        {/* Overlay canvas for particle visualization */}
        <canvas
          ref={overlayCanvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* No stream indicator */}
        {!isStreaming && !externalImage && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/90">
            <div className="text-center text-muted-foreground">
              <div className="size-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <svg
                  className="size-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium">No active feed</p>
              <p className="text-xs mt-1">Select an image source and start streaming</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);
