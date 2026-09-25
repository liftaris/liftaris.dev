import type { FolderSpec } from "../folder/Folder";
import { OBJECTS } from "../clump/model";
import type { ObjectSpec } from "../clump/model";

export const PORTFOLIO_FOLDER: FolderSpec<ObjectSpec> = {
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
