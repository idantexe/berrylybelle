import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) {
    console.warn("API Key is missing. AI features will respond with mock data.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateStyleAdvice = async (
  occasion: string,
  preferences: string,
  bodyType: string,
  language: 'en' | 'id' = 'en'
): Promise<string> => {
  const ai = getAiClient();
  
  const mockResponse = language === 'id' 
    ? `(AI Mock Response) Berdasarkan tipe tubuh ${bodyType} dan acara (${occasion}), kami merekomendasikan siluet A-line dengan kain ${preferences}. Ini akan menonjolkan fitur terbaik Anda sekaligus memberikan kenyamanan.`
    : `(AI Mock Response) Based on your ${bodyType} body type and the occasion (${occasion}), we recommend an A-line silhouette with ${preferences} fabrics. This will accentuate your best features while providing comfort.`;

  if (!ai) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockResponse);
      }, 1000);
    });
  }

  try {
    const prompt = `
      You are an expert fashion stylist for the platform "Berryly Belle".
      
      User Profile:
      - Occasion: ${occasion}
      - Style Preferences: ${preferences}
      - Self-described Body Type: ${bodyType}

      Please provide a concise, friendly, and professional fashion recommendation. 
      Focus on fabric choice, cut/silhouette, and color palette. 
      ${language === 'id' ? 'Answer in Indonesian.' : 'Answer in English.'}
      Keep it under 100 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "I couldn't generate a recommendation at this moment.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return language === 'id' 
      ? "Maaf, stylist AI kami sedang offline. Silakan coba lagi nanti."
      : "Sorry, our AI stylist is currently offline. Please try again later.";
  }
};