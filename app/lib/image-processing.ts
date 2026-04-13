// Image Processing Algorithms for Particle Detection
import type { Particle, DetectionSettings, CalibrationSettings } from './types';

/**
 * Resize image data to maximum dimensions while maintaining aspect ratio
 */
export function resizeImageData(imageData: ImageData, maxWidth: number, maxHeight: number): ImageData {
  const { width, height } = imageData;
  const aspectRatio = width / height;
  
  let newWidth = width;
  let newHeight = height;
  
  if (width > maxWidth) {
    newWidth = maxWidth;
    newHeight = Math.round(maxWidth / aspectRatio);
  }
  
  if (newHeight > maxHeight) {
    newHeight = maxHeight;
    newWidth = Math.round(maxHeight * aspectRatio);
  }
  
  if (newWidth === width && newHeight === height) {
    return imageData; // No resize needed
  }
  
  const output = new ImageData(newWidth, newHeight);
  const scaleX = width / newWidth;
  const scaleY = height / newHeight;
  
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * newWidth + x) * 4;
      
      output.data[dstIdx] = imageData.data[srcIdx];
      output.data[dstIdx + 1] = imageData.data[srcIdx + 1];
      output.data[dstIdx + 2] = imageData.data[srcIdx + 2];
      output.data[dstIdx + 3] = imageData.data[srcIdx + 3];
    }
  }
  
  return output;
}

/**
 * Convert image data to grayscale
 */
export function toGrayscale(imageData: ImageData): ImageData {
  const data = imageData.data;
  const output = new ImageData(imageData.width, imageData.height);
  
  for (let i = 0; i < data.length; i += 4) {
    // Luminosity method for grayscale conversion
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    output.data[i] = gray;
    output.data[i + 1] = gray;
    output.data[i + 2] = gray;
    output.data[i + 3] = data[i + 3];
  }
  
  return output;
}

/**
 * Apply Gaussian blur to reduce noise
 */
export function gaussianBlur(imageData: ImageData, kernelSize: number): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new ImageData(width, height);
  
  // Generate Gaussian kernel
  const sigma = kernelSize / 6;
  const kernel: number[] = [];
  let sum = 0;
  const halfSize = Math.floor(kernelSize / 2);
  
  for (let i = -halfSize; i <= halfSize; i++) {
    const val = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(val);
    sum += val;
  }
  
  // Normalize kernel
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }
  
  // Apply horizontal blur
  const temp = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = -halfSize; k <= halfSize; k++) {
        const px = Math.min(Math.max(x + k, 0), width - 1);
        const idx = (y * width + px) * 4;
        const weight = kernel[k + halfSize];
        r += data[idx] * weight;
        g += data[idx + 1] * weight;
        b += data[idx + 2] * weight;
      }
      const outIdx = (y * width + x) * 4;
      temp[outIdx] = r;
      temp[outIdx + 1] = g;
      temp[outIdx + 2] = b;
      temp[outIdx + 3] = data[outIdx + 3];
    }
  }
  
  // Apply vertical blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = -halfSize; k <= halfSize; k++) {
        const py = Math.min(Math.max(y + k, 0), height - 1);
        const idx = (py * width + x) * 4;
        const weight = kernel[k + halfSize];
        r += temp[idx] * weight;
        g += temp[idx + 1] * weight;
        b += temp[idx + 2] * weight;
      }
      const outIdx = (y * width + x) * 4;
      output.data[outIdx] = Math.round(r);
      output.data[outIdx + 1] = Math.round(g);
      output.data[outIdx + 2] = Math.round(b);
      output.data[outIdx + 3] = 255;
    }
  }
  
  return output;
}

/**
 * Apply binary threshold
 */
export function threshold(imageData: ImageData, thresh: number, invert: boolean = false): ImageData {
  const data = imageData.data;
  const output = new ImageData(imageData.width, imageData.height);
  
  for (let i = 0; i < data.length; i += 4) {
    const val = data[i] > thresh ? 255 : 0;
    const finalVal = invert ? 255 - val : val;
    output.data[i] = finalVal;
    output.data[i + 1] = finalVal;
    output.data[i + 2] = finalVal;
    output.data[i + 3] = 255;
  }
  
  return output;
}

/**
 * Apply adaptive threshold (better for uneven lighting)
 */
export function adaptiveThreshold(
  imageData: ImageData, 
  blockSize: number, 
  c: number,
  invert: boolean = false
): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new ImageData(width, height);
  const halfBlock = Math.floor(blockSize / 2);
  
  // Create integral image for fast mean calculation
  const integral = new Float64Array((width + 1) * (height + 1));
  
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += data[(y * width + x) * 4];
      integral[(y + 1) * (width + 1) + (x + 1)] = 
        rowSum + integral[y * (width + 1) + (x + 1)];
    }
  }
  
  // Apply adaptive threshold using integral image
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfBlock);
      const y1 = Math.max(0, y - halfBlock);
      const x2 = Math.min(width - 1, x + halfBlock);
      const y2 = Math.min(height - 1, y + halfBlock);
      
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum = 
        integral[(y2 + 1) * (width + 1) + (x2 + 1)] -
        integral[(y2 + 1) * (width + 1) + x1] -
        integral[y1 * (width + 1) + (x2 + 1)] +
        integral[y1 * (width + 1) + x1];
      
      const mean = sum / count;
      const idx = (y * width + x) * 4;
      const pixel = data[idx];
      const val = pixel > (mean - c) ? 255 : 0;
      const finalVal = invert ? 255 - val : val;
      
      output.data[idx] = finalVal;
      output.data[idx + 1] = finalVal;
      output.data[idx + 2] = finalVal;
      output.data[idx + 3] = 255;
    }
  }
  
  return output;
}

/**
 * Morphological erosion - shrink white regions
 */
export function erode(imageData: ImageData, kernelSize: number): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new ImageData(width, height);
  const halfKernel = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 255;
      
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const px = Math.min(Math.max(x + kx, 0), width - 1);
          const py = Math.min(Math.max(y + ky, 0), height - 1);
          const idx = (py * width + px) * 4;
          minVal = Math.min(minVal, data[idx]);
        }
      }
      
      const outIdx = (y * width + x) * 4;
      output.data[outIdx] = minVal;
      output.data[outIdx + 1] = minVal;
      output.data[outIdx + 2] = minVal;
      output.data[outIdx + 3] = 255;
    }
  }
  
  return output;
}

/**
 * Morphological dilation - expand white regions
 */
export function dilate(imageData: ImageData, kernelSize: number): ImageData {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  const output = new ImageData(width, height);
  const halfKernel = Math.floor(kernelSize / 2);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxVal = 0;
      
      for (let ky = -halfKernel; ky <= halfKernel; ky++) {
        for (let kx = -halfKernel; kx <= halfKernel; kx++) {
          const px = Math.min(Math.max(x + kx, 0), width - 1);
          const py = Math.min(Math.max(y + ky, 0), height - 1);
          const idx = (py * width + px) * 4;
          maxVal = Math.max(maxVal, data[idx]);
        }
      }
      
      const outIdx = (y * width + x) * 4;
      output.data[outIdx] = maxVal;
      output.data[outIdx + 1] = maxVal;
      output.data[outIdx + 2] = maxVal;
      output.data[outIdx + 3] = 255;
    }
  }
  
  return output;
}

/**
 * Opening operation (erosion followed by dilation) - removes small noise
 */
export function opening(imageData: ImageData, kernelSize: number): ImageData {
  return dilate(erode(imageData, kernelSize), kernelSize);
}

/**
 * Closing operation (dilation followed by erosion) - fills small holes
 */
export function closing(imageData: ImageData, kernelSize: number): ImageData {
  return erode(dilate(imageData, kernelSize), kernelSize);
}

/**
 * Connected component labeling using flood fill
 */
export function findContours(binaryImage: ImageData): number[][] {
  const width = binaryImage.width;
  const height = binaryImage.height;
  const data = binaryImage.data;
  const visited = new Uint8Array(width * height);
  const contours: number[][] = [];
  const MAX_CONTOURS_PER_FRAME = 100; // Reduced for real-time performance
  const MAX_CONTOUR_POINTS = 10000; // Reduced for real-time performance
  const MAX_FLOOD_STACK_SIZE = 25000; // Reduced for real-time performance
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (contours.length >= MAX_CONTOURS_PER_FRAME) {
        return contours;
      }

      const idx = y * width + x;
      if (visited[idx] || data[idx * 4] === 0) continue;
      
      const component: number[] = [];
      const stack: [number, number][] = [[x, y]];
      let pointCount = 0;
      let aborted = false;
      
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
        const cIdx = cy * width + cx;
        if (visited[cIdx] || data[cIdx * 4] === 0) continue;
        
        visited[cIdx] = 1;
        component.push(cx, cy);
        pointCount++;
        
        if (pointCount > MAX_CONTOUR_POINTS || stack.length > MAX_FLOOD_STACK_SIZE) {
          aborted = true;
          break;
        }
        
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      
      if (!aborted && component.length >= 4) {
        contours.push(component);
      }
    }
  }
  
  return contours;
}

/**
 * Calculate particle properties from contour
 */
export function calculateParticleProperties(
  contour: number[],
  calibration: CalibrationSettings,
  id: number
): Particle {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < contour.length; i += 2) {
    points.push({ x: contour[i], y: contour[i + 1] });
  }
  
  // Calculate area (number of pixels)
  const area = points.length;
  
  // Calculate centroid
  let sumX = 0, sumY = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
  }
  const centroid = { x: sumX / points.length, y: sumY / points.length };
  
  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const boundingBox = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  
  // Calculate perimeter (boundary pixels)
  const perimeterPoints = new Set<string>();
  for (const p of points) {
    // Check if this is a boundary pixel
    const isEdge = points.some(other => 
      (Math.abs(other.x - p.x) === 1 && other.y === p.y) ||
      (Math.abs(other.y - p.y) === 1 && other.x === p.x)
    );
    if (isEdge) {
      perimeterPoints.add(`${p.x},${p.y}`);
    }
  }
  const perimeter = Math.max(perimeterPoints.size, Math.PI * 2 * Math.sqrt(area / Math.PI));
  
  // Calculate equivalent circular diameter in mm
  const areaInMm2 = area / (calibration.pixelsPerMm * calibration.pixelsPerMm);
  const diameter = 2 * Math.sqrt(areaInMm2 / Math.PI);
  
  // Calculate circularity (1.0 = perfect circle)
  const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
  
  // Calculate aspect ratio
  const aspectRatio = boundingBox.width / Math.max(boundingBox.height, 1);
  
  return {
    id,
    area,
    perimeter,
    diameter,
    centroid,
    boundingBox,
    aspectRatio,
    circularity: Math.min(circularity, 1.0), // Cap at 1.0
  };
}

/**
 * Full image processing pipeline for particle detection
 */
export function processImage(
  imageData: ImageData,
  settings: DetectionSettings,
  calibration: CalibrationSettings
): { particles: Particle[]; processedImage: ImageData } {
  // Resize image to maximum 640x480 for real-time performance (reduced from 1024x768)
  const maxWidth = 640;
  const maxHeight = 480;
  const originalWidth = imageData.width;
  const originalHeight = imageData.height;
  let processed = resizeImageData(imageData, maxWidth, maxHeight);
  const scaleX = processed.width / originalWidth;
  const scaleY = processed.height / originalHeight;
  const scale = Math.min(scaleX, scaleY); // Use the smaller scale to maintain aspect
  
  // Adjust calibration for resized image
  const adjustedCalibration = {
    ...calibration,
    pixelsPerMm: calibration.pixelsPerMm * scale,
  };
  
  // Step 1: Convert to grayscale
  processed = toGrayscale(processed);
  
  // Step 2: Apply Gaussian blur to reduce noise (optimize for speed)
  if (settings.blurKernel > 1) {
    // Limit blur kernel for performance - max 3 for real-time
    const optimizedBlurKernel = Math.min(settings.blurKernel, 3);
    processed = gaussianBlur(processed, optimizedBlurKernel);
  }
  
  // Step 3: Apply threshold (adaptive or fixed) - optimize for speed
  if (settings.useAdaptiveThreshold) {
    // For real-time performance, use a simpler adaptive approach
    // Limit block size for performance
    const optimizedBlockSize = Math.min(settings.adaptiveBlockSize, 15);
    processed = adaptiveThreshold(
      processed, 
      optimizedBlockSize, 
      settings.adaptiveC,
      settings.invertImage
    );
  } else {
    processed = threshold(processed, settings.threshold, settings.invertImage);
  }
  
  // Step 4: Morphological operations to clean up (optimize for speed)
  if (settings.morphKernel > 1) {
    // Limit morphology kernel for performance - max 3 for real-time
    const optimizedMorphKernel = Math.min(settings.morphKernel, 3);
    processed = opening(processed, optimizedMorphKernel);
    processed = closing(processed, optimizedMorphKernel);
  }
  
  // Step 5: Find contours (optimized for real-time)
  const contours = findContours(processed);
  
  // Step 6: Calculate particle properties with filtering (limit for performance)
  const particles: Particle[] = [];
  let id = 0;
  const MAX_PARTICLES = 200; // Limit particles for real-time performance
  
  for (const contour of contours) {
    if (particles.length >= MAX_PARTICLES) break; // Early termination
    
    const area = contour.length / 2;
    
    // Filter by size
    if (area < settings.minParticleSize || area > settings.maxParticleSize) {
      continue;
    }
    
    const particle = calculateParticleProperties(contour, adjustedCalibration, id++);
    particles.push(particle);
  }
  
  return { particles, processedImage: processed };
}

/**
 * Fast particle counting for real-time feedback
 */
export function countParticlesFast(
  imageData: ImageData,
  settings: DetectionSettings
): number {
  // Quick resize for fast counting
  const fastWidth = 320;
  const fastHeight = 240;
  let processed = resizeImageData(imageData, fastWidth, fastHeight);
  
  // Simple grayscale
  processed = toGrayscale(processed);
  
  // Simple threshold
  const thresholdValue = settings.useAdaptiveThreshold ? 127 : settings.threshold;
  processed = threshold(processed, thresholdValue, settings.invertImage);
  
  // Count white pixels as rough particle estimate
  let whitePixels = 0;
  const data = processed.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 127) whitePixels++;
  }
  
  // Estimate particles (rough heuristic: assume average particle is 50 pixels)
  return Math.max(1, Math.round(whitePixels / 50));
}
