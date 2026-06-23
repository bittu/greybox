import { retry } from '../src/retry';

describe('retry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retry(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail 1')).mockResolvedValue('ok');

    const result = await retry(fn, { maxAttempts: 3, backOffMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));
    await expect(retry(fn, { maxAttempts: 2, backOffMs: 10 })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects shouldRetry to stop early', async () => {
    class FatalError extends Error {}
    const fn = jest.fn().mockRejectedValue(new FatalError('fatal'));

    await expect(
      retry(fn, {
        maxAttempts: 5,
        backOffMs: 10,
        shouldRetry: (err) => !(err instanceof FatalError),
      }),
    ).rejects.toThrow('fatal');

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry callback', async () => {
    const onRetry = jest.fn();
    const fn = jest.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('ok');

    await retry(fn, { maxAttempts: 3, backOffMs: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
