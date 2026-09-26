import type { FolderSpec } from "../folder/Folder";
import { OBJECTS } from "../clump/model";
import type { ObjectSpec } from "../clump/model";

export type WritingPost = { id: string; slug: string; title: string; icon: string };
export type PostThing = ObjectSpec & { kind: "post"; href: string };
export type HouseThing = ObjectSpec | PostThing;

export const WRITING_FOLDER_OBJECT: ObjectSpec = {
  id: "writing-folder", name: "Writing", emoji: "📂", width: 64, height: 56, shape: "rectangle",
};
export function writingFolder(posts: readonly WritingPost[]): FolderSpec<HouseThing> {
  return {
    ...WRITING_FOLDER_OBJECT, kind: "folder",
    items: posts.map((post) => {
      const value: PostThing = {
        kind: "post", id: `post:${post.id}`, name: post.title, emoji: post.icon,
        href: `/blog/${encodeURIComponent(post.slug)}`, width: 56, height: 64, shape: "rectangle",
      };
      return { kind: "item", id: value.id, name: value.name, emoji: value.emoji, value };
    }),
  };
}

export const PORTFOLIO_FOLDER: FolderSpec<HouseThing> = {
  kind: "folder", id: "portfolio-folder", name: "Portfolio", emoji: "📁",
  items: [
    ...OBJECTS.filter((object) => object.id === "computer" || object.id === "case").map((object) => ({
      kind: "item" as const, id: object.id, name: object.id === "computer" ? "Projects" : "Experience", emoji: object.emoji, value: object,
    })),
    {
      kind: "folder", id: "lab-folder", name: "Lab", emoji: "📁",
      items: [{ kind: "link", id: "clump-lab", name: "A place for my things", emoji: "🐙", href: "/lab/clump" }],
    },
  ],
};
export const PORTFOLIO_FOLDER_OBJECT: ObjectSpec = {
  id: PORTFOLIO_FOLDER.id, name: PORTFOLIO_FOLDER.name, emoji: PORTFOLIO_FOLDER.emoji, width: 64, height: 56, shape: "rectangle",
};
