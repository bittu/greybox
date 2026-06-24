import type { PromptHandler } from '../types';

export interface AnthropicConfig {
  apiKey: string;
  /** Default: claude-3-haiku-20240307 */
  model?: string;
  /** Default: 2048 */
  maxTokens?: number;
}

export class AnthropicPromptHandler implements PromptHandler {
  private client: any;
  private model: string;
  private maxTokens: number;

  constructor(config: AnthropicConfig) {
    try {
      const Anthropic = require('@anthropic-ai/sdk');
      this.client = new Anthropic({ apiKey: config.apiKey });
    } catch {
      throw new Error(
        'greybox: @anthropic-ai/sdk is required for AnthropicPromptHandler. ' +
          'Install it with: npm install @anthropic-ai/sdk',
      );
    }
    this.model = config.model ?? 'claude-3-haiku-20240307';
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async runPrompt(prompt: string): Promise<string> {
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const block = msg.content[0];
    return block.type === 'text' ? block.text : '';
  }
}
