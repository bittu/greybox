import type { PromptHandler } from '../types';
import { logger } from '../logger';

export interface DebugMiddlewareOptions {
  /** Log the full prompt sent to the LLM. Default: true */
  logPrompt?: boolean;
  /** Log the full raw LLM response. Default: true */
  logResponse?: boolean;
  /** Truncate prompt/response logs to this length. 0 = no truncation. Default: 2000 */
  truncateAt?: number;
  /** Write debug logs to a file instead of (or in addition to) console */
  logFile?: string;
}

/**
 * Wraps any PromptHandler and logs every interaction in detail.
 * Enable via PilotConfig.debug = true — designed to be transparent
 * and add zero overhead when not enabled.
 */
export class DebugMiddleware implements PromptHandler {
  private inner: PromptHandler;
  private opts: Required<DebugMiddlewareOptions>;
  private callCount = 0;

  constructor(inner: PromptHandler, opts: DebugMiddlewareOptions = {}) {
    this.inner = inner;
    this.opts = {
      logPrompt: opts.logPrompt ?? true,
      logResponse: opts.logResponse ?? true,
      truncateAt: opts.truncateAt ?? 2000,
      logFile: opts.logFile ?? '',
    };
  }

  async runPrompt(prompt: string): Promise<string> {
    this.callCount++;
    const callId = `#${this.callCount}`;
    const start = Date.now();

    const sep = '─'.repeat(60);
    const dbg = logger.labeled('DEBUG');

    dbg.info(`${sep}`);
    dbg.info(`LLM call ${callId} started`);

    if (this.opts.logPrompt) {
      const truncated = this.truncate(prompt);
      dbg.info(`PROMPT ${callId}:\n${truncated}`);
      this.writeToFile(`PROMPT ${callId}:\n${prompt}\n`);
    }

    let response: string;
    let threw = false;
    try {
      response = await this.inner.runPrompt(prompt);
    } catch (err) {
      threw = true;
      dbg.error(
        `LLM call ${callId} FAILED after ${Date.now() - start}ms: ${(err as Error).message}`,
      );
      this.writeToFile(`ERROR ${callId}: ${(err as Error).message}\n`);
      throw err;
    } finally {
      if (!threw) {
        // logged below
      }
    }

    const elapsed = Date.now() - start;

    if (this.opts.logResponse) {
      const truncated = this.truncate(response);
      dbg.info(`RESPONSE ${callId} (${elapsed}ms):\n${truncated}`);
      this.writeToFile(`RESPONSE ${callId} (${elapsed}ms):\n${response}\n`);
    } else {
      dbg.info(`LLM call ${callId} completed in ${elapsed}ms`);
    }

    dbg.info(`${sep}`);
    return response;
  }

  private truncate(s: string): string {
    if (this.opts.truncateAt === 0 || s.length <= this.opts.truncateAt) return s;
    return `${s.slice(0, this.opts.truncateAt)}\n… [truncated, ${s.length - this.opts.truncateAt} chars omitted]`;
  }

  private writeToFile(content: string): void {
    if (!this.opts.logFile) return;
    try {
      const fs = require('fs');
      const ts = new Date().toISOString();
      fs.appendFileSync(this.opts.logFile, `[${ts}] ${content}\n`);
    } catch {
      // Non-fatal
    }
  }
}
