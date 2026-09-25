import { Kysely, SqliteDialect } from "kysely";
import { Database as SqliteDatabase } from "bun:sqlite";
import { runMigrations } from "emdash/db";
import { UserRepository, type Database } from "emdash";

export async function cmsTestDb() {
  const sqlite = new SqliteDatabase(":memory:");
  const db = new Kysely<Database>({ dialect: new SqliteDialect({ database: {
    close: () => sqlite.close(),
    prepare(query) {
      const statement = sqlite.query(query);
      return {
        reader: statement.columnNames.length > 0,
        all: (parameters) => statement.all(...parameters as (string | number | null)[]),
        run: (parameters) => statement.run(...parameters as (string | number | null)[]),
        iterate: (parameters) => statement.iterate(...parameters as (string | number | null)[]),
      };
    },
  } }) });
  await runMigrations(db);
  const users = new UserRepository(db);
  const sender = await users.create({ email: "sender@visitors.invalid", name: "Capybara", role: "subscriber", data: { anonymous: true } });
  const other = await users.create({ email: "other@visitors.invalid", name: "Otter", role: "subscriber", data: { anonymous: true } });
  const owner = await users.create({ email: "owner@example.invalid", name: "Kaio", role: "admin" });
  return { db, sender, other, owner };
}
