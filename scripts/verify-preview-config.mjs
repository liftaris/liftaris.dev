import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(
  process.argv[2] ?? new URL("../dist/server/wrangler.json", import.meta.url),
  "utf8",
));
const preview = config.previews;
assert.ok(preview, "Built Worker must declare a previews configuration");

function resource(group, binding, identifier, pattern, shared = false) {
  const entry = preview[group]?.find((item) => item.binding === binding);
  assert.ok(entry, `Preview is missing ${binding}`);
  assert.match(entry[identifier] ?? "", pattern, `Preview ${binding} needs a real ${identifier}`);
  const production = config[group]?.find((item) => item.binding === binding);
  assert.ok(production, `Production is missing ${binding}`);
  assert.match(production[identifier] ?? "", pattern, `Production ${binding} needs a real ${identifier}`);
  if (shared) {
    assert.equal(entry[identifier], production[identifier], `Preview ${binding} must share production CMS storage`);
  } else {
    assert.ok(
      !(config[group] ?? []).some((item) => item[identifier] === entry[identifier]),
      `Preview ${binding} must not use production storage`,
    );
  }
  return entry;
}

resource("kv_namespaces", "SESSION", "id", /^[a-f0-9]{32}$/i);
const databaseId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
resource("d1_databases", "DB", "database_id", databaseId, true);
resource("r2_buckets", "MEDIA", "bucket_name", /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, true);

for (const [label, target] of [["Production", config], ["Preview", preview]]) {
  assert.deepEqual(
    target.d1_databases?.map((item) => item.binding),
    ["DB"],
    `${label} must use only the native CMS database, not a visitor database`,
  );
  assert.deepEqual(target.durable_objects?.bindings ?? [], [], `${label} must not bind a gift Durable Object`);
  assert.equal(typeof target.vars?.HOUSE_OWNER_ID, "string", `${label} must explicitly configure moderation`);
  for (const name of ["VISITOR_DB", "VISITOR_AUTH_SECRET", "HOUSE"]) {
    assert.equal(target.vars?.[name], undefined, `${label} must not configure legacy ${name}`);
    assert.ok(!target.secrets?.required?.includes(name), `${label} must not require legacy ${name}`);
    assert.ok(!target.unsafe?.bindings?.some((binding) => binding.name === name), `${label} must not inherit legacy ${name}`);
  }
  assert.ok(
    !(target.migrations ?? []).some((migration) => migration.deleted_classes?.length),
    `${label} must not delete legacy Durable Object data`,
  );
}
assert.deepEqual(
  config.migrations?.find((migration) => migration.tag === "house-v1"),
  { tag: "house-v1", new_sqlite_classes: ["House"] },
  "Preserve the historical House namespace until legacy data retirement is approved",
);
for (const name of ["EMDASH_SETUP_KEY", "JEV_API_KEY"]) {
  assert.ok(config.secrets?.required?.includes(name), `Worker must declare required secret ${name}`);
  assert.equal(config.vars?.[name], undefined, `${name} must not be stored in plaintext vars`);
  assert.equal(preview.vars?.[name], undefined, `${name} must not be stored in plaintext vars`);
  assert.deepEqual(
    preview.unsafe?.bindings?.find((binding) => binding.name === name),
    { name, type: "inherit" },
    `Preview must preserve server-side ${name} across deployments without embedding its value`,
  );
}
assert.equal(preview.routes, undefined, "Preview must not claim production routes");
assert.equal(preview.triggers, undefined, "Preview must not configure production cron triggers");
console.log("PASS preview shares CMS/media, isolates sessions, preserves secret inheritance and class history, and has no visitor/House runtime bindings");
