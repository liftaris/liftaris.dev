import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Image from "next/image";
import Link from "next/link";
import { SideColumn } from "@/components/SideColumn";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Posts | KAIO",
};

interface BlogPost {
  title: string;
  date: string;
  hero_image: string;
  filename: string;
}

function getPosts(): BlogPost[] {
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

export default function PostsPage() {
  const posts = getPosts();

  return (
    <>
      <SideColumn side="left">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">
            Writing about software, side projects, and things I find interesting.
          </p>
        </Card>
      </SideColumn>

      <SideColumn side="right">
        <h2 className="text-lg font-bold tracking-tight">POSTS</h2>
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <Link key={post.filename} href={`/blog/${post.filename}`}>
              <Card className="group relative overflow-hidden">
                <div className="relative aspect-[16/9]">
                  <Image
                    src={post.hero_image}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold">{post.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(post.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </SideColumn>
    </>
  );
}
