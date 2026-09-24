import { describe, expect, test } from "bun:test";
import { HOUSE_COLLECTION, HOUSE_SYNC_REQUEST } from "../../lib/house/collection";
import { isPublicSyncRequest } from "./sync";

describe("public read-only partysync boundary", () => {
  test("only the known channel can sync, regardless of the client watermark", () => {
    expect(isPublicSyncRequest(HOUSE_SYNC_REQUEST)).toBe(true);
    for (const from of [null, 0, 999_999, "2099-01-01", { sql: "gifts" }]) {
      expect(isPublicSyncRequest(JSON.stringify({ sync: true, channel: HOUSE_COLLECTION, from }))).toBe(true);
    }
  });

  test("rejects mutations, private tables, SQL fragments, malformed and binary frames", () => {
    const rejected: unknown[] = [
      "{", "null", "[]", new ArrayBuffer(1), new Uint8Array(1), " ".repeat(4_097),
      { channel: "gifts", sync: true },
      { channel: "gift_receipts", sync: true },
      { channel: "house_collection; SELECT * FROM gifts", sync: true },
      { channel: HOUSE_COLLECTION, sync: false },
      { channel: HOUSE_COLLECTION, sync: 1 },
      { channel: HOUSE_COLLECTION, action: { type: "create", payload: {} }, rpc: true },
      { channel: HOUSE_COLLECTION, sync: true, action: { type: "delete", payload: "home" } },
      { channel: HOUSE_COLLECTION, sync: true, rpc: true },
    ];
    for (const message of rejected) {
      const frame = typeof message === "object" && message !== null && !(message instanceof ArrayBuffer) && !(message instanceof Uint8Array) ? JSON.stringify(message) : message;
      expect(isPublicSyncRequest(frame)).toBe(false);
    }
  });
});
