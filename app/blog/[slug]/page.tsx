import { ViewTransition } from "react";
import client from "@/tina/__generated__/client";
import type { PostQuery, PostQueryVariables } from "@/tina/__generated__/types";
import PostClient from "@/components/tina/PostClient";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TownSquare } from "@/components/TownSquare";
import { getPostSlugs, postExists } from "@/lib/posts";

interface PageProps { params: Promise<{ slug: string }>; }

async function getPostData(slug: string) {
  if (!postExists(slug)) notFound();
  const variables: PostQueryVariables = { relativePath: `${slug}.md` };
  const res = await client.queries.post(variables);
  return { data: res.data as PostQuery, query: res.query, variables };
}

export async function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }));
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
