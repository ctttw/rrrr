import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Ingredient {
  name: string;
  count?: number;
}

export interface Recipe {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  cookingTime: string;
}

export const detectIngredients = async (base64Image: string): Promise<Ingredient[]> => {
  const imagePart = {
    inlineData: {
      mimeType: "image/jpeg",
      data: base64Image,
    },
  };
  
  const prompt = "Please identify the fruits and vegetables in this refrigerator. Return a list of items found.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  count: { type: Type.NUMBER }
                },
                required: ["name"]
              }
            }
          },
          required: ["items"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result.items || [];
  } catch (error) {
    console.error("Error detecting ingredients:", error);
    return [];
  }
};

export const getRecipeRecommendations = async (ingredients: string[]): Promise<Recipe[]> => {
  const prompt = `Based on these ingredients found in my fridge: ${ingredients.join(", ")}, please recommend 3 delicious recipes I can make. Include detailed ingredients and instructions. Respond in Traditional Chinese (Taiwan).`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recipes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  ingredients: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING } 
                  },
                  instructions: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING } 
                  },
                  cookingTime: { type: Type.STRING }
                },
                required: ["title", "description", "ingredients", "instructions", "cookingTime"]
              }
            }
          },
          required: ["recipes"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    return result.recipes || [];
  } catch (error) {
    console.error("Error getting recipes:", error);
    return [];
  }
};
