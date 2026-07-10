import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export interface PostSummary {
  slug: string;
  title: string;
  date: string;
}

const defaultPostsDirectory = path.join(process.cwd(), "content/posts");

export function isPostSlug(slug: string) {
  return /^[A-Za-z0-9-]+$/.test(slug);
}

export function getPostSlugs(directory = defaultPostsDirectory) {
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".md"))
    .map((file) => file.replace(/\.md$/, ""))
    .filter(isPostSlug)
    .sort();
}

export function postExists(slug: string, directory = defaultPostsDirectory) {
  if (!isPostSlug(slug)) return false;
  return fs.existsSync(path.join(directory, `${slug}.md`));
}

export function getPostSummaries(directory = defaultPostsDirectory): PostSummary[] {
  return getPostSlugs(directory)
    .map((slug) => {
      const meta = matter(fs.readFileSync(path.join(directory, `${slug}.md`), "utf8"));
      return {
        slug,
        title: String(meta.data.title || slug),
        date: String(meta.data.date instanceof Date ? meta.data.date.toISOString() : meta.data.date || ""),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
