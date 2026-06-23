import {
  PilotError,
  CodeEvaluationError,
  AssertionError,
  ElementNotFoundError,
} from '../src/errors';

describe('Error classes', () => {
  it('PilotError has correct name and message', () => {
    const err = new PilotError('something broke');
    expect(err.name).toBe('PilotError');
    expect(err.message).toBe('something broke');
    expect(err).toBeInstanceOf(Error);
  });

  it('CodeEvaluationError stores code', () => {
    const cause = new Error('underlying');
    const err = new CodeEvaluationError('eval failed', 'bad code()', cause);
    expect(err.name).toBe('CodeEvaluationError');
    expect(err.code).toBe('bad code()');
    expect(err.cause).toBe(cause);
  });

  it('AssertionError extends PilotError', () => {
    const err = new AssertionError('expected visible');
    expect(err.name).toBe('AssertionError');
    expect(err).toBeInstanceOf(PilotError);
  });

  it('ElementNotFoundError includes instruction', () => {
    const err = new ElementNotFoundError('tap the missing button', 'not in tree');
    expect(err.name).toBe('ElementNotFoundError');
    expect(err.message).toContain('tap the missing button');
    expect(err.message).toContain('not in tree');
    expect(err.instruction).toBe('tap the missing button');
  });
});
