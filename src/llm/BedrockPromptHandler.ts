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
  private client: any;
  private InvokeModelCommand: any;
  private modelId: string;
  private maxTokens: number;

  constructor(config: BedrockConfig = {}) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const bedrock = require('@aws-sdk/client-bedrock-runtime');
      this.client = new bedrock.BedrockRuntimeClient({ region: config.region ?? 'us-east-1' });
      this.InvokeModelCommand = bedrock.InvokeModelCommand;
    } catch {
      throw new Error(
        'greybox: @aws-sdk/client-bedrock-runtime is required for BedrockPromptHandler. ' +
          'Install it with: npm install @aws-sdk/client-bedrock-runtime',
      );
    }
    this.modelId = config.modelId ?? 'anthropic.claude-3-haiku-20240307-v1:0';
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async runPrompt(prompt: string): Promise<string> {
    const body = this.buildBody(prompt);

    const cmd = new this.InvokeModelCommand({
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
    if (this.modelId.startsWith('anthropic.')) {
      return {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: this.maxTokens,
        messages: [{ role: 'user', content: prompt }],
      };
    }
    if (this.modelId.startsWith('amazon.')) {
      return {
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: this.maxTokens },
      };
    }
    if (this.modelId.startsWith('meta.')) {
      return { prompt, max_gen_len: this.maxTokens };
    }
    if (this.modelId.startsWith('mistral.')) {
      return { prompt: `<s>[INST] ${prompt} [/INST]`, max_tokens: this.maxTokens };
    }
    return { messages: [{ role: 'user', content: prompt }], max_tokens: this.maxTokens };
  }

  private extractContent(body: any): string {
    if (body.content?.[0]?.text) return body.content[0].text;
    if (body.output?.message?.content?.[0]?.text) return body.output.message.content[0].text;
    if (body.generation) return body.generation;
    if (body.outputs?.[0]?.text) return body.outputs[0].text;
    return JSON.stringify(body);
  }
}
