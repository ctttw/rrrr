import { pipeline, env } from '@huggingface/transformers';

// Disable setting local models, use HuggingFace Hub
env.allowLocalModels = false;

export interface LocalIngredient {
  name: string;
  count?: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  class: string;
  score: number;
}

export interface LocalDetectionResult {
  ingredients: LocalIngredient[];
  detections: BoundingBox[];
  imageSize: { width: number; height: number };
}

// User requested generic and specific items:
const CANDIDATE_LABELS = [
  'apple', 'banana', 'orange', 'broccoli', 'carrot', 'sandwich', 'hot dog', 'pizza', 'donut', 'cake', 'bottle', 'bowl',
  'potato', 'egg', 'guava', 'eggplant', 'onion', 'chili', 'garlic', 'tomato', 'vegetable', 'fruit', 'meat', 'beverage'
];

// Translate labels to Chinese
const CLASS_TRANSLATION: Record<string, string> = {
  'apple': '蘋果',
  'banana': '香蕉',
  'orange': '橘子',
  'broccoli': '花椰菜',
  'carrot': '胡蘿蔔',
  'sandwich': '三明治',
  'hot dog': '熱狗',
  'pizza': '披薩',
  'donut': '甜甜圈',
  'cake': '蛋糕',
  'bottle': '瓶裝水/飲料',
  'bowl': '碗裝食物',
  'potato': '馬鈴薯',
  'egg': '蛋',
  'guava': '芭樂',
  'eggplant': '茄子',
  'onion': '洋蔥',
  'chili': '辣椒',
  'garlic': '蒜頭',
  'tomato': '番茄',
  'vegetable': '蔬菜',
  'fruit': '水果',
  'meat': '肉類',
  'beverage': '飲料'
};

let detector: any = null;

export const loadLocalModel = async (onProgress?: (progress: number, file: string) => void) => {
  if (!detector) {
    // using a highly capable zero-shot object detection model
    detector = await pipeline('zero-shot-object-detection', 'Xenova/owlvit-base-patch32', {
      device: 'wasm', // Use wasm device since webgpu lacks Cast(13) support for this model
      progress_callback: (x: any) => {
        if (x.status === 'progress' && onProgress) {
          // send the percentage and the file name
          onProgress(x.progress, x.file);
        }
      }
    });
  }
  return detector;
};

export const detectIngredientsLocal = async (
  base64Image: string, 
  onProgress?: (text: string) => void
): Promise<LocalDetectionResult> => {
  try {
    if (onProgress) onProgress('加載 AI 模型中 (初次需要下載約 600MB)...');
    
    const loadedDetector = await loadLocalModel((p, f) => {
      if (onProgress) {
        // Just take the first few letters of the file to keep it short if needed, but file name works
        onProgress(`下載模型: ${f.split('/').pop()} (${Math.round(p)}%)`);
      }
    });
    
    if (onProgress) onProgress('分析圖片中...');

    // We can pass data URL to transformers.js
    const imageUrl = 'data:image/jpeg;base64,' + base64Image;

    // Detect!
    const output = await loadedDetector(imageUrl, CANDIDATE_LABELS, {
      threshold: 0.01, // Lower threshold further to ensure high recall for zero-shot
      percentage: false // return absolute coordinates
    });
    
    // Create an image element just to get the intrinsic size
    const img = new Image();
    img.src = imageUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const ingredientCounts: Record<string, number> = {};
    const detections: BoundingBox[] = [];
    
    // Process output array
    if (Array.isArray(output)) {
      output.forEach((prediction: any) => {
        if (prediction.score > 0.015) {
          const translatedName = CLASS_TRANSLATION[prediction.label] || prediction.label;
          
          ingredientCounts[translatedName] = (ingredientCounts[translatedName] || 0) + 1;
          
          detections.push({
            x: prediction.box.xmin,
            y: prediction.box.ymin,
            width: prediction.box.xmax - prediction.box.xmin,
            height: prediction.box.ymax - prediction.box.ymin,
            class: translatedName,
            score: prediction.score
          });
        }
      });
    }

    return {
      ingredients: Object.entries(ingredientCounts).map(([name, count]) => ({
        name,
        count
      })),
      detections,
      imageSize: { width: img.width, height: img.height }
    };
  } catch (error: any) {
    console.error("Local object detection error:", error);
    if (onProgress) onProgress(`錯誤: ${error.message || error}`);
    throw error;
  }
};

