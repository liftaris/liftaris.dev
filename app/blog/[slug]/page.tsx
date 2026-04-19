import fs from "fs";
import path from "path";
import client from "@/tina/__generated__/client";
import type { PostQuery, PostQueryVariables } from "@/tina/__generated__/types";
import PostClient from "@/components/tina/PostClient";
import { SideColumn } from "@/components/SideColumn";
import type { TileSpec } from "@/lib/tiles";
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
  const dir = path.join(process.cwd(), "content/posts");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((file) => ({ slug: file.replace(/\.md$/, "") }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const postData = await getPostData(slug);
  return { title: `${postData.data.post?.title || "Post"} | KAIO` };
}

function relatedTiles(slug: string): TileSpec[] {
  const lower = slug.toLowerCase();
  if (lower.includes("bazaar"))
    return [
      { kind: "project", slug: "bazaarghost" },
      { kind: "image", src: "bazaarghost-diagram", alt: "VOD processing pipeline", aspect: "video" },
      { kind: "link", href: "https://bazaarghost.stream", title: "bazaarghost.stream", subtitle: "Try it" },
    ];
  if (lower.includes("l-system") || lower.includes("lsystem"))
    return [
      { kind: "project", slug: "lsystems" },
      { kind: "image", src: "lsystems-n3", alt: "L-System n=3", aspect: "square" },
    ];
  return [{ kind: "contact" }];
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params;
  const postData = await getPostData(slug);

  return (
    <>
      <article className="article-content overflow-y-auto p-6 lg:col-start-2 lg:row-start-1">
        <div className="mx-auto max-w-2xl">
          <PostClient {...postData} />
        </div>
      </article>

      <SideColumn side="right" fallback={relatedTiles(slug)} />
    </>
  );
}
