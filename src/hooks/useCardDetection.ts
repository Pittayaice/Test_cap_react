// useCardDetection.ts - React hook for card detection
import { useState, useRef, useCallback, useEffect } from 'react';
import * as ort from 'onnxruntime-web';
import {
  initYoloSession,
  runYoloOnCanvas
} from '../utils/yoloUtils';
import {
  loadOpenCV,
  calculateSharpness,
  detectReflection,
  extractCardRegion
} from '../utils/opencvUtils';
import {
  isValidCardRatio,
  calculateCardScore,
  calculateQualityScore,
  createContourFromBox,
  SCORE_THRESHOLD,
  REQUIRED_STABLE_FRAMES
} from '../utils/cardDetectionUtils';
import {
  captureVideoFrame,
  drawStatusMessages,
  FrameData
} from '../utils/imageProcessingUtils';

declare const cv: any;

const YOLO_INPUT_SHAPE: [number, number, number, number] = [1, 3, 320, 320];

export interface UseCardDetectionOptions {
  modelPath?: string;
  scoreThreshold?: number;
  requiredStableFrames?: number;
  onCardDetected?: (captured: { croppedCanvas: HTMLCanvasElement; sourceCanvas: HTMLCanvasElement }) => void;
  onError?: (error: Error) => void;
}

export function useCardDetection(options: UseCardDetectionOptions = {}) {
  const {
    modelPath = '/best320.onnx',
    scoreThreshold = SCORE_THRESHOLD,
    requiredStableFrames = REQUIRED_STABLE_FRAMES,
    onCardDetected,
    onError
  } = options;

  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<string>('Initializing...');

  const ortSessionRef = useRef<ort.InferenceSession | null>(null);
  const yoloCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processingRef = useRef(false);
  const isProcessingFrameRef = useRef(false); // Lock to prevent concurrent frame processing
  const stableCountRef = useRef(0);
  const bestScoreRef = useRef(0);
  const frameHistoryRef = useRef<FrameData[]>([]);
  const capturedFrameRef = useRef<any>(null);
  const bestContourRef = useRef<any>(null);
  const [hasSpikeReflection, setHasSpikeReflection] = useState(false);

  // Type for sharpness data to avoid type errors
  type SharpnessDataType = { variance: number; normalized: number; quality: 'excellent' | 'good' | 'poor' | 'unknown' };

  const yoloScoreThresh = 0.25;
  const yoloNmsIouThresh = 0.45;
  const historySize = 10;

  // Track if already initialized to prevent multiple loads
  const initializingRef = useRef(false);
  const initializedRef = useRef(false);

  // Initialize
  useEffect(() => {
    // Prevent multiple simultaneous initializations
    if (initializingRef.current || initializedRef.current) {
      return;
    }

    initializingRef.current = true;

    const init = async () => {
      try {
        console.log('[Card Detection] Initializing...');
        // Load OpenCV and YOLO without updating status during init
        await loadOpenCV();
        console.log('✅ [Card Detection] OpenCV loaded');
        ortSessionRef.current = await initYoloSession(modelPath);
        console.log('✅ [Card Detection] YOLO model loaded:', modelPath);
        
        // Create YOLO canvas
        if (typeof OffscreenCanvas !== 'undefined') {
          yoloCanvasRef.current = new OffscreenCanvas(YOLO_INPUT_SHAPE[3], YOLO_INPUT_SHAPE[2]) as any;
        } else {
          yoloCanvasRef.current = document.createElement('canvas');
          yoloCanvasRef.current.width = YOLO_INPUT_SHAPE[3];
          yoloCanvasRef.current.height = YOLO_INPUT_SHAPE[2];
        }

        setIsReady(true);
        setDetectionStatus('Ready');
        initializedRef.current = true;
        console.log('✅ [Card Detection] Ready to detect cards');
      } catch (error) {
        const err = error as Error;
        setDetectionStatus('Initialization failed');
        onError?.(err);
        console.error('Card detection initialization error:', err);
        initializingRef.current = false;
      }
    };

    init();

    return () => {
      // Cleanup - safely delete OpenCV Mats
      try {
        if (capturedFrameRef.current && !capturedFrameRef.current.isDeleted()) {
          capturedFrameRef.current.delete();
        }
      } catch (e) { /* already deleted */ }
      capturedFrameRef.current = null;
      
      try {
        if (bestContourRef.current && !bestContourRef.current.isDeleted()) {
          bestContourRef.current.delete();
        }
      } catch (e) { /* already deleted */ }
      bestContourRef.current = null;
      
      frameHistoryRef.current.forEach(f => {
        try {
          if (f.frame && !f.frame.isDeleted()) f.frame.delete();
        } catch (e) { /* already deleted */ }
        try {
          if (f.contour && !f.contour.isDeleted()) f.contour.delete();
        } catch (e) { /* already deleted */ }
      });
      frameHistoryRef.current = [];
    };
  }, [modelPath, onError]);

  const processFrame = useCallback(
    async (
      videoElement: HTMLVideoElement,
      canvasElement: HTMLCanvasElement
    ): Promise<boolean> => {
      // Prevent concurrent processing
      if (isProcessingFrameRef.current) {
        return false;
      }

      // Check if processing is stopped
      if (!processingRef.current) {
        return false;
      }

      if (!isReady || !ortSessionRef.current || !yoloCanvasRef.current) {
        return false;
      }

      // Lock frame processing
      isProcessingFrameRef.current = true;

      try {
        const canvas = captureVideoFrame(videoElement);
        const ctx = canvasElement.getContext('2d')!;
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        ctx.drawImage(canvas, 0, 0);

        const frameW = canvas.width;
        const frameH = canvas.height;

        // Run YOLO detection
        const detections = await runYoloOnCanvas(
          canvas,
          ortSessionRef.current,
          yoloCanvasRef.current,
          YOLO_INPUT_SHAPE,
          yoloScoreThresh,
          yoloNmsIouThresh
        );

        if (detections.length === 0) {
          stableCountRef.current = 0;
          frameHistoryRef.current.forEach(f => {
            try {
              if (f.frame && !f.frame.isDeleted()) f.frame.delete();
            } catch (e) { /* already deleted */ }
            try {
              if (f.contour && !f.contour.isDeleted()) f.contour.delete();
            } catch (e) { /* already deleted */ }
          });
          frameHistoryRef.current = [];
          
          ctx.fillStyle = 'rgb(0,0,255)';
          ctx.font = '18px sans-serif';
          ctx.fillText('No card detected', 10, 30);
          ctx.font = '16px sans-serif';
          ctx.fillText('Place card in the frame', 10, 60);
          setDetectionStatus('No card detected');
          console.log('❌ [Card Detection] No card detected - Place card in frame');
          return false;
        }

        // Use highest confidence detection
        detections.sort((a, b) => b.score - a.score);
        const det = detections[0];

        // Check aspect ratio
        const ratioCheck = isValidCardRatio(det.box);
        const hasValidRatio = ratioCheck.isValid;

        // Create contour from detection
        const bestLocalContour = createContourFromBox(det.box);
        const score = calculateCardScore(bestLocalContour, { width: frameW, height: frameH });

        // Calculate quality metrics
        let reflectionData = { hasReflection: false, reflectionRatio: 0, hasSpikeReflection: false };
        let sharpnessData: SharpnessDataType = { variance: 0, normalized: 0, quality: 'unknown' };
        let srcMatForThisFrame: any = null;

        if (score > scoreThreshold - 0.1 && hasValidRatio) {
          srcMatForThisFrame = cv.imread(canvas);
          sharpnessData = calculateSharpness(srcMatForThisFrame, bestLocalContour);
          reflectionData = detectReflection(srcMatForThisFrame, bestLocalContour);
          setHasSpikeReflection(reflectionData.hasSpikeReflection);
        }

        const hasReflection = reflectionData.hasReflection;
        const hasGoodSharpness = sharpnessData.variance >= 2000;
        const isGood = score > scoreThreshold && !hasReflection && hasValidRatio && hasGoodSharpness;

        console.log(`📊 [Card Detection] Score: ${score.toFixed(2)} | Ratio: ${ratioCheck.ratio.toFixed(2)} (${ratioCheck.orientation}) Valid: ${hasValidRatio} | Sharpness: ${sharpnessData.variance.toFixed(0)} (${sharpnessData.quality}) | Reflection: ${(reflectionData.reflectionRatio * 100).toFixed(1)}% | Good: ${isGood}`);

        if (isGood) {
          const qualityScore = calculateQualityScore(
            score,
            reflectionData.reflectionRatio,
            sharpnessData.normalized
          );

          if (!srcMatForThisFrame) srcMatForThisFrame = cv.imread(canvas);
          
          frameHistoryRef.current.push({
            frame: srcMatForThisFrame.clone(),
            contour: bestLocalContour.clone(),
            score: score,
            qualityScore: qualityScore,
            sharpness: sharpnessData.variance,
            sharpnessNormalized: sharpnessData.normalized,
            reflectionRatio: reflectionData.reflectionRatio
          });

          if (frameHistoryRef.current.length > historySize) {
            const oldest = frameHistoryRef.current.shift()!;
            try {
              if (oldest.frame && !oldest.frame.isDeleted()) oldest.frame.delete();
            } catch (e) { /* already deleted */ }
            try {
              if (oldest.contour && !oldest.contour.isDeleted()) oldest.contour.delete();
            } catch (e) { /* already deleted */ }
          }

          if (qualityScore > bestScoreRef.current) {
            bestScoreRef.current = qualityScore;
            try {
              if (bestContourRef.current && !bestContourRef.current.isDeleted()) {
                bestContourRef.current.delete();
              }
            } catch (e) { /* already deleted */ }
            bestContourRef.current = bestLocalContour.clone();
            stableCountRef.current = 0;
          } else {
            stableCountRef.current++;
          }

          ctx.fillStyle = 'rgb(255,255,0)';
          ctx.fillText(`Quality: ${qualityScore.toFixed(2)}`, 10, 180);
          ctx.fillStyle = 'rgb(0,255,255)';
          ctx.fillText(`Stable: ${stableCountRef.current}/${requiredStableFrames}`, 10, 210);

          setDetectionStatus(`Capturing... ${stableCountRef.current}/${requiredStableFrames}`);
          console.log(`[Card Detection] Capturing... Quality: ${qualityScore.toFixed(3)} | Stable: ${stableCountRef.current}/${requiredStableFrames}`);

          if (stableCountRef.current >= requiredStableFrames) {
            // Find best frame
            let bestFrameData = frameHistoryRef.current[0];
            for (let i = 1; i < frameHistoryRef.current.length; i++) {
              if (frameHistoryRef.current[i].qualityScore > bestFrameData.qualityScore) {
                bestFrameData = frameHistoryRef.current[i];
              }
            }

            console.log('[Card Detection] Card detected!');
            console.log(`Quality Score: ${bestFrameData.qualityScore.toFixed(3)}`);
            console.log(`Position Score: ${bestFrameData.score.toFixed(3)}`);
            console.log(`Sharpness: ${bestFrameData.sharpness.toFixed(0)} (${bestFrameData.sharpnessNormalized.toFixed(3)})`);
            console.log(`Reflection: ${(bestFrameData.reflectionRatio * 100).toFixed(1)}%`);

          try {
            if (capturedFrameRef.current && !capturedFrameRef.current.isDeleted()) {
              capturedFrameRef.current.delete();
            }
          } catch (e) { /* already deleted */ }
          capturedFrameRef.current = bestFrameData.frame.clone();
          
          try {
            if (bestContourRef.current && !bestContourRef.current.isDeleted()) {
              bestContourRef.current.delete();
            }
          } catch (e) { /* already deleted */ }
          bestContourRef.current = bestFrameData.contour.clone();

          // Extract and crop card
          const croppedMat = extractCardRegion(capturedFrameRef.current, bestContourRef.current);
          const croppedCanvas = document.createElement('canvas');
          cv.imshow(croppedCanvas, croppedMat);
          croppedMat.delete();

          // Keep the original detected frame so backend can run its own crop/OCR pipeline.
          const sourceCanvas = document.createElement('canvas');
          cv.imshow(sourceCanvas, capturedFrameRef.current);

          // Cleanup frame history
          frameHistoryRef.current.forEach(f => {
            try {
              if (f.frame && !f.frame.isDeleted()) f.frame.delete();
            } catch (e) { /* already deleted */ }
            try {
              if (f.contour && !f.contour.isDeleted()) f.contour.delete();
            } catch (e) { /* already deleted */ }
          });
          frameHistoryRef.current = [];
          stableCountRef.current = 0;
          bestScoreRef.current = 0;

          // Stop processing after card is detected
          processingRef.current = false;
          setIsProcessing(false);
          setDetectionStatus('Card detected!');
          console.log('✅ [Card Detection] Processing stopped - Card captured');
          onCardDetected?.({ croppedCanvas, sourceCanvas });

          if (srcMatForThisFrame) {
            try {
              if (!srcMatForThisFrame.isDeleted()) srcMatForThisFrame.delete();
            } catch (e) { /* already deleted */ }
          }
          try {
            if (!bestLocalContour.isDeleted()) bestLocalContour.delete();
          } catch (e) { /* already deleted */ }
          
          return true; // Card detected
        }
      } else {
        stableCountRef.current = 0;
        frameHistoryRef.current.forEach(f => {
          try {
            if (f.frame && !f.frame.isDeleted()) f.frame.delete();
          } catch (e) { /* already deleted */ }
          try {
            if (f.contour && !f.contour.isDeleted()) f.contour.delete();
          } catch (e) { /* already deleted */ }
        });
        frameHistoryRef.current = [];

        drawStatusMessages(
          ctx,
          hasReflection,
          score,
          hasValidRatio,
          hasGoodSharpness,
          scoreThreshold,
          true
        );

        setDetectionStatus('Adjusting...');
        const issues = [];
        if (!hasValidRatio) issues.push('invalid ratio');
        if (score <= scoreThreshold) issues.push('poor position');
        if (hasReflection) issues.push('reflection detected');
        if (!hasGoodSharpness) issues.push('low sharpness');
        console.log(`⚠️ [Card Detection] Adjusting... Issues: ${issues.join(', ')}`);
      }

      if (srcMatForThisFrame) {
        try {
          if (!srcMatForThisFrame.isDeleted()) srcMatForThisFrame.delete();
        } catch (e) { /* already deleted */ }
      }
      try {
        if (!bestLocalContour.isDeleted()) bestLocalContour.delete();
      } catch (e) { /* already deleted */ }

      return false;
    } catch (error) {
      console.error('Error processing frame:', error);
      return false;
    } finally {
      // Unlock frame processing
      isProcessingFrameRef.current = false;
    }
    },
    [
      isReady,
      scoreThreshold,
      requiredStableFrames,
      onCardDetected,
      yoloScoreThresh,
      yoloNmsIouThresh
    ]
  );

  const startProcessing = useCallback(() => {
    processingRef.current = true;
    setIsProcessing(true);
    stableCountRef.current = 0;
    bestScoreRef.current = 0;
  }, []);

  const stopProcessing = useCallback(() => {
    processingRef.current = false;
    setIsProcessing(false);
    setDetectionStatus('Stopped');
    console.log('🛑 [Card Detection] Processing stopped by user');
  }, []);

  const reset = useCallback(() => {
    stableCountRef.current = 0;
    bestScoreRef.current = 0;
    frameHistoryRef.current.forEach(f => {
      try {
        if (f.frame && !f.frame.isDeleted()) f.frame.delete();
      } catch (e) { /* already deleted */ }
      try {
        if (f.contour && !f.contour.isDeleted()) f.contour.delete();
      } catch (e) { /* already deleted */ }
    });
    frameHistoryRef.current = [];
    
    try {
      if (capturedFrameRef.current && !capturedFrameRef.current.isDeleted()) {
        capturedFrameRef.current.delete();
      }
    } catch (e) { /* already deleted */ }
    capturedFrameRef.current = null;
    
    try {
      if (bestContourRef.current && !bestContourRef.current.isDeleted()) {
        bestContourRef.current.delete();
      }
    } catch (e) { /* already deleted */ }
    bestContourRef.current = null;
    setHasSpikeReflection(false);
  }, []);

  return {
    isReady,
    isProcessing,
    detectionStatus,
    hasSpikeReflection,
    processFrame,
    startProcessing,
    stopProcessing,
    reset
  };
}
