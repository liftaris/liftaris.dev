import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { visitorAuth, VISITOR_SESSION_SECONDS } from "./visitor-auth";

const databases: Database[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

test("anonymous bearer ownership survives return, stores animal identity, and uses the checked-in auth schema", async () => {
  const database = new Database(":memory:");
  databases.push(database);
  database.exec(await Bun.file(new URL("../../../migrations/visitor-auth/0001_visitor_auth.sql", import.meta.url)).text());
  // Better Auth supports Bun SQLite as well as the production D1 binding.
  const auth = visitorAuth({ VISITOR_DB: database, VISITOR_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID() } as unknown as Env, "https://portfolio.test");
  const response = await auth.handler(new Request("https://portfolio.test/api/visitors/sign-in/anonymous", {
    method: "POST", headers: { Origin: "https://portfolio.test", "Content-Type": "application/json", "cf-connecting-ip": "192.0.2.1" },
  }));
  expect(response.status).toBe(200);
  const created = await response.json() as { token: string; user: { id: string; name: string; isAnonymous: boolean } };
  expect(created.user.isAnonymous).toBe(true);
  expect(created.user.name).not.toBe("Anonymous");
  const headers = new Headers({ Authorization: `Bearer ${created.token}` });
  const session = await auth.api.getSession({ headers });
  expect(session?.user.id).toBe(created.user.id);
  expect(session!.session.expiresAt.getTime() - Date.now()).toBeGreaterThan(99 * 365 * 24 * 60 * 60 * 1_000);
  expect(VISITOR_SESSION_SECONDS).toBeGreaterThan(99 * 365 * 24 * 60 * 60);
  database.query("UPDATE visitor_session SET expiresAt = ? WHERE userId = ?").run(new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(), created.user.id);
  const renewed = await auth.api.getSession({ headers });
  expect(renewed?.user.id).toBe(created.user.id);
  expect(renewed!.session.expiresAt.getTime() - Date.now()).toBeGreaterThan(99 * 365 * 24 * 60 * 60 * 1_000);
  expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
  expect(await auth.api.getSession({ headers: new Headers({ Authorization: "Bearer guessed-token" }) })).toBeNull();
});
