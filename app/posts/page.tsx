import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Image from "next/image";
import Link from "next/link";
import { SideColumn } from "@/components/SideColumn";
import type { TileSpec } from "@/lib/tiles";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Posts | KAIO" };

interface Post {
  title: string;
  date: string;
  hero_image: string;
  filename: string;
}

function getPosts(): Post[] {
  const dir = path.join(process.cwd(), "content/posts");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((filename) => {
      const { data } = matter(fs.readFileSync(path.join(dir, filename), "utf8"));
      return {
        title: data.title,
        date: data.date instanceof Date ? data.date.toISOString() : data.date,
        hero_image: data.hero_image,
        filename: filename.replace(/\.md$/, ""),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const LEFT: TileSpec[] = [
  {
    kind: "text",
    title: "Writing",
    body: "Notes on side projects, tools I'm learning, and the occasional deep-dive. Mostly written to force myself to understand something properly.",
  },
  {
    kind: "quote",
    text: "If I can't explain it in a blog post, I don't actually understand it yet.",
  },
];

export default function PostsPage() {
  const posts = getPosts();

  return (
    <>
      <SideColumn side="left" fallback={LEFT} />

      <SideColumn side="right">
        {posts.map((post) => (
          <Link
            key={post.filename}
            href={`/blog/${post.filename}`}
            className="group relative overflow-hidden rounded-xl border border-border/20 bg-card/40 transition-all hover:border-border/60"
          >
            <div className="relative aspect-[21/9]">
              <Image
                src={post.hero_image}
                alt={post.title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3">
              <h3 className="text-sm font-semibold text-foreground">
                {post.title}
              </h3>
              <p className="font-mono text-[10px] text-muted-foreground">
                {new Date(post.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </Link>
        ))}
      </SideColumn>
    </>
  );
}
