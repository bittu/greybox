/**
 * Evaluates LLM-generated JS code with the framework's globals injected.
 * Modelled on Pilot's CodeEvaluator — the key insight is that the LLM returns
 * real runnable code instead of a JSON descriptor, so we just eval it.
 */
export class CodeEvaluator {
  async evaluate(code: string, context: Record<string, unknown>): Promise<unknown> {
    // Build a function that receives all context keys as named parameters
    const keys = Object.keys(context);
    const values = keys.map((k) => context[k]);

    // Wrap in async IIFE so await works at top level
    const wrapped = `(async () => { ${code} })()`;

    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(...keys, `return ${wrapped}`);
      return await fn(...values);
    } catch (err) {
      throw new Error(
        `CodeEvaluator: execution failed.\nCode:\n${code}\n\nError: ${(err as Error).message}`,
      );
    }
  }
}
