import { expect, test } from "bun:test";
import { cmsTestDb } from "./cms-test-db";
import { takeQuota } from "./rate-limit";

test("CMS-backed quotas are atomic, independent by key, and reset by time window", async () => {
  const { db } = await cmsTestDb();
  try {
    const accepted = await Promise.all(Array.from({ length: 12 }, () => takeQuota(db, "house:test:one", 10, 60, 1000)));
    expect(accepted.filter(Boolean)).toHaveLength(10);
    expect(await takeQuota(db, "house:test:one", 10, 60, 2000)).toBe(false);
    expect(await takeQuota(db, "house:test:other", 10, 60, 2000)).toBe(true);
    expect(await takeQuota(db, "house:test:one", 10, 60, 61000)).toBe(true);
  } finally { await db.destroy(); }
});
