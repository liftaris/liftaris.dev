import { describe, expect, test } from "bun:test";
import { PROJECTS } from "./portfolio";

describe("project catalog", () => {
  test("is one ordered source of visible projects", () => {
    expect(PROJECTS.map((project) => project.slug)).toEqual(["herm", "bazaarghost"]);
  });

  test("gives every project one primary link", () => {
    for (const project of PROJECTS) {
      expect(project.links.filter((link) => link.primary)).toHaveLength(1);
    }
  });
});
