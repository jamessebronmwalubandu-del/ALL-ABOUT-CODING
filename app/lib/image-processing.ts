// Image Processing Algorithms for Particle Detection
import type { Particle, DetectionSettings, CalibrationSettings } from './types';

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
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (visited[idx] || data[idx * 4] === 0) continue;
      
      // Flood fill to find connected component
      const component: number[] = [];
      const stack: [number, number][] = [[x, y]];
      
      while (stack.length > 0) {
        const [cx, cy] = stack.pop()!;
        const cIdx = cy * width + cx;
        
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
        if (visited[cIdx] || data[cIdx * 4] === 0) continue;
        
        visited[cIdx] = 1;
        component.push(cx, cy);
        
        // 4-connected neighbors
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
      
      if (component.length >= 4) { // At least 2 pixels
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
  // Step 1: Convert to grayscale
  let processed = toGrayscale(imageData);
  
  // Step 2: Apply Gaussian blur to reduce noise
  if (settings.blurKernel > 1) {
    processed = gaussianBlur(processed, settings.blurKernel);
  }
  
  // Step 3: Apply threshold (adaptive or fixed)
  if (settings.useAdaptiveThreshold) {
    processed = adaptiveThreshold(
      processed, 
      settings.adaptiveBlockSize, 
      settings.adaptiveC,
      settings.invertImage
    );
  } else {
    processed = threshold(processed, settings.threshold, settings.invertImage);
  }
  
  // Step 4: Morphological operations to clean up
  if (settings.morphKernel > 1) {
    processed = opening(processed, settings.morphKernel);
    processed = closing(processed, settings.morphKernel);
  }
  
  // Step 5: Find contours
  const contours = findContours(processed);
  
  // Step 6: Calculate particle properties with filtering
  const particles: Particle[] = [];
  let id = 0;
  
  for (const contour of contours) {
    const area = contour.length / 2;
    
    // Filter by size
    if (area < settings.minParticleSize || area > settings.maxParticleSize) {
      continue;
    }
    
    const particle = calculateParticleProperties(contour, calibration, id++);
    particles.push(particle);
  }
  
  return { particles, processedImage: processed };
}

/**
 * Draw particle outlines on canvas
 */
export function drawParticleOverlay(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  color: string = '#00ff00',
  showLabels: boolean = true
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.font = '10px monospace';
  ctx.fillStyle = color;
  
  for (const particle of particles) {
    const { boundingBox, diameter, id } = particle;
    
    // Draw bounding box
    ctx.strokeRect(boundingBox.x, boundingBox.y, boundingBox.width, boundingBox.height);
    
    // Draw label
    if (showLabels) {
      const label = `${diameter.toFixed(1)}mm`;
      ctx.fillText(label, boundingBox.x, boundingBox.y - 2);
    }
  }
}
