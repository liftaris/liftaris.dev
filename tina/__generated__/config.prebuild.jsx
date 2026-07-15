// tina/config.ts
import { defineConfig } from "tinacms";
var branch = process.env.HEAD || process.env.VERCEL_GIT_COMMIT_REF || "main";
var config_default = defineConfig({
  branch,
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  build: {
    outputFolder: "admin",
    publicFolder: "public"
  },
  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public"
    }
  },
  schema: {
    collections: [
      {
        name: "post",
        label: "Posts",
        path: "content/posts",
        format: "md",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true
          },
          {
            type: "datetime",
            name: "date",
            label: "Date",
            required: true,
            ui: {
              dateFormat: "DD MM yy"
            }
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
            parser: {
              type: "mdx"
            },
            templates: [
              {
                name: "ThemeImage",
                label: "Theme Image",
                fields: [
                  { name: "lightSrc", label: "Light Mode Image", type: "image" },
                  { name: "darkSrc", label: "Dark Mode Image", type: "image" },
                  { name: "alt", label: "Alt Text", type: "string" }
                ]
              }
            ]
          }
        ],
        ui: {
          router: ({ document }) => `/blog/${document._sys.filename}`
        }
      }
    ]
  }
});
export {
  config_default as default
};
