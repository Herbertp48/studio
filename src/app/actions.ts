"use server";

import { generateTheme, type GenerateThemeInput, type GenerateThemeOutput } from '@/ai/flows/generate-theme';

export async function generateThemeAction(input: GenerateThemeInput): Promise<GenerateThemeOutput> {
  try {
    const output = await generateTheme(input);
    if (!output || !output.theme) {
      throw new Error("AI did not return a valid theme.");
    }
    return output;
  } catch (error) {
    console.error("Error generating theme in server action:", error);
    throw new Error("Failed to generate theme from AI.");
  }
}
