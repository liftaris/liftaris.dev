import fs from "fs";
import path from "path";
import client from "@/tina/__generated__/client";
import type { PostQuery, PostQueryVariables } from "@/tina/__generated__/types";
import PostClient from "@/components/tina/PostClient";
import { SideColumn } from "@/components/SideColumn";
import { EmptyTile } from "@/components/EmptyTile";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

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
  const postsDirectory = path.join(process.cwd(), "content/posts");
  return fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith(".md"))
    .map((file) => ({ slug: file.replace(/\.md$/, "") }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const postData = await getPostData(slug);
  return { title: `${postData.data.post?.title || "Post"} | KAIO` };
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params;
  const postData = await getPostData(slug);

  return (
    <>
      {/* Article content — center column */}
      <article className="col-start-2 row-start-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <PostClient {...postData} />
        </div>
      </article>

      {/* Right column tiles */}
      <SideColumn side="right">
        <EmptyTile className="aspect-square" />
        <div className="flex gap-4">
          <EmptyTile className="aspect-square flex-1" />
          <EmptyTile className="aspect-square flex-1" />
        </div>
        <EmptyTile className="flex-1" />
      </SideColumn>
    </>
  );
}
