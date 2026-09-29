import { describe, expect, test } from "bun:test";
import {
  DEFAULT_THINGS,
  PORTFOLIO_FOLDER,
  PORTFOLIO_FOLDER_OBJECT,
  WRITING_FOLDER_OBJECT,
  buildFolder,
  writingFolder,
  getDefaultOpenChildren,
  getInitialDefaultOpenThings,
  type ThingSpec,
  type WritingPost,
} from "./folders";

describe("House Folders and Things model", () => {
  test("DEFAULT_THINGS contains all 13 portfolio things with expected attributes", () => {
    expect(DEFAULT_THINGS.length).toBe(13);

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

    const desktopThings = DEFAULT_THINGS.filter((t) => t.desktop);
    expect(desktopThings.length).toBe(13);

    const folders = DEFAULT_THINGS.filter((t) => t.kind === "folder");
    expect(folders.length).toBe(2);
    for (const folder of folders) {
      expect(folder.tint_when_visited).toBe(false);
    }

    const actionThing = DEFAULT_THINGS.find((t) => t.id === "leave-gift");
    expect(actionThing?.kind).toBe("action");
    expect(actionThing?.action).toBe("leave-gift");
    expect(actionThing?.name).toBe("Paint");
    expect(actionThing?.emoji).toBe("🎨");
    expect(actionThing?.desktop).toBe(true);
  });

  test("PORTFOLIO_FOLDER contains Projects and Experience", () => {
    expect(PORTFOLIO_FOLDER.id).toBe("portfolio-folder");
    expect(PORTFOLIO_FOLDER.name).toBe("Portfolio");
    expect(PORTFOLIO_FOLDER.kind).toBe("folder");
    expect(PORTFOLIO_FOLDER.items.length).toBe(2);

    const [projects, experience] = PORTFOLIO_FOLDER.items;
    expect(projects.kind).toBe("item");
    expect(projects.name).toBe("Projects");
    expect(projects.id).toBe("computer");

    expect(experience.kind).toBe("item");
    expect(experience.name).toBe("Experience");
    expect(experience.id).toBe("case");
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

  test("ThingSpec supports page kind with rich text body in folders", () => {
    const pageThing: ThingSpec = {
      id: "about-page",
      name: "About Me",
      emoji: "📄",
      kind: "page",
      desktop: false,
      parent_id: "portfolio-folder",
      tint_when_visited: true,
      width: 60,
      height: 60,
      shape: "rectangle",
      anchor: false,
      sort_order: 3,
      body: [
        {
          _type: "block",
          style: "normal",
          children: [{ _type: "span", text: "Hello from the page body!" }],
        },
      ],
    };

    const folder = buildFolder(PORTFOLIO_FOLDER_OBJECT as ThingSpec, [PORTFOLIO_FOLDER_OBJECT as ThingSpec, pageThing]);
    expect(folder.items.length).toBe(1);
    const item = folder.items[0];
    expect(item.kind).toBe("item");
    expect(item.name).toBe("About Me");
    expect(item.emoji).toBe("📄");
    if (item.kind === "item") {
      const value = item.value as ThingSpec;
      expect(value.kind).toBe("page");
      expect(value.body).toBeDefined();
    }
  });

  test("getDefaultOpenChildren finds direct and recursive default_open children in folders", () => {
    const customThings: ThingSpec[] = [
      { id: "parent-folder", name: "Parent", emoji: "📁", kind: "folder", desktop: true, tint_when_visited: false, width: 64, height: 56, shape: "rectangle", anchor: false, sort_order: 1 },
      { id: "normal-child", name: "Normal", emoji: "📄", kind: "page", desktop: false, parent_id: "parent-folder", default_open: false, tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 1 },
      { id: "open-child", name: "Open Page", emoji: "📄", kind: "page", desktop: false, parent_id: "parent-folder", default_open: true, tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 2 },
      { id: "open-link", name: "Open Link", emoji: "🔗", kind: "link", desktop: false, parent_id: "parent-folder", href: "https://example.com", default_open: true, tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 3 },
      { id: "sub-folder", name: "Sub", emoji: "📁", kind: "folder", desktop: false, parent_id: "parent-folder", default_open: true, tint_when_visited: false, width: 64, height: 56, shape: "rectangle", anchor: false, sort_order: 4 },
      { id: "nested-child", name: "Nested Child", emoji: "⚙️", kind: "object", desktop: false, parent_id: "sub-folder", default_open: true, tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 1 },
    ];

    const children = getDefaultOpenChildren("parent-folder", customThings);
    expect(children.map((c) => c.id)).toEqual(["open-child", "sub-folder", "nested-child"]);
  });

  test("getInitialDefaultOpenThings selects top-level items and children of default-open folders", () => {
    const customThings: ThingSpec[] = [
      // Top-level page with default_open: true -> should open on page load
      { id: "top-page", name: "Top Page", emoji: "📄", kind: "page", desktop: true, parent_id: null, default_open: true, tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 1 },
      // Top-level object with default_open: false -> should not open
      { id: "closed-obj", name: "Closed Obj", emoji: "📦", kind: "object", desktop: true, parent_id: null, default_open: false, tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 2 },
      // Closed folder containing an open child -> neither folder nor child should open initially
      { id: "closed-folder", name: "Closed Folder", emoji: "📁", kind: "folder", desktop: true, parent_id: null, default_open: false, tint_when_visited: false, width: 64, height: 56, shape: "rectangle", anchor: false, sort_order: 3 },
      { id: "hidden-child", name: "Hidden Child", emoji: "📄", kind: "page", desktop: false, parent_id: "closed-folder", default_open: true, tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 1 },
      // Open folder containing an open child -> both folder and child should open initially
      { id: "open-folder", name: "Open Folder", emoji: "📁", kind: "folder", desktop: true, parent_id: null, default_open: true, tint_when_visited: false, width: 64, height: 56, shape: "rectangle", anchor: false, sort_order: 4 },
      { id: "visible-child", name: "Visible Child", emoji: "📄", kind: "page", desktop: false, parent_id: "open-folder", default_open: true, tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 1 },
      { id: "not-open-child", name: "Not Open Child", emoji: "📄", kind: "page", desktop: false, parent_id: "open-folder", default_open: false, tint_when_visited: true, width: 60, height: 60, shape: "rectangle", anchor: false, sort_order: 2 },
    ];

    const initial = getInitialDefaultOpenThings(customThings);
    expect(initial.map((item) => item.id)).toEqual(["top-page", "open-folder", "visible-child"]);

    // But opening the closed folder later DOES open its default_open child!
    const fromClosedFolder = getDefaultOpenChildren("closed-folder", customThings);
    expect(fromClosedFolder.map((c) => c.id)).toEqual(["hidden-child"]);
  });
});
