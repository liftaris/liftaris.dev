import fs from "fs";
import path from "path";
import matter from "gray-matter";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Blog | Kaio Barbosa-Chifan" };

function posts() {
  return fs
    .readdirSync(path.join(process.cwd(), "content/posts"))
    .filter((file) => file.endsWith(".md") && file !== "sfde-docker-audit.md")
    .map((file) => {
      const meta = matter(fs.readFileSync(path.join(process.cwd(), "content/posts", file), "utf8"));
      return {
        slug: file.replace(/\.md$/, ""),
        title: String(meta.data.title || file.replace(/\.md$/, "")),
        date: String(meta.data.date instanceof Date ? meta.data.date.toISOString() : meta.data.date || ""),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export default function PostsPage() {
  return (
    <main>
      <section className="hero" style={{ minHeight: "62svh" }}>
        <nav className="nav" aria-label="Primary">
          <Link className="mark" href="/">KAIO BARBOSA-CHIFAN</Link>
          <div className="navlinks"><Link href="/">HOME</Link><Link href="/posts">BLOG</Link></div>
          <a className="contact" href="mailto:kaio@liftaris.dev">CONTACT</a>
        </nav>
        <div className="heroGrid" style={{ minHeight: "44svh" }}>
          <aside className="rail"><span>OUTPUT 05</span><span>WRITING</span></aside>
          <div className="heroCopy">
            <p className="kicker">field notes</p>
            <h1>writing from the workbench.</h1>
            <p className="lede">Notes on the parts of shipping that only become obvious after you have to debug them.</p>
          </div>
        </div>
      </section>
      <section className="blog" style={{ marginTop: 70 }}>
        <div><span>INDEX</span><h2>posts</h2></div>
        <div className="postlist">
          {posts().map((post) => (
            <Link href={`/blog/${post.slug}`} key={post.slug}>
              <time>{new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</time>
              <span>{post.title}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
