import { afterEach, expect, test } from "bun:test";
import type { APIContext } from "astro";
import type { CreatedGift, GiftDetail } from "../../lib/house/types";
import { cmsTestDb } from "./cms-test-db";
import { houseResponse } from "./http";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanups.splice(0)) await close(); });
const input = { requestId: "test", emojiId: "seedling", message: "Only the sender and owner", visibility: "private" };

async function fixture() {
  const { db, sender, other } = await cmsTestDb();
  cleanups.push(() => db.destroy());
  const request = (method: string, actor: string | null, body?: unknown, id?: string, headers: Record<string, string> = {}) => {
    const url = new URL(`https://portfolio.test/api/house${id ? `/gifts/${id}` : ""}`);
    return houseResponse({
      request: new Request(url, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { Origin: url.origin, "Content-Type": "application/json", ...headers } }),
      url, params: { id }, locals: { emdash: { db } },
      session: { get: async () => actor ? { id: actor } : undefined }, cache: { set() {} },
    } as unknown as APIContext, undefined);
  };
  return { sender, other, request };
}

test("HTTP resolves the native session, validates edit versions and returns uncached 409 conflicts", async () => {
  const { sender, other, request } = await fixture();
  const created = await request("POST", sender.id, input);
  expect(created.status).toBe(200);
  expect(created.headers.get("Cache-Control")).toContain("no-store");
  const id = (await created.json() as CreatedGift).createdGiftId!;
  const { version } = await (await request("GET", sender.id, undefined, id)).json() as GiftDetail;
  expect((await request("PATCH", other.id, { ...input, version }, id)).status).toBe(403);
  for (const invalid of [undefined, null, "1", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    expect((await request("PATCH", sender.id, { ...input, version: invalid }, id)).status).toBe(400);
  }
  expect((await request("PATCH", sender.id, { ...input, version, message: "Edited" }, id)).status).toBe(200);
  const conflict = await request("PATCH", sender.id, { ...input, version, visibility: "public" }, id);
  expect(conflict.status).toBe(409);
  expect(conflict.headers.get("Cache-Control")).toContain("no-store");
  expect(conflict.headers.get("Vary")).toContain("Cookie");
  expect(await conflict.json()).toMatchObject({ error: expect.stringContaining("Reload") });
});

test("HTTP mutations enforce same-origin JSON, body limits and gift validation", async () => {
  const { sender, request } = await fixture();
  expect((await request("POST", null, input)).status).toBe(401);
  expect((await request("POST", sender.id, input, undefined, { Origin: "https://other.test" })).status).toBe(403);
  expect((await request("POST", sender.id, input, undefined, { "Content-Type": "text/plain" })).status).toBe(415);
  expect((await request("POST", sender.id, { ...input, message: "x".repeat(20000) })).status).toBe(413);
  for (const invalid of [{ emojiId: "invalid" }, { message: "x".repeat(2001) }, { displayName: "x".repeat(61) }, { requestId: "bad/id" }]) {
    expect((await request("POST", sender.id, { ...input, ...invalid })).status).toBe(400);
  }
});
