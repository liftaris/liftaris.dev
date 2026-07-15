"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { SOCIAL } from "@/data/portfolio";
import { TownSquare } from "@/components/TownSquare";

export interface ShellPost {
  slug: string;
  title: string;
  date: string;
}

interface ShellProps {
  posts: ShellPost[];
  children: React.ReactNode;
}

export function Shell({ posts, children }: ShellProps) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [, startTransition] = useTransition();
  const shellRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLButtonElement>(null);
  const onBlog = pathname.startsWith("/blog/");
  const onHome = pathname === "/";
  const activeSlug = onBlog ? pathname.replace("/blog/", "").replace(/\/$/, "") : "";

  const go = (href: string) => {
    startTransition(() => router.push(href));
  };

  useEffect(() => {
    const name = nameRef.current;
    const shell = shellRef.current;
    if (!name || !shell) return;

    const syncIdentityWidth = () => {
      shell.style.setProperty("--identity-width", `${name.getBoundingClientRect().width}px`);
    };
    const observer = new ResizeObserver(syncIdentityWidth);
    observer.observe(name);
    syncIdentityWidth();
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={shellRef} className={onBlog ? "shell onBlog" : onHome ? "shell onHome" : "shell"}>
      <div className="noise" aria-hidden="true" />

      <nav className="stageNav" aria-label="Primary">
        <Link className={pathname === "/projects" ? "active" : ""} href="/projects">projects</Link>
        <Link className={pathname === "/experience" ? "active" : ""} href="/experience">experience</Link>
        <a href={SOCIAL.github} target="_blank" rel="noreferrer">github</a>
      </nav>

      <div className="identity">
        <button ref={nameRef} className="name" onClick={() => go("/")} aria-label="Home">
          <h1><span>Kaio</span><span>Barbosa</span><span>-</span><span>Chifan</span></h1>
        </button>
      </div>

      <aside className="writing" aria-label="Writing">
        <h2>Writing</h2>
        <div className="postlist">
          {posts.map((post) => (
            <Link
              key={post.slug}
              className={activeSlug === post.slug ? "active" : ""}
              href={`/blog/${post.slug}`}
              transitionTypes={!onBlog ? ["blog-enter"] : undefined}
            >
              <time>{new Date(post.date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</time>
              <span>{post.title}</span>
            </Link>
          ))}
        </div>
      </aside>

      <section className="stageContent" aria-live="polite">
        {children}
      </section>

      {!onBlog && (
        <footer className="townSquare" aria-label="TownSquare">
          <TownSquare />
        </footer>
      )}
    </div>
  );
}
