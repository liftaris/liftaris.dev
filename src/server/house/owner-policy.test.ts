import { expect, test } from "bun:test";
import { isHouseOwner } from "./owner-policy";

test("owner access fails closed until a specific verified CMS identity matches", () => {
  expect(isHouseOwner(undefined, "cms-owner")).toBe(false);
  expect(isHouseOwner("", "cms-owner")).toBe(false);
  expect(isHouseOwner("cms-owner", undefined)).toBe(false);
  expect(isHouseOwner("cms-owner", "different-cms-admin")).toBe(false);
  expect(isHouseOwner("cms-owner", "visitor-identity")).toBe(false);
  expect(isHouseOwner("cms-owner", "cms-owner")).toBe(true);
});
