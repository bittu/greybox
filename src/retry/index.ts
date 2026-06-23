import { logger } from '../logger';

export interface RetryOptions {
  maxAttempts?: number;
  backOffMs?: number;
  /** Return false to stop retrying for a specific error */
  shouldRetry?: (err: Error, attempt: number) => boolean;
  onRetry?: (err: Error, attempt: number) => void;
}

export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const backOffMs = options.backOffMs ?? 500;
  let lastErr: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err as Error;

      if (options.shouldRetry && !options.shouldRetry(lastErr, attempt)) {
        throw lastErr;
      }

      if (attempt < maxAttempts) {
        options.onRetry?.(lastErr, attempt);
        logger
          .labeled('RETRY')
          .warn(
            `Attempt ${attempt}/${maxAttempts} failed: ${lastErr.message} — retrying in ${backOffMs}ms`,
          );
        await new Promise((r) => setTimeout(r, backOffMs));
      }
    }
  }

  throw lastErr ?? new Error('retry: failed with no error captured');
}
