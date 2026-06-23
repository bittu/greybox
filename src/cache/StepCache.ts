import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { CacheEntry } from '../types';

// Cache is persisted to the project root so it survives across runs.
// Add this file to .gitignore or commit it to share cache across the team.
const CACHE_FILE = path.resolve(process.cwd(), '.greybox-cache.json');
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

/**
 * Produces a stable hash of the screen's semantic content — deliberately
 * excludes raw_id (sequential, shifts when DOM changes) and bounds
 * (change on device resize). Only id, label, text, type and enabled
 * are hashed, so the same logical screen always produces the same hash.
 */
const semanticHash = (prunedXml: string): string => {
  // Extract only stable attribute values from the XML string
  const tokens: string[] = [];
  const attrPattern = /\b(id|label|text|type|enabled)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = attrPattern.exec(prunedXml)) !== null) {
    tokens.push(`${m[1]}=${m[2]}`);
  }
  return crypto.createHash('sha256').update(tokens.join('|')).digest('hex').slice(0, 16);
};

export class StepCache {
  private memory: Map<string, CacheEntry> = new Map();
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
    if (enabled) this.load();
  }

  private key(treeHash: string, instruction: string): string {
    return crypto
      .createHash('sha256')
      .update(`${treeHash}::${instruction.toLowerCase().trim()}`)
      .digest('hex')
      .slice(0, 16);
  }

  /** Stable semantic hash of pruned XML — safe to use as cache key across runs */
  treeHash(prunedXml: string): string {
    return semanticHash(prunedXml);
  }

  get(treeHash: string, instruction: string): string | null {
    if (!this.enabled) return null;
    const entry = this.memory.get(this.key(treeHash, instruction));
    if (!entry) return null;
    if (Date.now() - entry.timestamp > TTL_MS) {
      this.memory.delete(this.key(treeHash, instruction));
      return null;
    }
    return entry.code;
  }

  set(treeHash: string, instruction: string, code: string): void {
    if (!this.enabled) return;
    const entry: CacheEntry = { treeHash, instruction, code, timestamp: Date.now() };
    this.memory.set(this.key(treeHash, instruction), entry);
    this.persist();
  }

  private load(): void {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as Record<string, CacheEntry>;
        this.memory = new Map(Object.entries(raw));
      }
    } catch {
      // Cache file corrupt — start fresh
    }
  }

  private persist(): void {
    try {
      const obj = Object.fromEntries(this.memory.entries());
      fs.writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 2));
    } catch {
      // Non-fatal
    }
  }
}
