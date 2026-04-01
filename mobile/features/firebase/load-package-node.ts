import { get, ref } from 'firebase/database';

import { rtdb } from '@/features/firebase/client';
import { EXAMPLE_PACKAGE_RTD_PATH, type HardwarePackageNode } from '@/features/firebase/hardware-payload';
import { getRtdbSchemaFixturePackage, useRtdbFixture } from '@/features/firebase/rtdb-schema-fixture';

export type LoadPackageNodeResult =
  | { ok: true; source: 'fixture' | 'rtdb'; data: HardwarePackageNode }
  | { ok: false; source: 'fixture' | 'rtdb'; message: string };

/** one place for home screen / tests: fixture env or live get() */
export async function loadExamplePackageNode(): Promise<LoadPackageNodeResult> {
  if (useRtdbFixture()) {
    try {
      return { ok: true, source: 'fixture', data: getRtdbSchemaFixturePackage() };
    } catch (e) {
      return {
        ok: false,
        source: 'fixture',
        message: e instanceof Error ? e.message : 'fixture load failed',
      };
    }
  }

  try {
    const path = EXAMPLE_PACKAGE_RTD_PATH;
    const snapshot = await get(ref(rtdb, path));
    if (!snapshot.exists()) {
      return { ok: false, source: 'rtdb', message: `no data at ${path}` };
    }
    return { ok: true, source: 'rtdb', data: snapshot.val() as HardwarePackageNode };
  } catch (e) {
    return {
      ok: false,
      source: 'rtdb',
      message: e instanceof Error ? e.message : 'rtdb error',
    };
  }
}
