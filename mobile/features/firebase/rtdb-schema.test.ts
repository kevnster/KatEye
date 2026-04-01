import { getRtdbSchemaFixturePackage } from '@/features/firebase/rtdb-schema-fixture';

describe('rtdb schema example fixture', () => {
  it('loads pkg node with latest + readings', () => {
    const node = getRtdbSchemaFixturePackage();
    expect(node.latest.windowStartTs).toBeDefined();
    expect(node.readings).toBeDefined();
    expect(Object.keys(node.readings).length).toBeGreaterThan(0);
  });

  it('windows have events', () => {
    const node = getRtdbSchemaFixturePackage();
    for (const w of Object.values(node.readings)) {
      expect(Object.keys(w.events).length).toBeGreaterThan(0);
    }
  });
});
