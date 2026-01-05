
import { GoogleGenAI } from "@google/genai";

export const getMarketAnalysis = async (price: number, change24h: number, history: any[]) => {
  // Always use the API key directly from process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analiza la situación actual de la criptomoneda Raydium (RAY).
    Precio actual: $${price}
    Cambio en 24h: ${change24h}%
    Basándote en estos datos básicos y el contexto general del mercado cripto, proporciona un breve resumen (3-4 párrafos) que incluya:
    1. Sentimiento del mercado para Raydium.
    2. Posibles niveles de soporte y resistencia cercanos.
    3. Una breve recomendación sobre el mecanismo de alerta del 5% solicitado por el usuario.
    Responde en español con un tono profesional pero accesible.
  `;

  try {
    // Upgraded to gemini-3-pro-preview for complex reasoning and market analysis tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
    });
    // Access the text property directly from the response object
    return response.text;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return "Lo siento, no pude generar el análisis en este momento.";
  }
};
