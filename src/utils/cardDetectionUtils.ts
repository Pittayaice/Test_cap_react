// cardDetectionUtils.ts - Card detection and validation utilities

declare const cv: any;

export interface CardScore {
  score: number;
  areaScore: number;
  centerScore: number;
  straightnessScore: number;
}

export interface CardRatioCheck {
  isValid: boolean;
  ratio: number;
  orientation: 'landscape' | 'portrait' | 'unknown';
}

export interface QualityMetrics {
  qualityScore: number;
  score: number;
  sharpness: number;
  sharpnessNormalized: number;
  reflectionRatio: number;
}

// Card constants
export const CARD_RATIO = 1.59; // Standard card ratio (86mm / 54mm)
export const RATIO_TOLERANCE = 0.15; // Allow 15% deviation
export const SCORE_THRESHOLD = 0.60; // Card positioning threshold
export const REQUIRED_STABLE_FRAMES = 15; // Number of stable frames needed

// Check if detected box has valid card aspect ratio
export function isValidCardRatio(box: number[]): CardRatioCheck {
  const [x1, y1, x2, y2] = box;
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  if (width === 0 || height === 0) {
    return { isValid: false, ratio: 0, orientation: 'unknown' };
  }

  const ratio1 = width / height;
  const ratio2 = height / width;

  // Check both landscape and portrait orientations
  const landscapeMatch = Math.abs(ratio1 - CARD_RATIO) <= RATIO_TOLERANCE;
  const portraitMatch = Math.abs(ratio2 - CARD_RATIO) <= RATIO_TOLERANCE;

  const isValid = landscapeMatch || portraitMatch;
  const actualRatio = ratio1 > ratio2 ? ratio1 : ratio2; // Use the larger ratio
  const orientation = ratio1 > 1 ? 'landscape' : 'portrait';

  return { isValid, ratio: actualRatio, orientation };
}

// Calculate card positioning score
export function calculateCardScore(
  contour: any,
  frameShape: { width: number; height: number }
): number {
  const frameArea = frameShape.height * frameShape.width;
  const cardArea = cv.contourArea(contour);
  const rect = cv.boundingRect(contour);
  const x = rect.x;
  const y = rect.y;
  const w = rect.width;
  const h = rect.height;
  const areaRatio = cardArea / frameArea;

  // Improved area scoring - prefer 15-50% of frame
  let areaScore = 0;
  if (areaRatio >= 0.15 && areaRatio <= 0.50) {
    // Optimal range
    areaScore = 1.0;
  } else if (areaRatio < 0.15) {
    // Too small
    areaScore = areaRatio / 0.15;
  } else {
    // Too large
    areaScore = Math.max(0, 1.0 - (areaRatio - 0.50) / 0.30);
  }

  const frame_cx = frameShape.width / 2.0;
  const frame_cy = frameShape.height / 2.0;
  const card_cx = x + w / 2.0;
  const card_cy = y + h / 2.0;
  const distance = Math.hypot(frame_cx - card_cx, frame_cy - card_cy);
  const max_distance = Math.hypot(frame_cx, frame_cy);
  const centerScore = 1.0 - distance / max_distance;

  const hull = new cv.Mat();
  cv.convexHull(contour, hull, false, true);
  const hullArea = cv.contourArea(hull);
  const straightnessScore = hullArea > 0 ? cardArea / hullArea : 0;

  hull.delete();

  // Adjusted weights - prioritize straightness and centering
  return areaScore * 0.25 + centerScore * 0.35 + straightnessScore * 0.40;
}

// Calculate combined quality score with sharpness, positioning, and reflection
export function calculateQualityScore(
  score: number,
  reflectionRatio: number,
  sharpness: number
): number {
  const reflectionPenalty = Math.max(0, 1.0 - reflectionRatio * 2);
  const sharpnessScore = sharpness || 0;
  
  // Combined quality: 40% positioning, 35% sharpness, 25% reflection penalty
  // This balances all three critical factors
  return score * 0.40 + sharpnessScore * 0.35 + reflectionPenalty * 0.25;
}

// Convert contour points to Mat
export function contourToMat(contourPts: Array<{ x: number; y: number }>): any {
  const mat = new cv.Mat(contourPts.length, 1, cv.CV_32SC2);
  for (let i = 0; i < contourPts.length; i++) {
    mat.intPtr(i, 0)[0] = contourPts[i].x;
    mat.intPtr(i, 0)[1] = contourPts[i].y;
  }
  return mat;
}

// Create a 4-point rectangle contour from YOLO detection box
export function createContourFromBox(box: number[]): any {
  const [x1, y1, x2, y2] = box;
  const bestLocalContour = new cv.Mat(4, 1, cv.CV_32SC2);
  // top-left
  bestLocalContour.intPtr(0, 0)[0] = Math.round(x1);
  bestLocalContour.intPtr(0, 0)[1] = Math.round(y1);
  // top-right
  bestLocalContour.intPtr(1, 0)[0] = Math.round(x2);
  bestLocalContour.intPtr(1, 0)[1] = Math.round(y1);
  // bottom-right
  bestLocalContour.intPtr(2, 0)[0] = Math.round(x2);
  bestLocalContour.intPtr(2, 0)[1] = Math.round(y2);
  // bottom-left
  bestLocalContour.intPtr(3, 0)[0] = Math.round(x1);
  bestLocalContour.intPtr(3, 0)[1] = Math.round(y2);
  return bestLocalContour;
}
