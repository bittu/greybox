import { AccessibilityTree } from '../src/tree/AccessibilityTree';

const SAMPLE_XML = `
<XCUIElementTypeApplication name="MyApp" label="MyApp">
  <XCUIElementTypeWindow>
    <XCUIElementTypeOther>
      <XCUIElementTypeButton name="signInButton" label="Sign In" enabled="true" visible="true" x="100" y="200" width="200" height="44"/>
      <XCUIElementTypeTextField name="emailField" label="Email" value="" enabled="true" visible="true" x="50" y="100" width="300" height="44"/>
      <XCUIElementTypeSecureTextField name="passwordField" label="Password" value="" enabled="true" visible="true" x="50" y="160" width="300" height="44"/>
      <XCUIElementTypeStaticText name="title" label="Welcome" text="Welcome to the app" enabled="true" visible="true" x="50" y="50" width="300" height="30"/>
    </XCUIElementTypeOther>
  </XCUIElementTypeWindow>
</XCUIElementTypeApplication>
`;

describe('AccessibilityTree', () => {
  it('parses XML and stamps raw_id on every node', () => {
    const tree = new AccessibilityTree(SAMPLE_XML);
    const xml = tree.toXmlString();
    expect(xml).toContain('raw_id=');
    expect(xml).toContain('id="signInButton"');
    expect(xml).toContain('label="Sign In"');
  });

  it('normalises id from name attribute', () => {
    const tree = new AccessibilityTree(SAMPLE_XML);
    const xml = tree.toXmlString();
    expect(xml).toContain('id="emailField"');
    expect(xml).toContain('id="passwordField"');
  });

  it('toPrunedString returns relevant nodes for hint', () => {
    const tree = new AccessibilityTree(SAMPLE_XML);
    const pruned = tree.toPrunedString('tap the sign in button', 10);
    expect(pruned).toContain('Sign In');
    expect(pruned).toContain('signInButton');
  });

  it('toPrunedString respects maxNodes limit', () => {
    const tree = new AccessibilityTree(SAMPLE_XML);
    const full = tree.toPrunedString('', 100);
    const limited = tree.toPrunedString('', 2);
    // Limited output should be shorter than full output
    expect(limited.length).toBeLessThan(full.length);
  });

  it('toNodeList returns flat array of TreeNode', () => {
    const tree = new AccessibilityTree(SAMPLE_XML);
    const nodes = tree.toNodeList();
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[0]).toHaveProperty('rawId');
    expect(nodes[0]).toHaveProperty('tag');
    expect(nodes[0]).toHaveProperty('attrs');
  });

  it('elementByRawId finds element by id', () => {
    const tree = new AccessibilityTree(SAMPLE_XML);
    tree.toXmlString(); // stamps
    const attrs = tree.elementByRawId(1);
    expect(attrs).not.toBeNull();
    expect(attrs!.type).toBeDefined();
  });

  it('scopeToArea narrows the tree', () => {
    const tree = new AccessibilityTree(SAMPLE_XML);
    tree.toXmlString();
    const scoped = tree.scopeToArea(2);
    const xml = scoped.toXmlString();
    // Should be a subtree, so shorter than the full tree
    expect(xml.length).toBeLessThan(tree.toXmlString().length);
  });
});
