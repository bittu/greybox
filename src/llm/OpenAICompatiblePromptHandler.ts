import type { PromptHandler } from '../types';

export interface OpenAICompatibleConfig {
  apiKey: string;
  /** Default: https://api.openai.com/v1 */
  baseUrl?: string;
  /** Default: gpt-4o-mini */
  model?: string;
}

export class OpenAICompatiblePromptHandler implements PromptHandler {
  private config: Required<OpenAICompatibleConfig>;

  constructor(config: OpenAICompatibleConfig) {
    this.config = {
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      ...config,
    };
  }

  async runPrompt(prompt: string): Promise<string> {
    const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      }),
    });

    if (!res.ok) throw new Error(`LLM error: ${res.status} ${res.statusText}`);

    const json = (await res.json()) as any;
    return json?.choices?.[0]?.message?.content ?? '';
  }
}
