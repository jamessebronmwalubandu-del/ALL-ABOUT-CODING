// Multi-source image handling utilities
import type { ImageSourceType, ImageSourceConfig } from './types';

/**
 * Check if camera permissions are granted
 */
export async function checkCameraPermissions(): Promise<PermissionState> {
  if (!navigator.permissions) {
    // Fallback for browsers that don't support permissions API
    return 'prompt';
  }

  try {
    const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
    return result.state;
  } catch (error) {
    // Fallback if permissions API fails
    return 'prompt';
  }
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  try {
    // Try to get a temporary stream to request permissions
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });
    // Immediately stop the stream
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get available video input devices (cameras)
 */
export async function getVideoDevices(): Promise<MediaDeviceInfo[]> {
  try {
    // Check permissions first
    const permissionState = await checkCameraPermissions();
    if (permissionState === 'denied') {
      throw new Error('Camera permissions denied');
    }

    // Request permissions if needed
    if (permissionState === 'prompt') {
      const granted = await requestCameraPermissions();
      if (!granted) {
        throw new Error('Camera permissions denied');
      }
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  } catch (error) {
    console.error('Error getting video devices:', error);
    return [];
  }
}

/**
 * Get webcam stream
 */
export async function getWebcamStream(
  deviceId?: string,
  resolution?: { width: number; height: number }
): Promise<MediaStream> {
  // Check if media devices are supported
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera access is not supported in this browser');
  }

  const constraints: MediaStreamConstraints = {
    video: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      width: resolution?.width || { ideal: 1920 },
      height: resolution?.height || { ideal: 1080 },
    },
  };

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    // Re-throw with more context
    throw error;
  }
}

/**
 * Fetch image from URL (for IP cameras, HTTP endpoints)
 */
export async function fetchImageFromUrl(
  url: string,
  auth?: { username: string; password: string }
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Handle authentication by embedding in URL (basic auth)
    let finalUrl = url;
    if (auth?.username && auth?.password) {
      try {
        const urlObj = new URL(url);
        urlObj.username = auth.username;
        urlObj.password = auth.password;
        finalUrl = urlObj.toString();
      } catch {
        // Keep original URL if parsing fails
      }
    }
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image from ${url}`));
    img.src = finalUrl;
  });
}

/**
 * Load image from File object (for file uploads)
 */
export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Load image from clipboard
 */
export async function loadImageFromClipboard(): Promise<HTMLImageElement | null> {
  try {
    const items = await navigator.clipboard.read();
    
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          const url = URL.createObjectURL(blob);
          
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(url);
              resolve(img);
            };
            img.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error('Failed to load clipboard image'));
            };
            img.src = url;
          });
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Clipboard access error:', error);
    return null;
  }
}

/**
 * Draw image to canvas and get ImageData
 */
export function imageToImageData(
  img: HTMLImageElement,
  targetWidth?: number,
  targetHeight?: number
): ImageData {
  const width = targetWidth || img.naturalWidth;
  const height = targetHeight || img.naturalHeight;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  
  return ctx.getImageData(0, 0, width, height);
}

/**
 * Video frame to ImageData
 */
export function videoFrameToImageData(
  video: HTMLVideoElement,
  targetWidth?: number,
  targetHeight?: number
): ImageData {
  const width = targetWidth || video.videoWidth;
  const height = targetHeight || video.videoHeight;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, width, height);
  
  return ctx.getImageData(0, 0, width, height);
}

/**
 * IP Camera stream handler (MJPEG polling)
 */
export class IPCameraStream {
  private url: string;
  private interval: number;
  private timer: NodeJS.Timeout | null = null;
  private onFrame: (img: HTMLImageElement) => void;
  private running: boolean = false;
  
  constructor(
    url: string,
    interval: number,
    onFrame: (img: HTMLImageElement) => void
  ) {
    this.url = url;
    this.interval = interval;
    this.onFrame = onFrame;
  }
  
  start(): void {
    if (this.running) return;
    this.running = true;
    this.poll();
  }
  
  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
  
  private async poll(): Promise<void> {
    if (!this.running) return;
    
    try {
      // Add timestamp to prevent caching
      const urlWithTimestamp = `${this.url}${this.url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const img = await fetchImageFromUrl(urlWithTimestamp);
      this.onFrame(img);
    } catch (error) {
      console.error('IP camera poll error:', error);
    }
    
    if (this.running) {
      this.timer = setTimeout(() => this.poll(), this.interval);
    }
  }
  
  setUrl(url: string): void {
    this.url = url;
  }
  
  setInterval(interval: number): void {
    this.interval = interval;
  }
}

/**
 * Batch image processor for file uploads
 */
export async function processBatchImages(
  files: File[],
  onProgress: (current: number, total: number) => void,
  onImage: (img: HTMLImageElement, file: File) => Promise<void>
): Promise<void> {
  const imageFiles = files.filter(f => f.type.startsWith('image/'));
  
  for (let i = 0; i < imageFiles.length; i++) {
    onProgress(i + 1, imageFiles.length);
    
    try {
      const img = await loadImageFromFile(imageFiles[i]);
      await onImage(img, imageFiles[i]);
    } catch (error) {
      console.error(`Error processing ${imageFiles[i].name}:`, error);
    }
  }
}

/**
 * Check if browser supports required APIs
 */
export function checkBrowserSupport(): {
  webcam: boolean;
  clipboard: boolean;
  fileSystemAccess: boolean;
} {
  return {
    webcam: !!navigator.mediaDevices?.getUserMedia,
    clipboard: !!navigator.clipboard?.read,
    fileSystemAccess: 'showOpenFilePicker' in window,
  };
}

/**
 * Supported image formats for file upload
 */
export const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/bmp',
  'image/tiff',
  'image/webp',
];

export const SUPPORTED_IMAGE_EXTENSIONS = '.jpg,.jpeg,.png,.bmp,.tiff,.tif,.webp';
