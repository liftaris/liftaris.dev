import { FIELD_TYPE_TO_COLUMN, OptionsRepository, SchemaError, SchemaRegistry, type CreateFieldInput, type Database } from "emdash";
import { sql, type Kysely } from "kysely";
import { DEFAULT_THINGS } from "../../components/house/folders";

const giftSchemaVersion = 2;
const thingsSchemaVersion = 3;

export const thingFields: readonly CreateFieldInput[] = [
  { slug: "name", label: "Name", type: "string", required: true, searchable: true },
  { slug: "emoji", label: "Icon (Emoji)", type: "string", required: false, defaultValue: "📦" },
  { slug: "image", label: "Icon Image / GIF", type: "image", required: false, searchable: false },
  { slug: "kind", label: "Kind", type: "select", defaultValue: "object", validation: { options: ["object", "folder", "link", "action"] }, searchable: true },
  { slug: "desktop", label: "Show on desktop", type: "boolean", defaultValue: false, searchable: false },
  { slug: "parent_id", label: "Parent folder", type: "string", searchable: false },
  { slug: "action", label: "Action", type: "select", defaultValue: "none", validation: { options: ["none", "projects", "experience", "leave-gift"] }, searchable: false },
  { slug: "href", label: "Link URL", type: "string", searchable: false },
  { slug: "tint_when_visited", label: "Tint when visited", type: "boolean", required: false, defaultValue: true },
  { slug: "shape", label: "Shape", type: "select", defaultValue: "rectangle", validation: { options: ["circle", "rectangle"] }, searchable: false },
  { slug: "anchor", label: "Anchor", type: "boolean", defaultValue: false, searchable: false },
  { slug: "width", label: "Width", type: "integer", defaultValue: 60, searchable: false },
  { slug: "height", label: "Height", type: "integer", defaultValue: 60, searchable: false },
  { slug: "sort_order", label: "Sort order", type: "integer", defaultValue: 0, searchable: false },
];

export async function initializeThingsCollection(db: Kysely<Database>): Promise<void> {
  const options = new OptionsRepository(db);
  if (await options.get("house:things-schema") === thingsSchemaVersion) return;
  const schema = new SchemaRegistry(db);
  const existing = await schema.getCollection("things");
  if (!existing) {
    try {
      await schema.createSeedCollection({
        slug: "things",
        label: "Things",
        labelSingular: "Thing",
        supports: ["drafts", "search"],
        routable: false,
        commentsEnabled: false,
      }, thingFields);
    } catch (error) {
      if (!(error instanceof SchemaError) || error.code !== "COLLECTION_EXISTS") throw error;
    }
  } else {
    const collection = await schema.getCollectionWithFields("things");
    if (collection) {
      const missing = thingFields.filter((field) => !collection.fields.some((stored) => stored.slug === field.slug));
      if (missing.length > 0) {
        await assertThingColumns(db, missing);
        await db.insertInto("_emdash_fields").values(missing.map((field) => ({
          id: crypto.randomUUID(), collection_id: collection.id, slug: field.slug, label: field.label,
          type: field.type, column_type: FIELD_TYPE_TO_COLUMN[field.type], required: field.required ? 1 : 0,
          unique: 0, default_value: field.defaultValue !== undefined ? JSON.stringify(field.defaultValue) : null,
          validation: field.validation ? JSON.stringify(field.validation) : null,
          widget: null, options: null, sort_order: thingFields.indexOf(field), searchable: field.searchable ? 1 : 0, indexed: 0, translatable: 1,
        }))).onConflict((conflict) => conflict.columns(["collection_id", "slug"]).doNothing()).execute();
      }
    }
  }
  try {
    await sql`UPDATE _emdash_collections SET admin_config = ${JSON.stringify({ listColumns: ["name", "emoji", "kind", "tint_when_visited"] })} WHERE slug = 'things'`.execute(db);
  } catch {
    // Ignore if table doesn't exist
  }
  try {
    await assertThingColumns(db, thingFields);
    const user = await db.selectFrom("users").select("id").limit(1).executeTakeFirst();
    const authorId = user?.id ?? null;
    const now = new Date().toISOString();
    for (const item of DEFAULT_THINGS) {
      const exists = await sql<{ id: string }>`SELECT id FROM ec_things WHERE id = ${item.id}`.execute(db);
      if (exists.rows.length === 0) {
        await sql`INSERT INTO ec_things (
          id, slug, status, author_id, created_at, updated_at, published_at, version, locale, translation_group,
          name, emoji, image, kind, desktop, parent_id, action, href, tint_when_visited, shape, anchor, width, height, sort_order
        ) VALUES (
          ${item.id}, ${item.id}, 'published', ${authorId}, ${now}, ${now}, ${now}, 1, 'en', ${item.id},
          ${item.name}, ${item.emoji}, ${item.image ?? null}, ${item.kind}, ${item.desktop ? 1 : 0}, ${item.parent_id ?? null}, ${item.action ?? "none"}, ${item.href ?? null},
          ${item.tint_when_visited ? 1 : 0}, ${item.shape}, ${item.anchor ? 1 : 0}, ${item.width}, ${item.height}, ${item.sort_order}
        )`.execute(db);
      } else {
        await sql`UPDATE ec_things SET
          kind = COALESCE(kind, ${item.kind}),
          desktop = COALESCE(desktop, ${item.desktop ? 1 : 0}),
          parent_id = COALESCE(parent_id, ${item.parent_id ?? null}),
          action = COALESCE(action, ${item.action ?? "none"}),
          href = COALESCE(href, ${item.href ?? null}),
          sort_order = COALESCE(sort_order, ${item.sort_order})
          WHERE id = ${item.id}`.execute(db);
      }
    }
  } catch {
    // If ec_things table doesn't exist yet, ignore
  }
  await options.set("house:things-schema", thingsSchemaVersion);
}

async function assertThingColumns(db: Kysely<Database>, fields: readonly CreateFieldInput[]): Promise<void> {
  try {
    const { rows: columns } = await sql<{ name: string; type: string; notnull: number }>`PRAGMA table_info(ec_things)`.execute(db);
    for (const field of fields) {
      if (!columns.some((c) => c.name === field.slug)) {
        const colType = FIELD_TYPE_TO_COLUMN[field.type];
        await sql.raw(`ALTER TABLE ec_things ADD COLUMN ${field.slug} ${colType}`).execute(db);
      }
    }
  } catch {
    // Ignore if table does not exist
  }
}

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
