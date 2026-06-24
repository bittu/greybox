import type { APICatalog, StepResult } from '../types';

const formatCatalog = (catalog: APICatalog): string => {
  const lines: string[] = [`# Available ${catalog.name} APIs`, catalog.description, ''];
  for (const cat of catalog.categories) {
    lines.push(`## ${cat.title}`);
    for (const item of cat.items) {
      lines.push(`### ${item.signature}`);
      lines.push(item.description);
      lines.push(`Example:\n\`\`\`js\n${item.example}\n\`\`\``);
      if (item.guidelines?.length) {
        lines.push('Guidelines:');
        item.guidelines.forEach((g) => lines.push(`- ${g}`));
      }
      lines.push('');
    }
  }
  return lines.join('\n');
};

const formatHistory = (history: StepResult[]): string => {
  if (!history.length) return '';
  const lines = ['# Previous steps'];
  for (const s of history.slice(-5)) {
    lines.push(`- Instruction: "${s.instruction}"`);
    lines.push(`  Code: \`${s.code.replace(/\n/g, ' ').slice(0, 120)}\``);
  }
  return lines.join('\n');
};

export const buildPrompt = (
  instruction: string,
  treeXml: string,
  catalog: APICatalog,
  history: StepResult[],
): string =>
  `
Generate ${catalog.name} JavaScript code for this test step.

IMPORTANT: Output ONLY a \`\`\`js code block with executable JavaScript. No XML. No explanation.

Available APIs:
- element(by.id('testID')).tap() — tap an element by testID
- element(by.label('text')).tap() — tap by accessibility label
- element(by.text('text')).tap() — tap by visible text
- element(by.type('ScrollView')).atIndex(0).scroll(300, 'down') — scroll
- await expect(element(by.text('...'))).toBeVisible() — assert visible
- await expect(element(by.label('...'))).toExist() — assert exists
- element(by.id('field')).typeText('value') — type text

${formatHistory(history)}

UI Tree:
\`\`\`xml
${treeXml}
\`\`\`

Instruction: ${instruction}

Example output for "verify Hello is visible":
\`\`\`js
await expect(element(by.text('Hello'))).toBeVisible();
\`\`\`

Now generate the code for the instruction above:
`.trim();

/** Extract the JS code from the LLM response, stripping markdown fences */
export const extractCode = (response: string): string => {
  // Only accept js/ts/javascript/typescript fenced blocks
  const match = response.match(/```(?:js|ts|javascript|typescript)\s*([\s\S]*?)```/);
  if (match) {
    const code = match[1].trim();
    // Reject if the LLM returned XML/HTML instead of code
    if (code.startsWith('<')) return '';
    return code;
  }
  // Check for any fenced block (but reject xml/html)
  const anyFence = response.match(/```(?!xml|html)(\w*)\s*([\s\S]*?)```/);
  if (anyFence) {
    const code = anyFence[2].trim();
    if (code.startsWith('<')) return '';
    return code;
  }
  // No fences — only treat as code if it looks like JS (starts with await/const/return/throw)
  const trimmed = response.trim();
  if (/^(await|const|let|var|return|throw|if|for|element|expect|waitFor)/.test(trimmed)) {
    return trimmed;
  }
  return '';
};
