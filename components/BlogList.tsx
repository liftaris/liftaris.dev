import Link from "next/link";
import Image from "next/image";
import { Calendar, ArrowRight } from "lucide-react";

function reformatDate(fullDate: string): string {
  const date = new Date(fullDate);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

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

interface BlogListProps {
  allBlogs: BlogPost[];
}

export default function BlogList({ allBlogs }: BlogListProps) {
  return (
    <section id="posts" className="relative py-24">
      {/* Section header */}
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Latest Posts
            </h2>
            <p className="mt-2 text-muted-foreground">
              Thoughts, experiments, and explorations
            </p>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-px w-12 bg-border" />
              <span>{allBlogs.length} posts</span>
            </div>
          </div>
        </div>

        {/* Blog grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {allBlogs &&
            allBlogs.length > 0 &&
            allBlogs.map((post, index) => (
              <article
                key={post.filename}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
              >
                {/* Featured badge for first post */}
                {index === 0 && (
                  <div className="absolute left-4 top-4 z-10 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Latest
                  </div>
                )}

                {/* Image */}
                <Link
                  href={`/blog/${post.filename}`}
                  className="relative aspect-[16/10] overflow-hidden"
                >
                  <Image
                    src={post.frontmatter.hero_image}
                    alt={post.frontmatter.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </Link>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5">
                  {/* Date */}
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="size-3" />
                    <time dateTime={post.frontmatter.date}>
                      {reformatDate(post.frontmatter.date)}
                    </time>
                  </div>

                  {/* Title */}
                  <h3 className="mb-3 flex-1 text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                    <Link href={`/blog/${post.filename}`}>
                      {post.frontmatter.title}
                    </Link>
                  </h3>

                  {/* Read more link */}
                  <Link
                    href={`/blog/${post.filename}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-all duration-300 group-hover:opacity-100"
                  >
                    Read article
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>

                {/* Bottom accent line */}
                <div className="h-0.5 w-0 bg-gradient-to-r from-primary to-accent transition-all duration-300 group-hover:w-full" />
              </article>
            ))}
        </div>

        {/* Empty state */}
        {(!allBlogs || allBlogs.length === 0) && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <svg
                className="size-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-medium text-foreground">
              No posts yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Check back soon for new content
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
