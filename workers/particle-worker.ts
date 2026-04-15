import { processImage } from '../app/lib/image-processing';
import type { Particle, DetectionSettings, CalibrationSettings } from '../app/lib/types';

interface WorkerMessage {
  imageData: ImageData;
  settings: DetectionSettings;
  calibration: CalibrationSettings;
  frameId: number;
  timestamp: number;
}

interface WorkerResponse {
  particles?: Particle[];
  error?: string;
  frameId: number;
  processingTime: number;
  totalTime: number;
  performanceTrace: PerformanceTrace;
}

interface PerformanceTrace {
  workerId: string;
  frameId: number;
  timestamps: {
    workerReceive: number;
    processingStart: number;
    processingEnd: number;
    responseSend: number;
  };
  metrics: {
    imageDataSize: number;
    particlesCount: number;
    transferTime?: number;
    memoryUsage?: {
      used: number;
      total: number;
      limit: number;
    };
  };
  systemInfo: {
    userAgent: string;
    hardwareConcurrency: number;
    deviceMemory?: number;
  };
}

// Worker initialization tracking
const WORKER_ID = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const WORKER_START_TIME = performance.now();

console.log(`[Worker ${WORKER_ID}] Initialized at ${new Date().toISOString()}`);
console.log(`[Worker ${WORKER_ID}] System Info:`, {
  userAgent: navigator.userAgent,
  hardwareConcurrency: navigator.hardwareConcurrency,
  deviceMemory: (navigator as any).deviceMemory,
  platform: navigator.platform,
  language: navigator.language,
  cookieEnabled: navigator.cookieEnabled,
  onLine: navigator.onLine,
});

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const workerReceiveTime = performance.now();
  const { imageData, settings, calibration, frameId, timestamp } = event.data;
  
  const transferTime = typeof timestamp === 'number' ? Math.max(0, workerReceiveTime - timestamp) : undefined;
  
  let didRespond = false;
  const PROCESSING_TIMEOUT_MS = 2500; // 2.5 seconds max processing time
  const timeoutId = setTimeout(() => {
    if (didRespond) return;
    didRespond = true;

    const timeoutResponse: WorkerResponse = {
      error: `Processing timeout after ${PROCESSING_TIMEOUT_MS}ms`,
      frameId,
      processingTime: 0,
      totalTime: performance.now() - workerReceiveTime,
      performanceTrace: {
        workerId: WORKER_ID,
        frameId,
        timestamps: {
          workerReceive: workerReceiveTime,
          processingStart: 0,
          processingEnd: 0,
          responseSend: performance.now(),
        },
        metrics: {
          imageDataSize: imageData?.data?.length ?? 0,
          particlesCount: 0,
          transferTime,
          memoryUsage: undefined,
        },
        systemInfo: {
          userAgent: navigator.userAgent,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: (navigator as any).deviceMemory,
        },
      },
    };
    self.postMessage(timeoutResponse);
  }, PROCESSING_TIMEOUT_MS);
  
  try {
    const processingStart = performance.now();
    const { particles } = processImage(imageData, settings, calibration);
    const processingEnd = performance.now();
    
    // Clear timeout since processing completed
    clearTimeout(timeoutId);
    
    if (didRespond) return;
    didRespond = true;

    const responseSendTime = performance.now();
    const memory = (performance as any).memory;
    const memoryInfo = memory ? {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
    } : undefined;
    
    const performanceTrace: PerformanceTrace = {
      workerId: WORKER_ID,
      frameId,
      timestamps: {
        workerReceive: workerReceiveTime,
        processingStart,
        processingEnd,
        responseSend: responseSendTime,
      },
      metrics: {
        imageDataSize: imageData?.data?.length ?? 0,
        particlesCount: particles?.length ?? 0,
        transferTime,
        memoryUsage: memoryInfo,
      },
      systemInfo: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory,
      },
    };
    
    const response: WorkerResponse = { 
      particles,
      frameId,
      processingTime: processingEnd - processingStart,
      totalTime: responseSendTime - workerReceiveTime,
      performanceTrace,
    };
    
    self.postMessage(response);
    
    console.log(`[Worker ${WORKER_ID}] Frame ${frameId} processed:`, {
      totalTime: `${(responseSendTime - workerReceiveTime).toFixed(2)}ms`,
      processingTime: `${(processingEnd - processingStart).toFixed(2)}ms`,
      transferTime: transferTime !== undefined ? `${transferTime.toFixed(2)}ms` : 'N/A',
      particlesFound: particles?.length ?? 0,
      imageSize: `${((imageData?.data?.length ?? 0) / 1024 / 1024).toFixed(2)}MB`,
      memoryUsed: memoryInfo ? `${(memoryInfo.used / 1024 / 1024).toFixed(2)}MB` : 'N/A',
    });
    
  } catch (error) {
    // Clear timeout on error
    clearTimeout(timeoutId);
    
    if (didRespond) return;
    didRespond = true;

    const errorTime = performance.now();
    const memory = (performance as any).memory;
    const memoryInfo = memory ? {
      used: memory.usedJSHeapSize,
      total: memory.totalJSHeapSize,
      limit: memory.jsHeapSizeLimit,
    } : undefined;
    
    const performanceTrace: PerformanceTrace = {
      workerId: WORKER_ID,
      frameId,
      timestamps: {
        workerReceive: workerReceiveTime,
        processingStart: 0,
        processingEnd: 0,
        responseSend: errorTime,
      },
      metrics: {
        imageDataSize: imageData?.data?.length ?? 0,
        particlesCount: 0,
        transferTime,
        memoryUsage: memoryInfo,
      },
      systemInfo: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory,
      },
    };
    
    const response: WorkerResponse = {
      error: error instanceof Error ? error.message : 'Unknown error in worker',
      frameId,
      processingTime: 0,
      totalTime: errorTime - workerReceiveTime,
      performanceTrace,
    };
    
    self.postMessage(response);
    
    console.error(`[Worker ${WORKER_ID}] Frame ${frameId} error:`, error);
  }
};
