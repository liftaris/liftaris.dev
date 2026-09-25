// Test-only Worker. Never deploy: viewer selection and CMS access are fixture controls.
import { createDialect } from "@emdash-cms/cloudflare/db/d1";
import { ContentRepository, SchemaRegistry, UserRepository, type Database } from "emdash";
import { MIGRATION_NAMES, getExactMigrationStatus, runMigrations } from "emdash/db";
import { Kysely } from "kysely";
import { CmsHouseStore } from "../../src/server/house/cms-store";
import { takeQuota } from "../../src/server/house/rate-limit";
import type { Viewer } from "../../src/lib/house/types";

const db = new Kysely<Database>({ dialect: createDialect({ binding: "TEST_DB", session: "disabled" }) });
const content = new ContentRepository(db);
let store = new CmsHouseStore(db);
const viewers: Record<string, Viewer> = { stranger: { visitor: null, owner: false } };
// Inputs are supplied only by verify-house-worker.mjs, never public HTTP callers.
type FixtureInput = {
  viewer?: string;
  gift: unknown;
  id: string;
  change: Parameters<ContentRepository["update"]>[2];
  key: string;
  maximum: number;
  windowSeconds?: number;
  now?: number;
};

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method !== "POST") return new Response("POST required", { status: 405 });
      const path = new URL(request.url).pathname;
      const input = await request.json() as FixtureInput;
      const viewer = viewers[input.viewer ?? "sender"];
      let value: unknown;
      switch (path) {
        case "/initialize": {
          const migrations = await runMigrations(db);
          const repeat = await runMigrations(db);
          await store.initialize();
          await store.initialize();
          const users = new UserRepository(db);
          const seeded = [];
          for (const [key, name, owner] of [
            ["sender", "Capybara", false], ["other", "Otter", false],
            ["quota", "Fox", false], ["owner", "Kaio", true],
          ] as const) {
            const user = await users.create({
              email: `${key}@house-test.invalid`, name, role: owner ? "admin" : "subscriber",
              data: { anonymous: !owner },
            });
            viewers[key] = { visitor: { id: user.id, name }, owner };
            seeded.push({ key, ...user });
          }
          const schema = new SchemaRegistry(db);
          const collection = await schema.getCollection("gifts");
          value = { migrations, repeat, expectedMigrations: MIGRATION_NAMES,
            migrationStatus: await getExactMigrationStatus(db), users: seeded, collection,
            fields: await schema.listFields(collection!.id) };
          break;
        }
        case "/snapshot": value = await store.snapshot(); break;
        case "/create": value = await store.create(input.gift, viewer); break;
        case "/update": value = await store.update(input.id, input.gift, viewer); break;
        case "/remove": value = await store.remove(input.id, viewer); break;
        case "/detail": value = await store.detail(input.id, viewer); break;
        case "/cms-record": value = await content.findByIdIncludingTrashed("gifts", input.id); break;
        case "/cms-update": value = await content.update("gifts", input.id, input.change); break;
        case "/cms-permanent-delete": value = await content.permanentDelete("gifts", input.id); break;
        case "/restart":
          store = new CmsHouseStore(db);
          await store.initialize();
          value = await store.snapshot();
          break;
        case "/quota": value = await takeQuota(db, input.key, input.maximum, input.windowSeconds, input.now); break;
        default: return new Response("Unknown test operation", { status: 404 });
      }
      return Response.json({ ok: true, value });
    } catch (error) {
      const failure = error as { status?: number; message?: string; stack?: string };
      const status = failure.status ?? 500;
      return Response.json({ ok: false, error: failure.message, ...(status === 500 ? { stack: failure.stack } : {}) }, { status });
    }
  },
};
