// imageProcessingUtils.ts - Image processing and API utilities

export interface ServerResponse {
  [key: string]: any;
}

export interface FrameData {
  frame: any;
  contour: any;
  score: number;
  qualityScore: number;
  sharpness: number;
  sharpnessNormalized: number;
  reflectionRatio: number;
}

// Detect if device is mobile
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Get optimized camera constraints
export function getCameraConstraints(deviceId?: string): MediaStreamConstraints {
  const isMobile = isMobileDevice();

  return {
    video: {
      width: {
        min: 640,
        ideal: isMobile ? 1920 : 1280,
        max: 4096
      },
      height: {
        min: 480,
        ideal: isMobile ? 1080 : 720,
        max: 2160
      },
      facingMode: deviceId ? undefined : 'environment',
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      frameRate: {
        ideal: isMobile ? 24 : 30,
        max: 30
      },
      aspectRatio: { ideal: 16 / 9 }
    },
    audio: false
  };
}

// Upload image to server
export async function uploadImageToServer(
  blob: Blob,
  filename: string,
  serverUrl: string = 'http://127.0.0.1:8000/check'
): Promise<ServerResponse> {
  const form = new FormData();
  form.append('file', blob, filename);

  const resp = await fetch(serverUrl, {
    method: 'POST',
    headers: { accept: 'application/json' },
    body: form
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Server error: ${resp.status} ${txt}`);
  }

  return await resp.json();
}

// Convert canvas to blob
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/jpeg',
  quality: number = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      },
      type,
      quality
    );
  });
}

// Download canvas as image
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
}

// Parse nested JSON responses
export function parseServerResponse(data: any): any {
  function tryParseJSON(s: any): any {
    if (typeof s !== 'string') return null;
    try {
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  let obj = data;

  try {
    if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'result')) {
      obj = data.result;
    }

    if (typeof obj === 'string') {
      const parsed = tryParseJSON(obj.trim());
      if (parsed !== null) obj = parsed;
    }

    let unwraps = 0;
    while (obj && typeof obj === 'object' && Object.keys(obj).length === 1 && unwraps < 6) {
      const k = Object.keys(obj)[0];
      const v = obj[k];
      if (k === 'result' && v && typeof v === 'object') {
        obj = v;
        unwraps++;
        continue;
      }
      if (v && typeof v === 'object') {
        obj = v;
        unwraps++;
        continue;
      }
      if (typeof v === 'string') {
        const parsed = tryParseJSON(v.trim());
        if (parsed !== null) {
          obj = parsed;
          unwraps++;
          continue;
        }
      }
      break;
    }
  } catch (e) {
    obj = data;
  }

  return obj;
}

// Schedule next frame for processing
export function scheduleNextFrame(callback: () => void, video: HTMLVideoElement): void {
  if (typeof (video as any).requestVideoFrameCallback === 'function') {
    (video as any).requestVideoFrameCallback(() => callback());
  } else {
    requestAnimationFrame(callback);
  }
}

// Get available video input devices
export async function getVideoDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput');
  } catch (e) {
    console.warn('Could not enumerate devices:', e);
    return [];
  }
}

// Create canvas from video frame
export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const width = video.videoWidth || video.width || 640;
  const height = video.videoHeight || video.height || 480;
  
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
  if (ctx && width > 0 && height > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(video, 0, 0, width, height);
  }
  return canvas;
}

// Draw status messages
export function drawStatusMessages(
  ctx: CanvasRenderingContext2D,
  hasReflection: boolean,
  score: number,
  hasValidRatio: boolean,
  hasGoodSharpness: boolean,
  scoreThreshold: number,
  showWarnings: boolean = true
): void {
  if (!showWarnings) return;

  ctx.font = '16px sans-serif';
  let y = 270;

  if (hasReflection) {
    ctx.fillStyle = 'rgb(255,165,0)';
    ctx.fillText('Light reflection detected - adjust angle', 10, y);
    y += 30;
  }
  if (score <= scoreThreshold) {
    ctx.fillStyle = 'rgb(0,0,255)';
    ctx.fillText('Position card better in frame', 10, y);
    y += 30;
  }
  if (!hasValidRatio) {
    ctx.fillStyle = 'rgb(255,0,255)';
    ctx.fillText('Card shape not recognized - adjust angle', 10, y);
    y += 30;
  }
  if (!hasGoodSharpness) {
    ctx.fillStyle = 'rgb(255,165,0)';
    ctx.fillText('Image blurry - hold device steady', 10, y);
  }
}
