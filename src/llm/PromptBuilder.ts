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
# Task
You are an AI test automation assistant. Given a UI accessibility tree and a test instruction,
generate the exact ${catalog.name} code to perform the instruction.

## Rules
- Respond ONLY with valid JavaScript/TypeScript code inside a \`\`\`js code block.
- Use \`raw_id\` attributes from the tree to identify elements. Map raw_id to the best available matcher:
  - Prefer \`by.id()\` when the element has an \`id\` attr.
  - Use \`by.label()\` when only a \`label\` is available.
  - Use \`by.text()\` as last resort.
- If the element is not in the tree, emit: \`throw new Error('Element not found: <reason>')\`
- For system dialogs (iOS alerts, permission prompts), use \`system.element(by.system.label('...'))\`.
- Wrap multi-step sequences in a single async IIFE if needed.
- Do NOT import anything — all APIs are already in scope.

${formatHistory(history)}

${formatCatalog(catalog)}

# UI Tree (pruned, each node has raw_id)
\`\`\`xml
${treeXml}
\`\`\`

# Instruction
${instruction}

Respond with ONLY the code block, nothing else.
`.trim();

/** Extract the JS code from the LLM response, stripping markdown fences */
export const extractCode = (response: string): string => {
  const match = response.match(/```(?:js|ts|javascript|typescript)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  // No fences — treat entire response as code
  return response.trim();
};
