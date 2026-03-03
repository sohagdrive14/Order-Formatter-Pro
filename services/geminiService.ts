
import { GoogleGenAI, Type } from "@google/genai";
import { OrderBlock } from "../types";

const PROMPT = `
Extract the order information from the provided content (image or text).
Reformat it into a structured JSON array of objects.

RULES:
1. Extract: Name, Phone Number, Price, and Address.
2. "codBill" should be only the numeric price or total.
3. "contact" should be the phone number(s).
4. "address" should be the delivery notes or full address.
5. DO NOT include flavor or item names.
6. Return a JSON array.

Example output:
[
  {
    "name": "Fariya Akter",
    "contact": "01836571137",
    "codBill": "650",
    "address": "সাড়ে এগারো দুয়ারিপাড়া বাজারের মসজিদের সামনে"
  }
]
`;

export async function processOrderData(input: string | { data: string; mimeType: string }): Promise<OrderBlock[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const isImage = typeof input !== 'string';
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: isImage 
        ? { parts: [{ inlineData: input as any }, { text: PROMPT }] }
        : { parts: [{ text: `${PROMPT}\n\nInput data:\n${input}` }] },
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              contact: { type: Type.STRING },
              codBill: { type: Type.STRING },
              address: { type: Type.STRING }
            },
            required: ["name", "contact", "codBill", "address"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No data returned from AI");
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to process data. Please check your input and try again.");
  }
}
