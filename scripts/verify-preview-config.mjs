import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(
  process.argv[2] ?? new URL("../dist/server/wrangler.json", import.meta.url),
  "utf8",
));
const preview = config.previews;
assert.ok(preview, "Built Worker must declare a previews configuration");

function resource(group, binding, identifier, pattern) {
  const entry = preview[group]?.find((item) => item.binding === binding);
  assert.ok(entry, `Preview is missing ${binding}`);
  assert.match(entry[identifier] ?? "", pattern, `Preview ${binding} needs a real ${identifier}`);
  assert.ok(
    !(config[group] ?? []).some((item) => item[identifier] === entry[identifier]),
    `Preview ${binding} must not use production storage`,
  );
  return entry;
}

resource("kv_namespaces", "SESSION", "id", /^[a-f0-9]{32}$/i);
const databaseId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const cms = resource("d1_databases", "DB", "database_id", databaseId);
const visitors = resource("d1_databases", "VISITOR_DB", "database_id", databaseId);
assert.notEqual(cms.database_id, visitors.database_id, "CMS and visitor databases must be separate");
resource("r2_buckets", "MEDIA", "bucket_name", /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/);

const house = preview.durable_objects?.bindings?.find((item) => item.name === "HOUSE");
assert.equal(house?.class_name, "House", "Preview must bind its House Durable Object");
assert.equal(house.script_name, undefined, "Preview House must not target another Worker");
assert.equal(typeof preview.vars?.HOUSE_OWNER_ID, "string", "Preview must explicitly configure moderation");
const migrations = JSON.parse(readFileSync(new URL("../wrangler.preview-migrations.json", import.meta.url), "utf8"));
assert.equal(
  migrations.d1_databases.find((item) => item.binding === "VISITOR_DB")?.database_id,
  visitors.database_id,
  "Visitor migrations must target the same database as the preview",
);
for (const name of ["EMDASH_SETUP_KEY", "VISITOR_AUTH_SECRET", "JEV_API_KEY"]) {
  assert.ok(config.secrets?.required?.includes(name), `Worker must declare required secret ${name}`);
  assert.equal(preview.vars?.[name], undefined, `${name} must not be stored in plaintext vars`);
  assert.deepEqual(
    preview.unsafe?.bindings?.find((binding) => binding.name === name),
    { name, type: "inherit" },
    `Preview must preserve server-side ${name} across deployments without embedding its value`,
  );
}
assert.equal(preview.routes, undefined, "Preview must not claim production routes");
assert.equal(preview.triggers, undefined, "Preview must not configure production cron triggers");
console.log("PASS built preview bindings are complete and isolated from production");
