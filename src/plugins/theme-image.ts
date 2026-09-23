import { definePlugin } from "emdash";

export function createPlugin() {
  return definePlugin({
    id: "liftaris-theme-image",
    version: "1.0.0",
    admin: {
      portableTextBlocks: [{
        type: "themeImage",
        label: "Theme Image",
        description: "An image with separate light and dark versions.",
        fields: [
          { type: "text_input", action_id: "lightSrc", label: "Light image URL" },
          { type: "text_input", action_id: "darkSrc", label: "Dark image URL" },
          { type: "text_input", action_id: "alt", label: "Alternative text" },
        ],
      }],
    },
  });
}
