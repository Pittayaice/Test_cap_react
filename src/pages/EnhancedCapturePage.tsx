// EnhancedCapturePage.tsx - Example of using card detection utilities
import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCardDetection } from '../hooks/useCardDetection';
import { getCameraConstraints, canvasToBlob } from '../utils/imageProcessingUtils';
import { uploadCardImage, parseNestedResponse } from '../api';

const EnhancedCapturePage: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedCanvas, setCapturedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const {
    isReady,
    isProcessing,
    detectionStatus,
    processFrame,
    startProcessing,
    stopProcessing,
    reset
  } = useCardDetection({
    modelPath: '/best320.onnx',
    onCardDetected: (canvas) => {
      console.log('Card detected!');
      setCapturedCanvas(canvas);
      stopCamera();
    },
    onError: (error) => {
      console.error('Detection error:', error);
      alert('Detection error: ' + error.message);
    }
  });

  const startCamera = async () => {
    try {
      const constraints = getCameraConstraints();
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && canvasRef.current) {
            if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
              startProcessing();
            }
          }
        };
        
        await videoRef.current.play();
      }
      
      setStream(mediaStream);
      setIsCameraActive(true);
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    stopProcessing();
    setIsCameraActive(false);
  };

  // Processing loop
  useEffect(() => {
    if (!isProcessing || !isCameraActive || !videoRef.current || !canvasRef.current) {
      return;
    }

    let animationId: number;
    const loop = async () => {
      if (isProcessing && videoRef.current && canvasRef.current) {
        const detected = await processFrame(videoRef.current, canvasRef.current);
        if (!detected) {
          animationId = requestAnimationFrame(loop);
        }
      }
    };

    animationId = requestAnimationFrame(loop);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isProcessing, isCameraActive, processFrame]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setCapturedCanvas(canvas);
        }
      };
      img.src = URL.createObjectURL(file);
    }
  };

  const uploadToServer = async () => {
    if (!capturedCanvas) return;

    setIsUploading(true);
    try {
      console.log('Starting upload from EnhancedCapturePage...');
      const blob = await canvasToBlob(capturedCanvas, 'image/jpeg', 0.95);
      const response = await uploadCardImage(blob, 'idcard.jpg');
      
      console.log('Backend response received:', response);
      const parsedData = parseNestedResponse(response);
      console.log('Parsed data:', parsedData);
      
      // Store response and navigate to results
      sessionStorage.setItem('capturedImage', capturedCanvas.toDataURL('image/jpeg'));
      sessionStorage.setItem('serverResponse', JSON.stringify(parsedData));
      navigate('/results');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  const retake = () => {
    setCapturedCanvas(null);
    reset();
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold text-center text-white">ID Card OCR</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start pt-40 p-4">
        {!isReady && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Loading detection models...</p>
          </div>
        )}

        {isReady && !isCameraActive && !capturedCanvas && (
          <div className="w-full max-w-md space-y-6">
            <div className="aspect-video bg-gray-800 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg 
                  className="w-20 h-20 mx-auto mb-4" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                  />
                </svg>
                <p className="text-sm">Camera preview will appear here</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={startCamera}
                className="flex-1 bg-blue-600 text-white py-4 px-6 rounded-lg font-semibold hover:bg-blue-700"
              >
                Start Camera
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-gray-700 text-white py-4 px-6 rounded-lg border-2 border-gray-600 hover:bg-gray-600"
              >
                Upload Image
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Video and Canvas - Always rendered but hidden when not active */}
        <div className={`w-full max-w-4xl space-y-4 ${!isCameraActive ? 'hidden' : ''}`}>
          <div className="relative bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto"
              style={{ display: 'none' }}
            />
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
            />
            <div className="absolute top-4 left-4 bg-gray-900 bg-opacity-90 px-3 py-2 rounded text-sm text-white border border-gray-700">
              {detectionStatus}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={stopCamera}
              className="flex-1 bg-gray-700 text-white py-3 px-6 rounded-lg hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>

        {capturedCanvas && (
          <div className="w-full max-w-4xl space-y-4">
            <div className="relative bg-gray-800 rounded-lg overflow-hidden">
              <img
                src={capturedCanvas.toDataURL('image/jpeg')}
                alt="Captured card"
                className="w-full h-auto"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={retake}
                className="flex-1 bg-gray-700 text-white py-3 px-6 rounded-lg hover:bg-gray-600"
                disabled={isUploading}
              >
                Retake
              </button>
              <button
                onClick={uploadToServer}
                className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold disabled:opacity-50 hover:bg-blue-700"
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Process'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedCapturePage;
