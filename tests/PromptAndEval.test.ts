import { buildPrompt, extractCode } from '../src/llm/PromptBuilder';
import { CodeEvaluator } from '../src/llm/CodeEvaluator';

describe('PromptBuilder', () => {
  const catalog = {
    name: 'Detox',
    description: 'Test framework',
    context: {},
    categories: [
      {
        title: 'Actions',
        items: [
          {
            signature: 'tap()',
            description: 'Tap an element.',
            example: "await element(by.id('btn')).tap();",
          },
        ],
      },
    ],
  };

  it('buildPrompt includes instruction and tree', () => {
    const prompt = buildPrompt('tap the button', '<el id="btn"/>', catalog, []);
    expect(prompt).toContain('tap the button');
    expect(prompt).toContain('<el id="btn"/>');
    expect(prompt).toContain('Detox');
  });

  it('buildPrompt includes history when provided', () => {
    const history = [{ instruction: 'previous step', code: 'code()', result: undefined }];
    const prompt = buildPrompt('next step', '<el/>', catalog, history);
    expect(prompt).toContain('previous step');
  });

  it('extractCode strips markdown fences', () => {
    const raw = "Some text\n```js\nawait element(by.id('x')).tap();\n```\nmore text";
    expect(extractCode(raw)).toBe("await element(by.id('x')).tap();");
  });

  it('extractCode handles ts fences', () => {
    const raw = '```typescript\nconst x = 1;\n```';
    expect(extractCode(raw)).toBe('const x = 1;');
  });

  it('extractCode returns raw if no fences', () => {
    const raw = "await element(by.id('btn')).tap();";
    expect(extractCode(raw)).toBe(raw);
  });
});

describe('CodeEvaluator', () => {
  const evaluator = new CodeEvaluator();

  it('evaluates simple code with context', async () => {
    const result = await evaluator.evaluate('return 1 + 2;', {});
    expect(result).toBe(3);
  });

  it('can access context variables', async () => {
    const mockElement = { tap: jest.fn().mockResolvedValue('tapped') };
    const mockBy = { id: (_id: string) => _id };
    const mockElementFn = (_matcher: string) => mockElement;

    await evaluator.evaluate("await element(by.id('btn')).tap();", {
      element: mockElementFn,
      by: mockBy,
    });
    expect(mockElement.tap).toHaveBeenCalled();
  });

  it('throws on invalid code', async () => {
    await expect(evaluator.evaluate('throw new Error("oops")', {})).rejects.toThrow(
      'CodeEvaluator',
    );
  });

  it('supports async code', async () => {
    const result = await evaluator.evaluate('const r = await Promise.resolve(42); return r;', {});
    expect(result).toBe(42);
  });
});
