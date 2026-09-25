import { expect, test } from "bun:test";
import type { APIContext } from "astro";
import type { EmojiOption } from "../../lib/house/types";
import { cmsTestDb } from "./cms-test-db";
import { takeQuota } from "./rate-limit";
import { digest } from "./cms-schema";
import { suggestionResponse } from "./suggest";

test("suggestions keep per-address and global CMS-backed quotas without a Durable Object", async () => {
  const { db } = await cmsTestDb();
  try {
    const request = (origin = "https://portfolio.test") => suggestionResponse({
      request: new Request("https://portfolio.test/api/house/suggest", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ text: "popcorn" }) }),
      locals: { emdash: { db } }, cache: { set() {} },
    } as unknown as APIContext);
    expect((await request("https://other.test")).status).toBe(403);
    const first = await request();
    expect(first.status).toBe(200);
    expect((await first.json() as { options: EmojiOption[] }).options[0].id).toBe("popcorn");
    for (let i = 1; i < 120; i++) await takeQuota(db, `house:suggest:${await digest("unknown")}`, 120);
    expect((await request()).status).toBe(429);
    await db.deleteFrom("_emdash_rate_limits").execute();
    for (let i = 0; i < 600; i++) await takeQuota(db, "house:suggest:global", 600);
    expect((await request()).status).toBe(429);
  } finally { await db.destroy(); }
});
