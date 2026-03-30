import fs from "fs";
import path from "path";
import client from "@/tina/__generated__/client";
import type {
  PostQuery,
  PostQueryVariables,
} from "@/tina/__generated__/types";
import PostClient from "@/components/tina/PostClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getSiteConfig() {
  const config = await import("@/data/config.json");
  return { title: config.title };
}

async function getPostData(slug: string) {
  const variables: PostQueryVariables = { relativePath: `${slug}.md` };

  try {
    const res = await client.queries.post(variables);
    return {
      data: res.data,
      query: res.query,
      variables,
    };
  } catch {
    return {
      data: {} as PostQuery,
      query: "",
      variables,
    };
  }
}

export async function generateStaticParams() {
  const postsDirectory = path.join(process.cwd(), "content/posts");
  const filenames = fs
    .readdirSync(postsDirectory)
    .filter((f) => f.endsWith(".md"));

  return filenames.map((file) => ({
    slug: file.replace(/\.md$/, ""),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const postData = await getPostData(slug);
  const config = await getSiteConfig();

  return {
    title: `${postData.data.post?.title || "Post"} | ${config.title}`,
  };
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params;
  const [postData, config] = await Promise.all([
    getPostData(slug),
    getSiteConfig(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Header siteTitle={config.title} />
      <main className="pt-[73px]">
        {/* Back link */}
        <div className="mx-auto max-w-3xl px-6 py-4">
          <Button variant="ghost" size="sm" render={<Link href="/" />} className="gap-2 text-muted-foreground">
            <ArrowLeft className="size-4" />
            Back to home
          </Button>
        </div>
        <Separator />

        {/* Article content */}
        <article className="py-12">
          <div className="mx-auto max-w-3xl px-6">
            <PostClient {...postData} />
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
