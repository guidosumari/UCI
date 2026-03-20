
import { GoogleGenAI } from "@google/genai";

export const generateClinicalSummary = async (patientName: string, notes: string): Promise<string> => {
  try {
    // Use VITE_GEMINI_API_KEY from import.meta.env for Vite
    // Note: Use the updated environment variable
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Eres un clínico experto en UCI. Analiza las siguientes notas clínicas del paciente ${patientName} y genera un resumen ISBAR conciso y estructurado (Identificación, Situación, Antecedentes, Evaluación, Recomendación) para una entrega de turno. Utiliza terminología médica profesional en español. Notas: ${notes}`,
      config: {
        temperature: 0.7,
        topP: 0.9,
      }
    });

    return response.text || "No se pudo generar el resumen.";
  } catch (error) {
    console.error("Error de Gemini:", error);
    return "El asistente de IA no está disponible actualmente. Por favor, revise la ficha manualmente.";
  }
};
