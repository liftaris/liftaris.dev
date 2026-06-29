import { defineConfig } from "tinacms";

// Your hosting provider likely exposes this as an environment variable
const branch = process.env.HEAD || process.env.VERCEL_GIT_COMMIT_REF || "main";

export default defineConfig({
  branch,
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,
  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "",
      publicFolder: "public",
    },
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
            required: true,
          },
          {
            type: "datetime",
            name: "date",
            label: "Date",
            required: true,
            ui: {
              dateFormat: "DD MM yy",
            }
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
            parser: {
              type: "mdx",
            },
            templates: [
              {
                name: "ThemeImage",
                label: "Theme Image",
                fields: [
                  { name: "lightSrc", label: "Light Mode Image", type: "image" },
                  { name: "darkSrc", label: "Dark Mode Image", type: "image" },
                  { name: "alt", label: "Alt Text", type: "string" },
                ],
              },
            ],
          },
          {
            type: 'image',
            label: 'Hero image',
            name: 'hero_image',
          },
        ],
        ui: {
          router: ({ document }) => `/blog/${document._sys.filename}`,
        },
      },
      {
        name: "about",
        label: "About",
        path: "content",
        format: "md",
        match: {
          include: "about",
        },
        fields: [
          {
            name: "profile",
            label: "Profile",
            type: "image",
          },
          {
            name: "body",
            label: "Body",
            type: "rich-text",
            isBody: true,
          },
          {
            name: "experience",
            label: "Experience",
            type: "object",
            list: true,
            ui: {
              // This allows the customization of the list item UI
              // Data can be accessed by item?.<Name of field>
              itemProps: (item) => {
                return { label: `${item?.title}` }
              },
              // Setting a default will auto-populate new items with the given values
              defaultItem: {
                title: "Item",
                description: ""
              },
            },
            fields: [
              {
                label: "Title",
                name: "title",
                type: "string",
              },
              {
                label: "Date Start",
                name: "dateStart",
                type: "datetime",
                required: false,
                ui: {
                  dateFormat: "MM yy",
                }
              },
              {
                label: "Show Start Date",
                name: "showStartDate",
                type: "boolean",
              },
              {
                label: "Date End",
                name: "dateEnd",
                type: "datetime",
                required: false,
                ui: {
                  dateFormat: "MM yy",
                }
              },
              {
                label: "Show End Date",
                name: "showEndDate",
                type: "boolean",
              },
              {
                label: "Description",
                name: "description",
                type: "string",
                ui: {
                  component: "textarea",
                },
              },
              {
                label: "Has Passed",
                name: "hasPassed",
                type: "boolean"
              }
            ],
          },
        ],
        ui: {
          router: () => '/about',
        },
      },
    ],
  },
});
