import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";

// This is a one-time import source. Published content lives in EmDash afterwards.
export function markdownToBlocks(markdown) {
  const tree = unified().use(remarkParse).use(remarkMdx).parse(markdown);
  let sequence = 0;
  const key = () => `m${++sequence}`;
  function text(nodes, marks, definitions) {
    return nodes.flatMap((node) => {
      if (node.type === "text" || node.type === "inlineCode" || node.type === "break") {
        return [{ _type: "span", _key: key(), text: node.type === "break" ? "\n" : node.value,
          marks: node.type === "inlineCode" ? [...marks, "code"] : marks }];
      }
      if (node.type === "strong" || node.type === "emphasis" || node.type === "delete") {
        return text(node.children, [...marks, { strong: "strong", emphasis: "em", delete: "strike-through" }[node.type]], definitions);
      }
      if (node.type === "link") {
        const id = key();
        definitions.push({ _type: "link", _key: id, href: node.url });
        return text(node.children, [...marks, id], definitions);
      }
      throw new Error(`Unsupported inline Markdown: ${node.type}`);
    });
  }
  function block(nodes, properties = {}) {
    const markDefs = [];
    return { _type: "block", _key: key(), style: "normal", ...properties,
      children: text(nodes, [], markDefs), markDefs };
  }
  function convert(nodes, properties = {}) {
    return nodes.flatMap((node) => {
      if (node.type === "paragraph") {
        const result = [];
        let inline = [];
        const flush = () => { if (inline.length) result.push(block(inline, properties)); inline = []; };
        for (const child of node.children) {
          if (child.type === "image") {
            flush();
            result.push({ _type: "image", _key: key(), alt: child.alt || "", asset: { url: child.url } });
          } else inline.push(child);
        }
        flush();
        return result;
      }
      if (node.type === "heading") return [block(node.children, { style: `h${node.depth}` })];
      if (node.type === "blockquote") return convert(node.children, { ...properties, style: "blockquote" });
      if (node.type === "list") return node.children.flatMap((item) => convert(item.children, {
        listItem: node.ordered ? "number" : "bullet", level: (properties.level || 0) + 1,
      }));
      if (node.type === "code") return [{ _type: "code", _key: key(), code: node.value, language: node.lang || "text" }];
      if (node.type === "thematicBreak") return [{ _type: "thematicBreak", _key: key() }];
      if (node.type === "mdxJsxFlowElement" && node.name === "ThemeImage") {
        const values = Object.fromEntries(node.attributes.map((attribute) => {
          if (attribute.type !== "mdxJsxAttribute" || typeof attribute.value !== "string") throw new Error("ThemeImage attributes must be literal strings");
          return [attribute.name, attribute.value];
        }));
        if (!values.lightSrc || !values.darkSrc) throw new Error("ThemeImage is missing an image");
        return [{ _type: "themeImage", _key: key(), ...values }];
      }
      throw new Error(`Unsupported Markdown block: ${node.type}`);
    });
  }
  return convert(tree.children);
}

export function createSeed(directory) {
  const posts = readdirSync(directory).filter((file) => file.endsWith(".md")).sort().map((file) => {
    const { data, content } = matter(readFileSync(path.join(directory, file), "utf8"));
    const slug = file.slice(0, -3);
    return { id: `import-${slug}`, slug, status: "published", bylines: [{ byline: "kaio" }],
      data: { title: data.title, date: new Date(data.date).toISOString(), content: markdownToBlocks(content) } };
  });
  return {
    version: "1",
    meta: { name: "liftaris.dev", author: "Kaio Barbosa" },
    settings: { title: "Kaio Barbosa", tagline: "Software engineer building BazaarGhost and Herm TUI.", timezone: "America/Los_Angeles" },
    bylines: [{ id: "kaio", slug: "kaio", displayName: "Kaio Barbosa" }],
    collections: [{ slug: "posts", label: "Posts", labelSingular: "Post", urlPattern: "/blog/{slug}", dateField: "date",
      supports: ["drafts", "revisions", "preview", "scheduling", "search", "seo"],
      fields: [
        { slug: "title", label: "Title", type: "string", required: true, searchable: true },
        { slug: "date", label: "Date", type: "datetime", required: true },
        { slug: "content", label: "Body", type: "portableText", searchable: true },
      ] }],
    content: { posts },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync("seed", { recursive: true });
  const seed = createSeed("content/posts");
  writeFileSync("seed/seed.json", JSON.stringify(seed, null, 2) + "\n");
  console.log(`Prepared ${seed.content.posts.length} posts for first-time EmDash import.`);
}
