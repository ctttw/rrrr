import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Check, X, Upload, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  isLoading: boolean;
  statusText?: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, isLoading, statusText }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      // More descriptive error for iframe constraints
      if (window.self !== window.top) {
        setError("預覽視窗無法存取相機此功能，請點擊右上方按鈕在新分頁中開啟，或直接上傳照片。");
      } else {
        setError("無法存取相機，請確保已開啟權限，或直接上傳照片。");
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setCapturedImage(e.target.result as string);
          stopCamera();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      const base64 = capturedImage.split(',')[1];
      onCapture(base64);
    }
  };

  return (
    <div className="relative w-full max-w-lg mx-auto aspect-[4/3] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 group">
      <input 
        type="file" 
        accept="image/*" 
        capture="environment"
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />
      <AnimatePresence mode="wait">
        {!capturedImage ? (
          <motion.div 
            key="video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full relative"
          >
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-gray-900 pointer-events-auto">
                <X className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-base font-medium mb-6 leading-relaxed max-w-xs">{error}</p>
                <div className="flex gap-3">
                  <button 
                    onClick={startCamera}
                    className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors flex items-center gap-2 text-sm"
                  >
                    <RefreshCw className="w-4 h-4" /> 重試
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors flex items-center gap-2 text-sm font-medium"
                  >
                    <Upload className="w-4 h-4" /> 上傳照片
                  </button>
                </div>
              </div>
            ) : (
              <>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-[20px] border-white/10 pointer-events-none rounded-3xl" />
                <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8">
                  {/* Empty div for balancing flex spacing */}
                  <div className="w-12 h-12" />
                  
                  <button
                    onClick={capturePhoto}
                    className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform group-hover:scale-110"
                    id="capture-button"
                  >
                    <div className="w-14 h-14 border-4 border-black/5 rounded-full flex items-center justify-center">
                      <Camera className="text-black w-7 h-7" />
                    </div>
                  </button>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                    title="上傳照片"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="preview"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full h-full relative"
          >
            <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
            
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 px-8">
              <button
                onClick={handleRetake}
                disabled={isLoading}
                className="flex-1 max-w-[140px] py-3 bg-black/60 backdrop-blur-md rounded-2xl flex items-center justify-center gap-2 text-white font-medium hover:bg-black/80 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-5 h-5" /> 重拍
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 max-w-[200px] py-3 bg-emerald-500 rounded-2xl flex items-center justify-center gap-2 text-white font-bold shadow-lg shadow-emerald-500/30 hover:bg-emerald-600 transition-colors active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="text-sm">{statusText || '分析中...'}</span>
                  </>
                ) : (
                  <><Check className="w-5 h-5" /> 分析冰箱</>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};
