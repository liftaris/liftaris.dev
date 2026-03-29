import fs from "fs";
import path from "path";
import matter from "gray-matter";
import BentoHero from "@/components/BentoHero";
import type { Metadata } from "next";

interface BlogPost {
  frontmatter: {
    title: string;
    date: string;
    hero_image: string;
    [key: string]: unknown;
  };
  markdownBody: string;
  filename: string;
}

async function getSiteConfig() {
  const config = await import("@/data/config.json");
  return { title: config.title, description: config.description };
}

async function getBlogPosts(): Promise<BlogPost[]> {
  const postsDirectory = path.join(process.cwd(), "content/posts");
  const filenames = fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith(".md"));

  const posts = filenames.map((filename) => {
    const filePath = path.join(postsDirectory, filename);
    const fileContents = fs.readFileSync(filePath, "utf8");
    const document = matter(fileContents);

    return {
      frontmatter: {
        ...document.data,
        date:
          document.data.date instanceof Date
            ? document.data.date.toISOString()
            : document.data.date,
      } as BlogPost["frontmatter"],
      markdownBody: document.content,
      filename: filename.replace(/\.md$/, ""),
    };
  });

  return posts.sort((a, b) => {
    const dateA = new Date(a.frontmatter.date).getTime();
    const dateB = new Date(b.frontmatter.date).getTime();
    return dateB - dateA;
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return { title: config.title, description: config.description };
}

export default async function HomePage() {
  const [allBlogs, config] = await Promise.all([
    getBlogPosts(),
    getSiteConfig(),
  ]);

  return <BentoHero siteTitle={config.title} posts={allBlogs} />;
}
