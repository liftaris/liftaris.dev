import { afterEach, expect, test } from "bun:test";
import type { APIContext } from "astro";
import type { CreatedGift } from "../../lib/house/types";
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

test("HTTP gift endpoints use native sessions and enforce ownership and privacy", async () => {
  const { sender, other, request } = await fixture();
  const created = await request("POST", sender.id, input);
  expect(created.status).toBe(200);
  expect(created.headers.get("Cache-Control")).toContain("no-store");
  const result = await created.json() as CreatedGift;
  expect(JSON.stringify(result)).not.toContain(input.message);
  const id = result.createdGiftId!;
  expect(id).toBeString();
  expect(await (await request("GET", sender.id, undefined, id)).json()).toMatchObject({ message: input.message });
  expect(await (await request("GET", other.id, undefined, id)).json()).toMatchObject({ message: null });
  expect((await request("PATCH", other.id, input, id)).status).toBe(403);
  expect((await request("PATCH", sender.id, { ...input, message: "Edited" }, id)).status).toBe(200);
  expect((await request("DELETE", other.id, undefined, id)).status).toBe(403);
  expect((await request("DELETE", sender.id, undefined, id)).status).toBe(200);
  expect((await request("GET", sender.id, undefined, id)).status).toBe(404);
});

test("HTTP gift mutations reject cookie-free, cross-origin, non-JSON and oversized requests", async () => {
  const { sender, request } = await fixture();
  expect((await request("POST", null, input)).status).toBe(401);
  expect((await request("POST", sender.id, input, undefined, { Origin: "https://other.test" })).status).toBe(403);
  expect((await request("POST", sender.id, input, undefined, { "Content-Type": "text/plain" })).status).toBe(415);
  expect((await request("POST", sender.id, { ...input, message: "x".repeat(20000) })).status).toBe(413);
  expect((await request("POST", sender.id, { ...input, emojiId: "invalid" })).status).toBe(400);
});
