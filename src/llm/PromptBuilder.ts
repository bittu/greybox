import type { APICatalog, StepResult } from '../types';

const formatHistory = (history: StepResult[]): string => {
  if (!history.length) return '';
  const lines = ['Previous steps:'];
  for (const s of history.slice(-5)) {
    lines.push(`- "${s.instruction}" → \`${s.code.replace(/\n/g, ' ').slice(0, 100)}\``);
  }
  return lines.join('\n');
};

export const buildPrompt = (
  instruction: string,
  treeXml: string,
  catalog: APICatalog,
  history: StepResult[],
): string => {
  const historyBlock = history.length > 0 ? `\n${formatHistory(history)}\n` : '';

  const apis = catalog.categories
    .flatMap((cat) => cat.items.map((item) => `- ${item.example}`))
    .join('\n');

  return `You write ${catalog.name} test code. Output ONLY a \`\`\`js block with 1-3 lines of code.

RULES:
- No imports. No describe/it/test blocks. No comments. Just the action code.
- ONLY use element IDs, labels, or text values that appear in the tree below.
- For labels with comma-separated text, each segment is a separate visible text on screen. Use by.text() with the exact segment.
- If the element is not in the tree, output: throw new Error('Element not found')

APIs:
${apis}
${historyBlock}
UI Tree:
\`\`\`xml
${treeXml}
\`\`\`

Instruction: ${instruction}

Example for "verify Welcome is visible" given tree has label="Welcome to React Native":
\`\`\`js
await expect(element(by.text('Welcome to React Native'))).toBeVisible();
\`\`\`

Output:`;
};

/** Extract the JS code from the LLM response, stripping markdown fences */
export const extractCode = (response: string): string => {
  // Only accept js/ts/javascript/typescript fenced blocks
  const match = response.match(/```(?:js|ts|javascript|typescript)\s*([\s\S]*?)```/);
  if (match) {
    const code = match[1].trim();
    if (!isValidCode(code)) return '';
    return code;
  }
  // Check for any fenced block (but reject xml/html)
  const anyFence = response.match(/```(?!xml|html)(\w*)\s*([\s\S]*?)```/);
  if (anyFence) {
    const code = anyFence[2].trim();
    if (!isValidCode(code)) return '';
    return code;
  }
  // No fences — only treat as code if it looks like executable JS
  const trimmed = response.trim();
  if (/^(await|const|let|var|return|throw|if|for|element|expect|waitFor)/.test(trimmed)) {
    if (!isValidCode(trimmed)) return '';
    return trimmed;
  }
  return '';
};

/** Reject responses that aren't executable code snippets */
function isValidCode(code: string): boolean {
  if (code.startsWith('<')) return false;
  if (code.startsWith('import ')) return false;
  if (/^(describe|it|test)\s*\(/.test(code)) return false;
  return true;
}
