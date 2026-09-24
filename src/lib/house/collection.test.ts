import { describe, expect, test } from "bun:test";
import { collectionRecord, collectionSnapshot } from "./collection";
import type { HouseSnapshot } from "./types";

describe("house collection record", () => {
  test("stable row replacement removes gifts missed while offline, including the last gift", () => {
    const cached: HouseSnapshot = { revision: 1, gifts: [{
      id: "gift-1", emojiId: "popcorn", authorName: "A friend", createdAt: "2026-09-24", visibility: "private", message: null,
    }] };
    const records = [collectionRecord(cached)];
    const current: HouseSnapshot = { revision: 2, gifts: [] };
    // partysync merges by record[0], so the collection record replaces, not appends.
    const update = collectionRecord(current);
    records.splice(records.findIndex((record) => record[0] === update[0]), 1, update);
    expect(records).toHaveLength(1);
    expect(collectionSnapshot(records[0])).toEqual(current);
    expect(collectionSnapshot(collectionRecord(cached))).toEqual(cached);
  });

  test("malformed caches, mismatched revisions and tombstones are ignored", () => {
    for (const record of [undefined, [], ["home", "{", 0, 0, null],
      ["other", '{"revision":0,"gifts":[]}', 0, 0, null],
      ["home", '{"revision":1,"gifts":[]}', 0, 0, null],
      ["home", '{"revision":-1,"gifts":[]}', 0, -1, null],
      ["home", '{"revision":0,"gifts":[]}', 0, 0, 1],
      ["home", '{"revision":0,"gifts":[{}]}', 0, 0, null],
    ]) expect(collectionSnapshot(record)).toBeUndefined();
  });
});
