import { DateTime } from "effect";
import type { Database } from "emdash";
import { sql, type Kysely } from "kysely";

export async function takeQuota(db: Kysely<Database>, key: string, maximum: number, windowSeconds = 60, now = DateTime.toEpochMillis(DateTime.nowUnsafe())): Promise<boolean> {
  const window = DateTime.formatIso(DateTime.makeUnsafe(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000));
  const { rows } = await sql<{ count: number }>`
    INSERT INTO _emdash_rate_limits (key, "window", count) VALUES (${key}, ${window}, 1)
    ON CONFLICT (key, "window") DO UPDATE SET count = _emdash_rate_limits.count + 1 RETURNING count
  `.execute(db);
  return rows[0].count <= maximum;
}
