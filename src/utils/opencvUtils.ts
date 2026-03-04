// opencvUtils.ts - OpenCV.js utility functions
// Note: Requires opencv.js to be loaded globally

declare const cv: any;

export interface SharpnessResult {
  variance: number;
  normalized: number;
  quality: 'excellent' | 'good' | 'poor' | 'unknown';
}

export interface ReflectionResult {
  hasReflection: boolean;
  reflectionRatio: number;
  hasSpikeReflection: boolean;
}

// Calculate image sharpness using Laplacian variance
export function calculateSharpness(mat: any, contour: any): SharpnessResult {
  try {
    // Extract ROI around the card for faster processing
    const rect = cv.boundingRect(contour);
    const rx = Math.max(0, rect.x);
    const ry = Math.max(0, rect.y);
    const rw = Math.max(1, Math.min(mat.cols - rx, rect.width));
    const rh = Math.max(1, Math.min(mat.rows - ry, rect.height));

    const roi = mat.roi(new cv.Rect(rx, ry, rw, rh));
    const gray = new cv.Mat();
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);

    // Apply Laplacian operator to detect edges
    const laplacian = new cv.Mat();
    cv.Laplacian(gray, laplacian, cv.CV_64F, 3, 1, 0, cv.BORDER_DEFAULT);

    // Calculate variance of Laplacian (higher = sharper)
    const mean = new cv.Mat();
    const stddev = new cv.Mat();
    cv.meanStdDev(laplacian, mean, stddev);
    const variance = Math.pow(stddev.doubleAt(0, 0), 2);

    // Cleanup
    roi.delete();
    gray.delete();
    laplacian.delete();
    mean.delete();
    stddev.delete();

    const normalizedSharpness = Math.min(1.0, variance / 10000);

    return {
      variance: variance,
      normalized: normalizedSharpness,
      quality: variance > 10000 ? 'excellent' : variance > 5000 ? 'good' : 'poor'
    };
  } catch (e) {
    console.error('Sharpness calculation error:', e);
    return { variance: 0, normalized: 0, quality: 'unknown' };
  }
}

// Detect reflection in the card region
export function detectReflection(frameMatColor: any, contour: any): ReflectionResult {
  // Fast reflection check on bbox ROI
  const rect = cv.boundingRect(contour);
  const rx = Math.max(0, rect.x);
  const ry = Math.max(0, rect.y);
  const rw = Math.max(1, Math.min(frameMatColor.cols - rx, rect.width));
  const rh = Math.max(1, Math.min(frameMatColor.rows - ry, rect.height));
  const roi = frameMatColor.roi(new cv.Rect(rx, ry, rw, rh));
  const gray = new cv.Mat();
  cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);

  const meanMat = new cv.Mat();
  const stddevMat = new cv.Mat();
  cv.meanStdDev(gray, meanMat, stddevMat);
  const meanBrightness = meanMat.doubleAt(0, 0);
  const stddevBrightness = stddevMat.doubleAt(0, 0);

  const spikeThreshold = Math.min(meanBrightness + 2 * stddevBrightness, 245);
  const bright = new cv.Mat();
  cv.threshold(gray, bright, spikeThreshold, 255, cv.THRESH_BINARY);
  const brightPixels = cv.countNonZero(bright);
  const totalPixels = rw * rh;
  const reflectionRatio = brightPixels / totalPixels;

  // Optionally run expensive spike analysis only on desktop
  let hasSpikeReflection = false;
  const labels = new cv.Mat();
  const stats = new cv.Mat();
  const cents = new cv.Mat();
  cv.connectedComponentsWithStats(bright, labels, stats, cents);
  // Heuristic: any compact component within 0.1% - 5% area
  const minSpike = totalPixels * 0.001;
  const maxSpike = totalPixels * 0.05;
  const rows = stats.rows;
  for (let i = 1; i < rows; i++) {
    const area = stats.intAt(i, cv.CC_STAT_AREA);
    const bw = stats.intAt(i, cv.CC_STAT_WIDTH);
    const bh = stats.intAt(i, cv.CC_STAT_HEIGHT);
    const density = area / (bw * bh);
    if (area > minSpike && area < maxSpike && density > 0.3) {
      hasSpikeReflection = true;
      break;
    }
  }
  labels.delete();
  stats.delete();
  cents.delete();

  // cleanup
  roi.delete();
  gray.delete();
  meanMat.delete();
  stddevMat.delete();
  bright.delete();

  return {
    hasReflection: reflectionRatio > 0.15 || hasSpikeReflection,
    reflectionRatio,
    hasSpikeReflection
  };
}

// Apply sharpening filter
export function sharpenImage(mat: any): any {
  const kernel = cv.matFromArray(3, 3, cv.CV_32FC1, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
  const sharpened = new cv.Mat();
  cv.filter2D(mat, sharpened, cv.CV_8U, kernel);
  kernel.delete();
  return sharpened;
}

// Extract card region from frame using perspective transform
export function extractCardRegion(frameMat: any, contour: any): any {
  if (contour.rows !== 4) {
    const r = cv.boundingRect(contour);
    const padx = Math.floor(r.width * 0.05);
    const pady = Math.floor(r.height * 0.05);
    const x = Math.max(0, r.x - padx);
    const y = Math.max(0, r.y - pady);
    const w = Math.min(frameMat.cols - x, r.width + 2 * padx);
    const h = Math.min(frameMat.rows - y, r.height + 2 * pady);
    return frameMat.roi(new cv.Rect(x, y, w, h)).clone();
  }

  let points = [];
  for (let i = 0; i < 4; i++) {
    points.push([contour.intAt(i, 0), contour.intAt(i, 1)]);
  }

  points.sort((a, b) => a[1] - b[1]);

  let rect = new Array(4);
  let topPoints = [points[0], points[1]];
  topPoints.sort((a, b) => a[0] - b[0]);
  rect[0] = topPoints[0]; // top-left
  rect[1] = topPoints[1]; // top-right

  let bottomPoints = [points[2], points[3]];
  bottomPoints.sort((a, b) => a[0] - b[0]);
  rect[3] = bottomPoints[0]; // bottom-left
  rect[2] = bottomPoints[1]; // bottom-right

  const center_x = (rect[0][0] + rect[1][0] + rect[2][0] + rect[3][0]) / 4.0;
  const center_y = (rect[0][1] + rect[1][1] + rect[2][1] + rect[3][1]) / 4.0;
  const expansion_factor = 1.03;

  for (let i = 0; i < 4; i++) {
    const direction_x = rect[i][0] - center_x;
    const direction_y = rect[i][1] - center_y;
    rect[i][0] = center_x + direction_x * expansion_factor;
    rect[i][1] = center_y + direction_y * expansion_factor;
  }

  const width_top = Math.sqrt(
    Math.pow(rect[1][0] - rect[0][0], 2) + Math.pow(rect[1][1] - rect[0][1], 2)
  );
  const width_bottom = Math.sqrt(
    Math.pow(rect[2][0] - rect[3][0], 2) + Math.pow(rect[2][1] - rect[3][1], 2)
  );
  const width = Math.max(width_top, width_bottom);

  const height_left = Math.sqrt(
    Math.pow(rect[3][0] - rect[0][0], 2) + Math.pow(rect[3][1] - rect[0][1], 2)
  );
  const height_right = Math.sqrt(
    Math.pow(rect[2][0] - rect[1][0], 2) + Math.pow(rect[2][1] - rect[1][1], 2)
  );
  const height = Math.max(height_left, height_right);

  const card_ratio = 86 / 54;

  let finalWidth = Math.floor(width);
  let finalHeight = Math.floor(height);

  const current_ratio = width / height;

  if (current_ratio > 1) {
    if (current_ratio > card_ratio) {
      finalWidth = Math.floor(finalHeight * card_ratio);
    } else {
      finalHeight = Math.floor(finalWidth / card_ratio);
    }
  } else {
    const portrait_ratio = 54 / 86;
    if (current_ratio > portrait_ratio) {
      finalWidth = Math.floor(finalHeight * portrait_ratio);
    } else {
      finalHeight = Math.floor(finalWidth / portrait_ratio);
    }
  }

  const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    finalWidth - 1,
    0,
    finalWidth - 1,
    finalHeight - 1,
    0,
    finalHeight - 1
  ]);

  const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
    rect[0][0],
    rect[0][1],
    rect[1][0],
    rect[1][1],
    rect[2][0],
    rect[2][1],
    rect[3][0],
    rect[3][1]
  ]);

  const M = cv.getPerspectiveTransform(srcPts, dst);
  const warped = new cv.Mat();
  cv.warpPerspective(frameMat, warped, M, new cv.Size(finalWidth, finalHeight));

  srcPts.delete();
  dst.delete();
  M.delete();

  const sharpened = sharpenImage(warped);
  warped.delete();

  return sharpened;
}

// Global promise to ensure OpenCV is only loaded once
let openCVLoadPromise: Promise<void> | null = null;

// Load OpenCV.js
export function loadOpenCV(): Promise<void> {
  // If already loading or loaded, return the existing promise
  if (openCVLoadPromise) {
    return openCVLoadPromise;
  }

  // Check if already loaded
  if (typeof cv !== 'undefined' && cv.getBuildInformation) {
    openCVLoadPromise = Promise.resolve();
    return openCVLoadPromise;
  }

  // Check if script already exists in DOM
  const existingScript = document.querySelector('script[src*="opencv.js"]');
  if (existingScript) {
    openCVLoadPromise = new Promise((resolve) => {
      const checkCV = () => {
        if (typeof cv !== 'undefined' && cv.getBuildInformation) {
          resolve();
        } else {
          setTimeout(checkCV, 100);
        }
      };
      checkCV();
    });
    return openCVLoadPromise;
  }

  // Create new script tag
  openCVLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.x/opencv.js';
    script.async = true;
    script.onload = () => {
      const checkCV = () => {
        if (typeof cv !== 'undefined' && cv.getBuildInformation) {
          resolve();
        } else {
          setTimeout(checkCV, 100);
        }
      };
      checkCV();
    };
    script.onerror = () => {
      openCVLoadPromise = null; // Reset on error so it can be retried
      reject(new Error('Failed to load OpenCV.js'));
    };
    document.head.appendChild(script);
  });

  return openCVLoadPromise;
}
