import type { PromptHandler } from '../types';
import type { TokenUsageCollector, TokenUsage } from './TokenCounter';
import { estimateTokens, estimateCost } from './TokenCounter';

export interface TokenMiddlewareOptions {
  model: string;
  collector: TokenUsageCollector;
}

/**
 * Wraps any PromptHandler and intercepts every runPrompt() call to:
 * - Count prompt + completion tokens (exact from API response if available,
 *   estimated otherwise)
 * - Compute cost using the built-in pricing table
 * - Emit usage to the provided TokenUsageCollector
 *
 * Designed as a transparent wrapper — behaviour of the inner handler is
 * completely unchanged.
 */
export class TokenMiddleware implements PromptHandler {
  private inner: PromptHandler & { _lastRawResponse?: any };
  private model: string;
  private collector: TokenUsageCollector;

  constructor(inner: PromptHandler, options: TokenMiddlewareOptions) {
    this.inner = inner;
    this.model = options.model;
    this.collector = options.collector;
  }

  async runPrompt(prompt: string): Promise<string> {
    const start = Date.now();

    // Monkey-patch the inner handler's fetch call once to capture raw JSON
    // without forking every handler implementation. We do this by temporarily
    // wrapping the global fetch.
    let rawResponseBody: any = null;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input: any, init?: any) => {
      const res = await originalFetch(input, init);
      // Clone so the inner handler can still read the body
      const clone = res.clone();
      clone
        .json()
        .then((body: any) => {
          rawResponseBody = body;
        })
        .catch(() => {});
      return res;
    };

    let response: string;
    try {
      response = await this.inner.runPrompt(prompt);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const usage = this.extractUsage(prompt, response, rawResponseBody, Date.now() - start);
    this.collector.recordStepTokens(usage);
    return response;
  }

  private extractUsage(
    prompt: string,
    response: string,
    raw: any,
    durationMs: number,
  ): TokenUsage & { durationMs: number } {
    // Try to read exact counts from the API response body
    // OpenAI / Groq / Mistral / OpenAI-compatible
    if (raw?.usage?.prompt_tokens != null) {
      return {
        promptTokens: raw.usage.prompt_tokens,
        completionTokens: raw.usage.completion_tokens ?? 0,
        totalTokens: raw.usage.total_tokens ?? 0,
        estimatedCostUsd: estimateCost(
          this.model,
          raw.usage.prompt_tokens,
          raw.usage.completion_tokens ?? 0,
        ),
        exact: true,
        durationMs,
      };
    }
    // Anthropic
    if (raw?.usage?.input_tokens != null) {
      return {
        promptTokens: raw.usage.input_tokens,
        completionTokens: raw.usage.output_tokens ?? 0,
        totalTokens: (raw.usage.input_tokens ?? 0) + (raw.usage.output_tokens ?? 0),
        estimatedCostUsd: estimateCost(
          this.model,
          raw.usage.input_tokens,
          raw.usage.output_tokens ?? 0,
        ),
        exact: true,
        durationMs,
      };
    }
    // Amazon Bedrock Nova
    if (raw?.usage?.inputTokens != null) {
      return {
        promptTokens: raw.usage.inputTokens,
        completionTokens: raw.usage.outputTokens ?? 0,
        totalTokens: (raw.usage.inputTokens ?? 0) + (raw.usage.outputTokens ?? 0),
        estimatedCostUsd: estimateCost(
          this.model,
          raw.usage.inputTokens,
          raw.usage.outputTokens ?? 0,
        ),
        exact: true,
        durationMs,
      };
    }
    // Ollama includes eval_count / prompt_eval_count at the top level
    if (raw?.prompt_eval_count != null) {
      return {
        promptTokens: raw.prompt_eval_count,
        completionTokens: raw.eval_count ?? 0,
        totalTokens: (raw.prompt_eval_count ?? 0) + (raw.eval_count ?? 0),
        estimatedCostUsd: 0, // local model
        exact: true,
        durationMs,
      };
    }
    // Fallback: estimate from text length
    const pt = estimateTokens(prompt);
    const ct = estimateTokens(response);
    return {
      promptTokens: pt,
      completionTokens: ct,
      totalTokens: pt + ct,
      estimatedCostUsd: estimateCost(this.model, pt, ct),
      exact: false,
      durationMs,
    };
  }
}
