'use server';
/**
 * @fileOverview Analyzes uploaded images and suggests a color theme that complements the images.
 *
 * - generateTheme - A function that generates a color theme for the images.
 * - GenerateThemeInput - The input type for the generateTheme function.
 * - GenerateThemeOutput - The return type for the generateTheme function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateThemeInputSchema = z.object({
  photoDataUris: z
    .array(z.string())
    .describe(
      "A list of photos as data URIs that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateThemeInput = z.infer<typeof GenerateThemeInputSchema>;

const GenerateThemeOutputSchema = z.object({
  theme: z
    .object({
      primaryColor: z.string().describe('The primary color of the theme.'),
      backgroundColor: z.string().describe('The background color of the theme.'),
      accentColor: z.string().describe('The accent color of the theme.'),
    })
    .describe('The color theme for the images.'),
});
export type GenerateThemeOutput = z.infer<typeof GenerateThemeOutputSchema>;

export async function generateTheme(input: GenerateThemeInput): Promise<GenerateThemeOutput> {
  return generateThemeFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateThemePrompt',
  input: {schema: GenerateThemeInputSchema},
  output: {schema: GenerateThemeOutputSchema},
  prompt: `Você é um especialista em temas de cores. Analise as imagens fornecidas e sugira um tema de cores que complemente as imagens. O tema de cores deve incluir uma cor primária, uma cor de fundo e uma cor de destaque.

Imagens:
{{#each photoDataUris}}
  {{media url=this}}
{{/each}}`,
});

const generateThemeFlow = ai.defineFlow(
  {
    name: 'generateThemeFlow',
    inputSchema: GenerateThemeInputSchema,
    outputSchema: GenerateThemeOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
