import schemaTree from '../../../firebase-rtdb-schema-example.json';

import { EXAMPLE_PACKAGE_ID, type HardwarePackageNode } from '@/features/firebase/hardware-payload';

type SchemaFileRoot = { packages: Record<string, HardwarePackageNode> };

// set EXPO_PUBLIC_RTD_USE_FIXTURE=1 (see npm run start:fixture) — skips rtdb, uses bundled json
export function useRtdbFixture(): boolean {
  return process.env.EXPO_PUBLIC_RTD_USE_FIXTURE === '1';
}

export function getRtdbSchemaFixturePackage(): HardwarePackageNode {
  const root = schemaTree as SchemaFileRoot;
  const node = root.packages[EXAMPLE_PACKAGE_ID];
  if (!node) {
    throw new Error(`fixture: missing packages.${EXAMPLE_PACKAGE_ID}`);
  }
  return node;
}
