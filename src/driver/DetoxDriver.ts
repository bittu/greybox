import type { FrameworkDriver, APICatalog } from '../types';
import { CodeEvaluator } from '../llm/CodeEvaluator';

export class DetoxDriver implements FrameworkDriver {
  private evaluator = new CodeEvaluator();
  private detox: any;

  constructor(detoxInstance?: any) {
    // Accept an explicit instance or lazy-load from peer dep
    this.detox = detoxInstance;
  }

  private get d(): any {
    if (!this.detox) {
      try {
        this.detox = require('detox');
      } catch {
        throw new Error('greybox: Detox peer dependency not found.');
      }
    }
    return this.detox;
  }

  async captureViewHierarchy(): Promise<string> {
    try {
      await this.d
        .waitFor(this.d.element(this.d.by.type('RCTRootContentView')))
        .toExist()
        .withTimeout(10000);
    } catch {
      // Non-fatal — still attempt capture
    }

    // Try multiple approaches in order of preference:
    // 1. generateViewHierarchyXml() returns a file path on some Detox versions
    // 2. On Android, the accessibility dump may collapse views — we handle that in the tree parser
    try {
      const result = await this.d.device.generateViewHierarchyXml();
      // Some Detox versions return a file path string, others return XML directly
      if (typeof result === 'string' && result.startsWith('/')) {
        const fs = require('fs');
        return fs.readFileSync(result, 'utf8');
      }
      return result ?? '<root/>';
    } catch {
      return '<root/>';
    }
  }

  async executeCode(code: string, context: Record<string, unknown>): Promise<unknown> {
    return this.evaluator.evaluate(code, { ...this.apiCatalog.context, ...context });
  }

  get apiCatalog(): APICatalog {
    const d = this.d;
    return {
      name: 'Detox',
      description: 'Gray-box E2E testing for React Native apps.',
      context: {
        element: d.element,
        by: d.by,
        expect: d.expect,
        waitFor: d.waitFor,
        device: d.device,
        system: d.system ?? {},
      },
      categories: [
        {
          title: 'Matchers',
          items: [
            {
              signature: 'by.id(id: string)',
              description: 'Match by testID / accessibility identifier. Preferred.',
              example: "element(by.id('loginButton'))",
              guidelines: ['Always prefer by.id when an id attribute is present in the tree.'],
            },
            {
              signature: 'by.label(label: string)',
              description: 'Match by accessibility label.',
              example: "element(by.label('Continue as guest'))",
            },
            {
              signature: 'by.text(text: string)',
              description: 'Match by visible text. Use as last resort.',
              example: "element(by.text('Sign In'))",
            },
            {
              signature: 'by.type(type: string)',
              description: 'Match by element type.',
              example: "element(by.type('UIScrollView')).atIndex(0)",
            },
          ],
        },
        {
          title: 'Actions',
          items: [
            {
              signature: 'tap()',
              description: 'Tap an element.',
              example: "await element(by.id('btn')).tap();",
            },
            {
              signature: 'longPress(duration?: number)',
              description: 'Long press an element.',
              example: "await element(by.id('btn')).longPress();",
            },
            {
              signature: 'typeText(text: string)',
              description: 'Type into a text field.',
              example: "await element(by.id('emailInput')).typeText('user@example.com');",
            },
            {
              signature: 'replaceText(text: string)',
              description: 'Replace text in a field.',
              example: "await element(by.id('field')).replaceText('new');",
            },
            {
              signature: 'clearText()',
              description: 'Clear a text field.',
              example: "await element(by.id('field')).clearText();",
            },
            {
              signature: 'scroll(offset: number, direction: string)',
              description: 'Scroll a scrollable element.',
              example: "await element(by.type('UIScrollView')).atIndex(0).scroll(300, 'down');",
              guidelines: ['Direction: up | down | left | right'],
            },
            {
              signature: 'swipe(direction: string, speed?: string)',
              description: 'Swipe gesture.',
              example: "await element(by.id('list')).swipe('up');",
            },
            {
              signature: 'atIndex(index: number)',
              description: 'Select the nth matched element.',
              example: "await element(by.label('OK')).atIndex(0).tap();",
              guidelines: [
                'Use atIndex(0) when multiple elements share the same label, e.g. after a system alert appears.',
              ],
            },
          ],
        },
        {
          title: 'Assertions',
          items: [
            {
              signature: 'toBeVisible(percent?: number)',
              description: 'Assert element is visible.',
              example: "await expect(element(by.id('home'))).toBeVisible();",
            },
            {
              signature: 'toExist()',
              description: 'Assert element exists in hierarchy.',
              example: "await expect(element(by.id('btn'))).toExist();",
            },
            {
              signature: 'toHaveText(text: string)',
              description: 'Assert element has text.',
              example: "await expect(element(by.id('label'))).toHaveText('Hello');",
            },
            {
              signature: 'not',
              description: 'Negate an assertion.',
              example: "await expect(element(by.id('spinner'))).not.toBeVisible();",
            },
            {
              signature: 'withTimeout(ms: number)',
              description: 'Wait up to ms for the assertion.',
              example: "await waitFor(element(by.id('screen'))).toBeVisible().withTimeout(3000);",
            },
          ],
        },
        {
          title: 'System APIs (iOS)',
          items: [
            {
              signature: 'system.element(by.system.label(label))',
              description:
                'Interact with iOS system dialogs (alerts, permissions). These are NOT in the app view hierarchy.',
              example: "await system.element(by.system.label('Allow')).tap();",
              guidelines: [
                'Use ONLY for native iOS system alerts/permission dialogs.',
                'System elements are invisible in the XML tree — read from context.',
              ],
            },
          ],
        },
        {
          title: 'Device',
          items: [
            {
              signature: 'device.launchApp(params?)',
              description: 'Launch the app.',
              example: 'await device.launchApp({ newInstance: true });',
            },
            {
              signature: 'device.getPlatform()',
              description: 'Returns "ios" or "android".',
              example: 'const platform = device.getPlatform();',
            },
          ],
        },
      ],
    };
  }
}
