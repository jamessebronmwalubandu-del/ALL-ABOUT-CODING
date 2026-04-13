// Particle Size Distribution Statistical Calculations
import type { Particle, PSDMetrics, SizeClass, STANDARD_SIZE_CLASSES } from './types';

/**
 * Generate size classes for analysis
 * Uses geometric progression (typical for sieve analysis)
 */
export function generateSizeClasses(
  minSize: number,
  maxSize: number,
  numClasses: number = 20
): SizeClass[] {
  const classes: SizeClass[] = [];
  const ratio = Math.pow(maxSize / minSize, 1 / numClasses);
  
  let currentMin = minSize;
  for (let i = 0; i < numClasses; i++) {
    const currentMax = currentMin * ratio;
    classes.push({
      sizeMin: currentMin,
      sizeMax: currentMax,
      midpoint: Math.sqrt(currentMin * currentMax), // Geometric mean
      count: 0,
      frequency: 0,
      cumRetained: 0,
      cumPassing: 0,
    });
    currentMin = currentMax;
  }
  
  return classes.reverse(); // Largest to smallest (standard sieve order)
}

/**
 * Generate size classes from standard sieve sizes
 */
export function generateStandardSizeClasses(
  particles: Particle[],
  standardSizes: number[] = [150, 125, 106, 90, 75, 63, 53, 45, 37.5, 31.5,
    26.5, 22.4, 19, 16, 13.2, 11.2, 9.5, 8, 6.7, 5.6,
    4.75, 4, 3.35, 2.8, 2.36, 2, 1.7, 1.4, 1.18, 1,
    0.85, 0.71, 0.6, 0.5, 0.425, 0.355, 0.3, 0.25,
    0.212, 0.18, 0.15, 0.125, 0.106, 0.09, 0.075, 0.063, 0.053, 0.045]
): SizeClass[] {
  if (particles.length === 0) {
    return [];
  }

  // Find min and max particle sizes
  const sizes = particles.map(p => p.diameter);
  const minParticle = Math.min(...sizes);
  const maxParticle = Math.max(...sizes);
  
  // Filter standard sizes to relevant range
  const relevantSizes = standardSizes
    .filter(s => s >= minParticle * 0.5 && s <= maxParticle * 1.5)
    .sort((a, b) => b - a); // Descending order
  
  if (relevantSizes.length < 2) {
    // Generate custom classes if no standard sizes fit
    return generateSizeClasses(minParticle, maxParticle, 15);
  }
  
  const classes: SizeClass[] = [];
  
  for (let i = 0; i < relevantSizes.length - 1; i++) {
    classes.push({
      sizeMax: relevantSizes[i],
      sizeMin: relevantSizes[i + 1],
      midpoint: Math.sqrt(relevantSizes[i] * relevantSizes[i + 1]),
      count: 0,
      frequency: 0,
      cumRetained: 0,
      cumPassing: 0,
    });
  }
  
  // Add undersize class
  classes.push({
    sizeMax: relevantSizes[relevantSizes.length - 1],
    sizeMin: 0,
    midpoint: relevantSizes[relevantSizes.length - 1] / 2,
    count: 0,
    frequency: 0,
    cumRetained: 0,
    cumPassing: 0,
  });
  
  return classes;
}

/**
 * Classify particles into size classes and calculate frequencies
 */
export function classifyParticles(
  particles: Particle[],
  sizeClasses: SizeClass[]
): SizeClass[] {
  if (particles.length === 0 || sizeClasses.length === 0) {
    return sizeClasses;
  }

  const classes = sizeClasses.map(c => ({ ...c, count: 0 }));
  
  // Count particles in each class using right-closed intervals
  for (const particle of particles) {
    for (const cls of classes) {
      if (particle.diameter > cls.sizeMin && particle.diameter <= cls.sizeMax) {
        cls.count++;
        break;
      }
    }
  }
  
  // Calculate frequencies and cumulative values
  const totalCount = particles.length;
  let cumRetained = 0;
  
  for (const cls of classes) {
    cls.frequency = (cls.count / totalCount) * 100;
    cumRetained += cls.frequency;
    cls.cumRetained = cumRetained;
    cls.cumPassing = 100 - cumRetained;
  }
  
  return classes;
}

/**
 * Interpolate passing percentage at a given size
 */
function interpolatePassingSize(
  sizeClasses: SizeClass[],
  targetPassing: number
): number {
  if (sizeClasses.length === 0) return 0;

  // Sort by size descending to preserve standard sieve order
  const sorted = [...sizeClasses].sort((a, b) => b.sizeMax - a.sizeMax);

  const clampTarget = Math.max(0, Math.min(100, targetPassing));

  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  if (clampTarget >= top.cumPassing) {
    return top.sizeMax;
  }
  if (clampTarget <= bottom.cumPassing) {
    return bottom.sizeMin > 0 ? bottom.sizeMin : bottom.sizeMax;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const upper = sorted[i];
    const lower = sorted[i + 1];

    if (upper.cumPassing >= clampTarget && lower.cumPassing <= clampTarget) {
      if (upper.cumPassing === lower.cumPassing || upper.sizeMax <= 0 || lower.sizeMax <= 0) {
        return upper.sizeMax;
      }

      const logUpper = Math.log10(upper.sizeMax);
      const logLower = Math.log10(lower.sizeMax);
      const fraction = (clampTarget - upper.cumPassing) / (lower.cumPassing - upper.cumPassing);
      return Math.pow(10, logUpper + fraction * (logLower - logUpper));
    }
  }

  return bottom.sizeMin > 0 ? bottom.sizeMin : bottom.sizeMax;
}

/**
 * Calculate all PSD metrics from particles
 */
export function calculatePSDMetrics(
  particles: Particle[],
  sizeClasses: SizeClass[],
  f80Override?: number
): PSDMetrics {
  if (particles.length === 0) {
    return {
      d10: 0,
      d50: 0,
      d80: 0,
      d90: 0,
      p80: 0,
      f80: f80Override || 0,
      mean: 0,
      mode: 0,
      span: 0,
      min: 0,
      max: 0,
      count: 0,
      cv: 0,
    };
  }

  const sizes = particles.map(p => p.diameter).sort((a, b) => a - b);
  const n = sizes.length;
  
  // Basic statistics
  const min = sizes[0];
  const max = sizes[n - 1];
  const sum = sizes.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  
  // Standard deviation and CV
  const variance = sizes.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / mean) * 100;
  
  const percentileValue = (percent: number): number => {
    if (n === 1) return sizes[0];
    const rank = (percent / 100) * (n - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);
    if (lowerIndex === upperIndex) return sizes[lowerIndex];
    const fraction = rank - lowerIndex;
    return sizes[lowerIndex] * (1 - fraction) + sizes[upperIndex] * fraction;
  };

  // Percentiles (direct from sorted data with linear interpolation)
  const d10Direct = percentileValue(10);
  const d50Direct = percentileValue(50);
  const d80Direct = percentileValue(80);
  const d90Direct = percentileValue(90);
  
  let d10 = d10Direct;
  let d50 = d50Direct;
  let d80 = d80Direct;
  let d90 = d90Direct;
  
  if (sizeClasses.length > 0 && sizeClasses.some(c => c.count > 0)) {
    d10 = interpolatePassingSize(sizeClasses, 10);
    d50 = interpolatePassingSize(sizeClasses, 50);
    d80 = interpolatePassingSize(sizeClasses, 80);
    d90 = interpolatePassingSize(sizeClasses, 90);
  }
  
  // Calculate mode (most frequent size class)
  let mode = d50;
  if (sizeClasses.length > 0) {
    const maxCountClass = sizeClasses.reduce((max, c) => 
      c.count > max.count ? c : max, sizeClasses[0]);
    mode = maxCountClass.midpoint;
  }
  
  // Span (distribution spread)
  const span = d50 > 0 ? (d90 - d10) / d50 : 0;
  
  return {
    d10,
    d50,
    d80,
    d90,
    p80: d80, // P80 is same as D80 in metallurgical nomenclature
    f80: f80Override ?? d80, // Use feed override if provided; otherwise default to sample D80
    mean,
    mode,
    span,
    min,
    max,
    count: n,
    cv,
  };
}

/**
 * Calculate Rosin-Rammler distribution parameters
 * Used for fitting PSD curves
 */
export function calculateRosinRammler(
  sizeClasses: SizeClass[]
): { k: number; n: number; x63: number } {
  // R-R equation: R = exp(-(x/k)^n)
  // Where R = cumulative fraction retained, x = particle size
  // k = size modulus (x at R = 0.368), n = distribution modulus
  
  const validClasses = sizeClasses.filter(c => 
    c.cumRetained > 0.1 && c.cumRetained < 99.9);
  
  if (validClasses.length < 3) {
    return { k: 0, n: 0, x63: 0 };
  }
  
  // Linear regression on transformed data
  // ln(ln(1/R)) = n*ln(x) - n*ln(k)
  const xData: number[] = [];
  const yData: number[] = [];
  
  for (const cls of validClasses) {
    const R = cls.cumRetained / 100;
    if (R > 0 && R < 1) {
      xData.push(Math.log(cls.midpoint));
      yData.push(Math.log(Math.log(1 / R)));
    }
  }
  
  if (xData.length < 2) {
    return { k: 0, n: 0, x63: 0 };
  }
  
  // Simple linear regression
  const meanX = xData.reduce((a, b) => a + b, 0) / xData.length;
  const meanY = yData.reduce((a, b) => a + b, 0) / yData.length;
  
  let ssXY = 0, ssXX = 0;
  for (let i = 0; i < xData.length; i++) {
    ssXY += (xData[i] - meanX) * (yData[i] - meanY);
    ssXX += (xData[i] - meanX) * (xData[i] - meanX);
  }
  
  const n = ssXX > 0 ? ssXY / ssXX : 1;
  const intercept = meanY - n * meanX;
  const k = Math.exp(-intercept / n);
  const x63 = k; // Size at 63.2% retained
  
  return { k, n, x63 };
}

/**
 * Generate cumulative passing curve data points for charting
 */
export function generateCumulativeCurve(
  sizeClasses: SizeClass[]
): { size: number; passing: number }[] {
  if (sizeClasses.length === 0) return [];
  
  return sizeClasses
    .map(cls => ({
      size: cls.sizeMax,
      passing: cls.cumPassing,
    }))
    .sort((a, b) => a.size - b.size);
}

/**
 * Generate histogram data for charting
 */
export function generateHistogramData(
  sizeClasses: SizeClass[]
): { sizeRange: string; frequency: number; midpoint: number }[] {
  return sizeClasses.map(cls => ({
    sizeRange: `${cls.sizeMin.toFixed(2)}-${cls.sizeMax.toFixed(2)}`,
    frequency: cls.frequency,
    midpoint: cls.midpoint,
  }));
}

/**
 * Calculate reduction ratio for crushing efficiency
 */
export function calculateReductionRatio(f80: number, p80: number): number {
  if (p80 === 0) return 0;
  return f80 / p80;
}

/**
 * Estimate Bond Work Index based on reduction ratio
 * Note: This is a simplified estimation, actual Wi requires laboratory tests
 */
export function estimateBondWorkIndex(
  f80: number,
  p80: number,
  power: number, // kW
  throughput: number // t/h
): number {
  // Wi = W / (10 * (1/sqrt(P80) - 1/sqrt(F80)))
  // W = power / throughput (kWh/t)
  
  if (throughput === 0 || p80 === 0 || f80 === 0) return 0;
  
  const W = power / throughput;
  const sqrtP80 = Math.sqrt(p80 * 1000); // Convert to microns
  const sqrtF80 = Math.sqrt(f80 * 1000);
  
  const denominator = 10 * (1 / sqrtP80 - 1 / sqrtF80);
  
  return denominator !== 0 ? W / denominator : 0;
}
