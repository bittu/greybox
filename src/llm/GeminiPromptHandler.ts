import type { PromptHandler } from '../types';

export interface GeminiConfig {
  apiKey: string;
  /** Default: gemini-1.5-flash */
  model?: string;
}

export class GeminiPromptHandler implements PromptHandler {
  private apiKey: string;
  private model: string;

  constructor(config: GeminiConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? 'gemini-1.5-flash';
  }

  async runPrompt(prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini error: ${res.status} ${res.statusText}`);
    const json = (await res.json()) as any;
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}
