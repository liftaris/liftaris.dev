import { FIELD_TYPE_TO_COLUMN, OptionsRepository, SchemaError, SchemaRegistry, type CreateFieldInput, type Database } from "emdash";
import { sql, type Kysely } from "kysely";

const giftSchemaVersion = 2;

const giftFields: readonly CreateFieldInput[] = [
  { slug: "emoji_id", label: "Object", type: "string", required: true, searchable: false },
  { slug: "author_name", label: "From", type: "string", required: true, searchable: false },
  { slug: "message", label: "Message", type: "text", searchable: false },
  { slug: "visibility", label: "Message visibility", type: "select", required: true, validation: { options: ["public", "private"] }, searchable: false },
  { slug: "submission_hash", label: "Submission fingerprint", type: "string", searchable: false },
];

export async function initializeGiftCollection(db: Kysely<Database>): Promise<void> {
  const options = new OptionsRepository(db);
  if (await options.get("house:gift-schema") === giftSchemaVersion) return;
  const schema = new SchemaRegistry(db);
  // D1 can persist the registration before field metadata. Re-enter EmDash's
  // resumable seed path even when the collection already exists; createField
  // would incorrectly try to add columns that the bulk seed already created.
  try {
    await schema.createSeedCollection({ slug: "gifts", label: "Gifts", labelSingular: "Gift", supports: [], routable: false, commentsEnabled: false }, giftFields);
  } catch (error) {
    if (!(error instanceof SchemaError) || error.code !== "COLLECTION_EXISTS") throw error;
    const collection = await schema.getCollectionWithFields("gifts");
    if (!collection) throw error;
    const missing = giftFields.filter((field) => !collection.fields.some((stored) => stored.slug === field.slug));
    if (missing.length) {
      // Before media capture activation, EmDash has no resumable seed cursor.
      // Recover only our seed-owned metadata over the already-created columns;
      // never ALTER existing columns or overwrite an administrator's fields.
      const activation = await db.selectFrom("_emdash_media_usage_activation").select("state")
        .where("task_key", "=", "incremental_capture").executeTakeFirst();
      if (collection.source !== "seed" || activation?.state !== "expanded") throw error;
      await assertGiftColumns(db);
      await db.insertInto("_emdash_fields").values(missing.map((field) => ({
        id: crypto.randomUUID(), collection_id: collection.id, slug: field.slug, label: field.label,
        type: field.type, column_type: FIELD_TYPE_TO_COLUMN[field.type], required: field.required ? 1 : 0,
        unique: 0, default_value: null, validation: field.validation ? JSON.stringify(field.validation) : null,
        widget: null, options: null, sort_order: giftFields.indexOf(field), searchable: 0, indexed: 0, translatable: 1,
      }))).onConflict((conflict) => conflict.columns(["collection_id", "slug"]).doNothing()).execute();
    }
  }
  const collection = await schema.getCollectionWithFields("gifts");
  if (!collection || collection.supports.length !== 0 || collection.routable || collection.commentsEnabled
    || !giftFields.every((expected) => collection.fields.some((field) =>
      field.slug === expected.slug && field.type === expected.type
      && field.columnType === FIELD_TYPE_TO_COLUMN[expected.type]
      && field.required === Boolean(expected.required) && !field.searchable
      && (!expected.validation || JSON.stringify(field.validation?.options) === JSON.stringify(expected.validation.options))))) {
    throw new SchemaError("Gift collection schema is incomplete or incompatible", "CREATE_FAILED");
  }
  await assertGiftColumns(db);
  await sql`CREATE TABLE IF NOT EXISTS house_gift_receipts (
    id TEXT PRIMARY KEY, author_id TEXT NOT NULL, fingerprint TEXT NOT NULL
  )`.execute(db);
  // The receipt and content insert share one SQLite statement, including on D1.
  // A receipt survives CMS trash/permanent deletion without retaining the message.
  await sql`CREATE TRIGGER IF NOT EXISTS house_gift_receipt
    BEFORE INSERT ON ec_gifts WHEN NEW.submission_hash IS NOT NULL
    BEGIN
      SELECT CASE WHEN EXISTS (SELECT 1 FROM house_gift_receipts WHERE id = NEW.id)
        THEN RAISE(ABORT, 'gift_already_submitted') END;
      INSERT INTO house_gift_receipts (id, author_id, fingerprint) VALUES (NEW.id, NEW.author_id, NEW.submission_hash);
    END`.execute(db);
  await options.set("house:gift-schema", giftSchemaVersion);
}

async function assertGiftColumns(db: Kysely<Database>): Promise<void> {
  const { rows: columns } = await sql<{ name: string; type: string; notnull: number }>`PRAGMA table_info(ec_gifts)`.execute(db);
  if (!giftFields.every((field) => columns.some((column) => column.name === field.slug
    && column.type.toLowerCase() === FIELD_TYPE_TO_COLUMN[field.type].toLowerCase()
    && column.notnull === (field.required ? 1 : 0)))) {
    throw new SchemaError("Gift collection columns are incomplete or incompatible", "CREATE_FAILED");
  }
}

export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
