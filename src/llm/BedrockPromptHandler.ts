import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import type { PromptHandler } from '../types';

export interface BedrockConfig {
  /** AWS region. Default: us-east-1 */
  region?: string;
  /**
   * Model ID. Examples:
   *   anthropic.claude-3-haiku-20240307-v1:0
   *   anthropic.claude-3-5-sonnet-20241022-v2:0
   *   amazon.nova-lite-v1:0
   *   meta.llama3-70b-instruct-v1:0
   */
  modelId?: string;
  /** Max tokens. Default: 2048 */
  maxTokens?: number;
}

export class BedrockPromptHandler implements PromptHandler {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private maxTokens: number;

  constructor(config: BedrockConfig = {}) {
    this.client = new BedrockRuntimeClient({ region: config.region ?? 'us-east-1' });
    this.modelId = config.modelId ?? 'anthropic.claude-3-haiku-20240307-v1:0';
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async runPrompt(prompt: string): Promise<string> {
    // Bedrock requires model-specific request bodies
    const body = this.buildBody(prompt);

    const cmd = new InvokeModelCommand({
      modelId: this.modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(body),
    });

    const res = await this.client.send(cmd);
    const text = new TextDecoder().decode(res.body);
    return this.extractContent(JSON.parse(text));
  }

  private buildBody(prompt: string): object {
    // Anthropic Claude on Bedrock
    if (this.modelId.startsWith('anthropic.')) {
      return {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      };
    }
    // Amazon Nova / Titan
    if (this.modelId.startsWith('amazon.')) {
      return {
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: this.maxTokens },
      };
    }
    // Meta Llama
    if (this.modelId.startsWith('meta.')) {
      return { prompt, max_gen_len: this.maxTokens };
    }
    // Mistral
    if (this.modelId.startsWith('mistral.')) {
      return { prompt: `<s>[INST] ${prompt} [/INST]`, max_tokens: this.maxTokens };
    }
    // Fallback — OpenAI-style messages
    return { messages: [{ role: 'user', content: prompt }], max_tokens: this.maxTokens };
  }

  private extractContent(body: any): string {
    // Anthropic
    if (body.content?.[0]?.text) return body.content[0].text;
    // Amazon Nova
    if (body.output?.message?.content?.[0]?.text) return body.output.message.content[0].text;
    // Llama / Mistral
    if (body.generation) return body.generation;
    if (body.outputs?.[0]?.text) return body.outputs[0].text;
    return JSON.stringify(body);
  }
}
