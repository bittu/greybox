import type { PromptHandler } from '../types';

export interface OllamaConfig {
  /** Default: http://localhost:11434 */
  baseUrl?: string;
  /** Default: qwen2.5:7b */
  model?: string;
}

export class OllamaPromptHandler implements PromptHandler {
  private baseUrl: string;
  private model: string;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
    this.model = config.model ?? 'qwen2.5:7b';
  }

  async runPrompt(prompt: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`);

    const json = (await res.json()) as any;
    return json?.message?.content ?? json?.response ?? '';
  }
}
