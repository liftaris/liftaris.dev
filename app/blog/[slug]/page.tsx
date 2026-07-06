import fs from "fs";
import path from "path";
import { ViewTransition } from "react";
import client from "@/tina/__generated__/client";
import type { PostQuery, PostQueryVariables } from "@/tina/__generated__/types";
import PostClient from "@/components/tina/PostClient";
import type { Metadata } from "next";
import { TownSquare } from "@/components/TownSquare";

interface PageProps { params: Promise<{ slug: string }>; }

async function getPostData(slug: string) {
  const variables: PostQueryVariables = { relativePath: `${slug}.md` };
  try {
    const res = await client.queries.post(variables);
    return { data: res.data, query: res.query, variables };
  } catch {
    return { data: {} as PostQuery, query: "", variables };
  }
}

export async function generateStaticParams() {
  const dir = path.join(process.cwd(), "content/posts");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ slug: file.replace(/\.md$/, "") }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostData(slug);
  return { title: `${post.data.post?.title || "Post"} | Kaio Barbosa-Chifan` };
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params;
  return (
    <ViewTransition enter={{ "blog-enter": "blog-enter", default: "none" }} exit="none" default="none">
      <>
        <article className="article-content">
          <PostClient {...await getPostData(slug)} />
        </article>
        <footer className="blogTownSquare" aria-label="TownSquare">
          <TownSquare />
        </footer>
      </>
    </ViewTransition>
  );
}
