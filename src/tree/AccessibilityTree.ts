import { parseDocument } from 'htmlparser2';
import { isTag } from 'domhandler';
import type { Element } from 'domhandler';
import type { TreeNode } from '../types';

// ── XML serialisation helpers ────────────────────────────────────────────────

const attrsToStr = (attrs: Record<string, string>): string =>
  Object.entries(attrs)
    .map(([k, v]) => `${k}="${v.replace(/"/g, '&quot;')}"`)
    .join(' ');

const serialise = (el: Element, indent = 0): string => {
  const pad = '  '.repeat(indent);
  const attrStr = Object.keys(el.attribs).length ? ` ${attrsToStr(el.attribs)}` : '';
  const children = el.children.filter(isTag);
  if (!children.length) return `${pad}<${el.name}${attrStr}/>`;
  const inner = children.map((c) => serialise(c, indent + 1)).join('\n');
  return `${pad}<${el.name}${attrStr}>\n${inner}\n${pad}</${el.name}>`;
};

// ── Platform-specific attribute normalisation ────────────────────────────────

/** Normalise an element's attributes into a consistent shape across platforms */
const normaliseAttrs = (el: Element): Record<string, string> => {
  const a = el.attribs;
  const norm: Record<string, string> = {};

  // id: testID (RN), accessibility-id (XCUITest), resource-id (Android)
  const id =
    a['accessibility-id'] ||
    a['name'] ||
    (a['resource-id'] ? a['resource-id'].split('/').pop()! : '') ||
    '';
  if (id) norm.id = id;

  // label: label (iOS), content-desc (Android)
  // Truncate very long concatenated labels (Android collapses entire screens)
  const rawLabel = a['label'] || a['content-desc'] || '';
  if (rawLabel && rawLabel.length <= 100) {
    norm.label = rawLabel;
  } else if (rawLabel) {
    // Extract first meaningful segment from comma-separated labels
    const firstSegment = rawLabel.split(',')[0].trim();
    norm.label = firstSegment.slice(0, 80);
  }

  // text / value
  const text = a['text'] || a['value'] || '';
  if (text && text.length <= 100) norm.text = text;
  else if (text) norm.text = text.slice(0, 80);

  // type: tag name is already the type for XCUITest; class for Android
  norm.type = a['class'] || el.name;

  // bounds
  if (a['x'] && a['width']) {
    norm.bounds = `${a['x']},${a['y']},${a['width']},${a['height']}`;
  } else if (a['bounds']) {
    norm.bounds = a['bounds'];
  }

  norm.enabled = a['enabled'] === 'false' ? 'false' : 'true';
  norm.visible = a['visible'] === 'false' || a['visible-to-user'] === 'false' ? 'false' : 'true';

  // Preserve raw_id if already stamped
  if (a['raw_id']) norm.raw_id = a['raw_id'];

  return norm;
};

// ── AccessibilityTree ────────────────────────────────────────────────────────

export class AccessibilityTree {
  private root: Element;
  private nextRawId = 0;
  private stamped = false;

  constructor(xml: string) {
    this.root = AccessibilityTree.parseRoot(xml);
  }

  private static parseRoot(xml: string): Element {
    // UIAutomator2 can produce multiple XML declarations — strip extras
    const cleaned = xml
      .split('\n')
      .filter((l) => !l.match(/^\s*<\?xml/))
      .join('\n');
    const wrapped = `<root>${cleaned}</root>`;
    const doc = parseDocument(wrapped, { xmlMode: true });
    const root = doc.children.find(isTag);
    if (!root) throw new Error('AccessibilityTree: failed to parse XML');
    return root;
  }

  /** Stamp every element with a sequential raw_id (from Alumnium) */
  private stamp(el: Element): void {
    this.nextRawId += 1;
    el.attribs['raw_id'] = String(this.nextRawId);
    el.attribs = normaliseAttrs(el);
    for (const child of el.children) {
      if (isTag(child)) this.stamp(child);
    }
  }

  /** Return the tree as indented XML with raw_id on every node */
  toXmlString(): string {
    if (!this.stamped) {
      this.stamp(this.root);
      this.stamped = true;
    }
    return serialise(this.root);
  }

  /** Return a compact representation keeping only nodes with useful attributes */
  toPrunedString(hint = '', maxNodes = 80): string {
    this.toXmlString(); // ensure stamped
    const all = this.collectAll(this.root);

    // Score nodes by relevance to hint
    const words = hint
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const scored = all.map((el) => {
      const fields = [el.attribs.id, el.attribs.label, el.attribs.text, el.attribs.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const score = words.filter((w) => fields.includes(w)).length;
      return { el, score };
    });

    scored.sort((a, b) => b.score - a.score || (b.el.attribs.enabled === 'true' ? 1 : 0));

    const kept = scored.slice(0, maxNodes).map(({ el }) => el);
    return kept.map((el) => serialise(el)).join('\n');
  }

  /** Find element by raw_id, return its normalised attrs */
  elementByRawId(rawId: number): Record<string, string> | null {
    const el = this.findById(this.root, String(rawId));
    return el ? el.attribs : null;
  }

  /** Scope tree to the subtree rooted at raw_id (from Alumnium's scopeToArea) */
  scopeToArea(rawId: number): AccessibilityTree {
    const el = this.findById(this.root, String(rawId));
    if (!el) return this;
    const scoped = new AccessibilityTree('<placeholder/>');
    scoped.root = el;
    scoped.stamped = true;
    return scoped;
  }

  /** Convert to flat list of TreeNode for cache hashing */
  toNodeList(): TreeNode[] {
    return this.collectAll(this.root).map((el) => ({
      rawId: Number(el.attribs.raw_id ?? 0),
      tag: el.name,
      attrs: el.attribs,
      children: [],
    }));
  }

  private collectAll(el: Element): Element[] {
    const results: Element[] = [el];
    for (const child of el.children) {
      if (isTag(child)) results.push(...this.collectAll(child));
    }
    return results;
  }

  private findById(el: Element, id: string): Element | null {
    if (el.attribs['raw_id'] === id) return el;
    for (const child of el.children) {
      if (isTag(child)) {
        const found = this.findById(child, id);
        if (found) return found;
      }
    }
    return null;
  }
}
