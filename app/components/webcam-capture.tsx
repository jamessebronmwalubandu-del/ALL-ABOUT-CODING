'use client';

import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import type { Particle, DetectionSettings, CalibrationSettings } from '../lib/types';
import { processImage, drawParticleOverlay } from '../lib/image-processing';
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
  onParticlesDetected: (particles: Particle[], imageData: ImageData) => void;
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
        if (processingEnabled) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const { particles } = processImage(imageData, settings, calibration);
          onParticlesDetectedRef.current(particles, imageData);

          // Draw overlay
          if (showOverlay && overlayCanvasRef.current) {
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
        // Atomic capture and reset to ensure accuracy
        const currentCount = frameCountRef.current;
        frameCountRef.current = 0; 
        onFpsUpdateRef.current(currentCount);
      }, 1000);
    };

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
      if (!videoRef.current || !canvasRef.current || !processingEnabledRef.current) {
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

      // Sync canvas dimensions if they changed (e.g. resolution adjustment)
      resizeCanvasToVideo();

      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0);

      // Get image data and process
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { particles } = processImage(imageData, settingsRef.current, calibrationRef.current);

      // Throttle React UI updates (charts, metrics) to ~4 FPS to prevent freezing
      const uiElapsed = now - lastUiUpdateRef.current;
      if (uiElapsed >= 250) { // 250ms interval
        onParticlesDetectedRef.current(particles, imageData);
        lastUiUpdateRef.current = now;
      }

      // Draw overlay
      if (showOverlayRef.current && overlayCanvasRef.current) {
        const overlay = overlayCanvasRef.current;
        const overlayCtx = overlay.getContext('2d');
        
        if (overlayCtx) {
          overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
          drawParticleOverlay(overlayCtx, particles, '#00ff00', true);

          if (showScaleBarRef.current) {
            drawScaleBar(overlayCtx, canvas.width, canvas.height);
          }
        }
      }

      animationRef.current = requestAnimationFrame(processFrame);
    }, [resizeCanvasToVideo]);

    const startProcessingLoop = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(processFrame);
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
