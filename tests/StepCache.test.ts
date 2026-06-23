import { StepCache } from '../src/cache/StepCache';

// Disable file persistence for unit tests
jest.mock('fs', () => ({
  existsSync: () => false,
  readFileSync: () => '{}',
  writeFileSync: () => {},
  mkdirSync: () => {},
}));

describe('StepCache', () => {
  it('returns null on cache miss', () => {
    const cache = new StepCache(true);
    expect(cache.get('abc', 'tap something')).toBeNull();
  });

  it('stores and retrieves entries', () => {
    const cache = new StepCache(true);
    const hash = cache.treeHash('<el id="btn" type="Button"/>');
    cache.set(hash, 'tap the button', "await element(by.id('btn')).tap();");
    const result = cache.get(hash, 'tap the button');
    expect(result).toBe("await element(by.id('btn')).tap();");
  });

  it('is case-insensitive on instruction', () => {
    const cache = new StepCache(true);
    const hash = cache.treeHash('<el/>');
    cache.set(hash, 'Tap the Button', 'code');
    expect(cache.get(hash, 'tap the button')).toBe('code');
  });

  it('returns null when disabled', () => {
    const cache = new StepCache(false);
    const hash = cache.treeHash('<el/>');
    cache.set(hash, 'tap', 'code');
    expect(cache.get(hash, 'tap')).toBeNull();
  });

  it('treeHash produces stable hashes for same semantic content', () => {
    const cache = new StepCache(true);
    const xml1 = '<el id="btn" label="Go" type="Button" enabled="true"/>';
    const xml2 = '<el id="btn" label="Go" type="Button" enabled="true"/>';
    expect(cache.treeHash(xml1)).toBe(cache.treeHash(xml2));
  });

  it('treeHash differs for different content', () => {
    const cache = new StepCache(true);
    const h1 = cache.treeHash('<el id="btn1" type="Button"/>');
    const h2 = cache.treeHash('<el id="btn2" type="Button"/>');
    expect(h1).not.toBe(h2);
  });
});
