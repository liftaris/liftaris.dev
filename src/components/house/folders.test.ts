import { describe, expect, test } from "bun:test";
import {
  DEFAULT_THINGS,
  PORTFOLIO_FOLDER,
  PORTFOLIO_FOLDER_OBJECT,
  WRITING_FOLDER_OBJECT,
  buildFolder,
  writingFolder,
  type ThingSpec,
  type WritingPost,
} from "./folders";

describe("House Folders and Things model", () => {
  test("DEFAULT_THINGS contains all 15 portfolio things with expected attributes", () => {
    expect(DEFAULT_THINGS.length).toBe(15);

    const ids = DEFAULT_THINGS.map((t) => t.id);
    expect(ids).toContain("octopus");
    expect(ids).toContain("computer");
    expect(ids).toContain("shoes");
    expect(ids).toContain("globe");
    expect(ids).toContain("plant");
    expect(ids).toContain("cloud");
    expect(ids).toContain("bike");
    expect(ids).toContain("boots");
    expect(ids).toContain("light");
    expect(ids).toContain("case");
    expect(ids).toContain("leave-gift");
    expect(ids).toContain("portfolio-folder");
    expect(ids).toContain("writing-folder");
    expect(ids).toContain("lab-folder");
    expect(ids).toContain("clump-lab");

    const desktopThings = DEFAULT_THINGS.filter((t) => t.desktop);
    expect(desktopThings.length).toBe(13);
    expect(desktopThings.map((t) => t.id)).not.toContain("lab-folder");
    expect(desktopThings.map((t) => t.id)).not.toContain("clump-lab");

    const folders = DEFAULT_THINGS.filter((t) => t.kind === "folder");
    expect(folders.length).toBe(3);
    for (const folder of folders) {
      expect(folder.tint_when_visited).toBe(false);
    }

    const labLink = DEFAULT_THINGS.find((t) => t.id === "clump-lab");
    expect(labLink?.kind).toBe("link");
    expect(labLink?.parent_id).toBe("lab-folder");
    expect(labLink?.href).toBe("/lab/clump");
    expect(labLink?.tint_when_visited).toBe(true);

    const actionThing = DEFAULT_THINGS.find((t) => t.id === "leave-gift");
    expect(actionThing?.kind).toBe("action");
    expect(actionThing?.action).toBe("leave-gift");
    expect(actionThing?.desktop).toBe(true);
  });

  test("PORTFOLIO_FOLDER contains Projects, Experience, and nested Lab folder", () => {
    expect(PORTFOLIO_FOLDER.id).toBe("portfolio-folder");
    expect(PORTFOLIO_FOLDER.name).toBe("Portfolio");
    expect(PORTFOLIO_FOLDER.kind).toBe("folder");
    expect(PORTFOLIO_FOLDER.items.length).toBe(3);

    const [projects, experience, lab] = PORTFOLIO_FOLDER.items;
    expect(projects.kind).toBe("item");
    expect(projects.name).toBe("Projects");
    expect(projects.id).toBe("computer");

    expect(experience.kind).toBe("item");
    expect(experience.name).toBe("Experience");
    expect(experience.id).toBe("case");

    expect(lab.kind).toBe("folder");
    expect(lab.name).toBe("Lab");
    expect(lab.id).toBe("lab-folder");
    if (lab.kind === "folder") {
      expect(lab.items.length).toBe(1);
      expect(lab.items[0].kind).toBe("link");
      expect(lab.items[0].name).toBe("A place for my things");
      if (lab.items[0].kind === "link") {
        expect(lab.items[0].href).toBe("/lab/clump");
      }
    }
  });

  test("writingFolder dynamically populates posts", () => {
    const posts: WritingPost[] = [
      { id: "post-1", slug: "first-post", title: "First Post", icon: "📝" },
      { id: "post-2", slug: "second-post", title: "Second Post", icon: "✨" },
    ];
    const folder = writingFolder(posts);
    expect(folder.id).toBe("writing-folder");
    expect(folder.name).toBe("Writing");
    expect(folder.items.length).toBe(2);

    expect(folder.items[0].id).toBe("post:post-1");
    expect(folder.items[0].name).toBe("First Post");
    expect(folder.items[0].emoji).toBe("📝");

    expect(folder.items[1].id).toBe("post:post-2");
    expect(folder.items[1].name).toBe("Second Post");
    expect(folder.items[1].emoji).toBe("✨");
  });

  test("buildFolder dynamically supports arbitrary nested subfolders and custom items", () => {
    const customThings: ThingSpec[] = [
      { id: "main-folder", name: "Main", emoji: "📁", kind: "folder", desktop: true, tint_when_visited: false, width: 64, height: 56, shape: "rectangle", anchor: false, sort_order: 1 },
      { id: "sub-folder", name: "Sub", emoji: "📁", kind: "folder", desktop: false, parent_id: "main-folder", tint_when_visited: false, width: 64, height: 56, shape: "rectangle", anchor: false, sort_order: 1 },
      { id: "custom-link", name: "GitHub", emoji: "🐙", kind: "link", desktop: false, parent_id: "sub-folder", href: "https://github.com", tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 1 },
      { id: "custom-obj", name: "Widget", emoji: "⚙️", kind: "object", desktop: false, parent_id: "main-folder", tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 2 },
    ];

    const main = buildFolder(customThings[0], customThings);
    expect(main.items.length).toBe(2);

    const sub = main.items[0];
    expect(sub.kind).toBe("folder");
    expect(sub.name).toBe("Sub");
    if (sub.kind === "folder") {
      expect(sub.items.length).toBe(1);
      expect(sub.items[0].kind).toBe("link");
      expect(sub.items[0].name).toBe("GitHub");
    }

    const widget = main.items[1];
    expect(widget.kind).toBe("item");
    expect(widget.name).toBe("Widget");
  });

  test("WRITING_FOLDER_OBJECT and PORTFOLIO_FOLDER_OBJECT have consistent geometry", () => {
    expect(WRITING_FOLDER_OBJECT.id).toBe("writing-folder");
    expect(WRITING_FOLDER_OBJECT.width).toBe(64);
    expect(WRITING_FOLDER_OBJECT.height).toBe(56);
    expect(WRITING_FOLDER_OBJECT.shape).toBe("rectangle");

    expect(PORTFOLIO_FOLDER_OBJECT.id).toBe("portfolio-folder");
    expect(PORTFOLIO_FOLDER_OBJECT.width).toBe(64);
    expect(PORTFOLIO_FOLDER_OBJECT.height).toBe(56);
    expect(PORTFOLIO_FOLDER_OBJECT.shape).toBe("rectangle");
  });
});
