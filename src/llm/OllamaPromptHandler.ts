import type { PromptHandler } from '../types';

export interface OllamaConfig {
  /** Default: http://localhost:11434 */
  baseUrl?: string;
  /** Default: qwen2.5:7b */
  model?: string;
}

const SYSTEM_PROMPT = `You are a Detox test code generator for React Native.

OUTPUT RULES — follow exactly:
1. Output ONLY a single \`\`\`js code block
2. The code must be 1-5 lines of plain executable statements
3. NO imports, NO describe(), NO it(), NO test()
4. NO markdown outside the code fence
5. NO XML, NO explanations, NO comments

BAD output (never do this):
\`\`\`js
import { expect } from 'chai';
describe('test', () => {
  it('does thing', async () => {
    await expect(element(by.id('x'))).toBeVisible();
  });
});
\`\`\`

GOOD output (always do this):
\`\`\`js
await expect(element(by.id('welcomeMessage'))).toBeVisible();
\`\`\``;

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
        temperature: 0.0, // ← fully deterministic, no creativity
        num_predict: 200, // ← hard cap, prevents rambling
        stop: ['```\n\n', '```\r\n\r\n'], // ← stop after closing fence
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${res.statusText}`);

    const json = (await res.json()) as any;
    return json?.message?.content ?? json?.response ?? '';
  }
}
