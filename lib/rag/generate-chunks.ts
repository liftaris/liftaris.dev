/**
 * Script to pre-generate content chunks from markdown files.
 * Run with: npx tsx lib/rag/generate-chunks.ts
 *
 * Reads all content sources (about page, blog posts) and splits them
 * into chunks suitable for RAG context injection.
 * Output: lib/rag/chunks.json
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";

interface Chunk {
  id: string;
  source: string;
  title: string;
  content: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");
const OUTPUT_PATH = path.join(process.cwd(), "lib/rag/chunks.json");

// Split text into chunks at paragraph boundaries, respecting a max character limit.
function chunkText(text: string, maxChars = 1500): string[] {
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? "\n\n" : "") + trimmed;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function parseAbout(): Chunk[] {
  const filePath = path.join(CONTENT_DIR, "about.md");
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  const chunks: Chunk[] = [];

  // Experience entries as a structured chunk
  if (data.experience) {
    const expText = (data.experience as Array<Record<string, unknown>>)
      .map((exp) => {
        const start = exp.dateStart
          ? new Date(exp.dateStart as string).getFullYear()
          : "";
        const end =
          exp.hasPassed === false
            ? "Present"
            : exp.dateEnd
              ? new Date(exp.dateEnd as string).getFullYear()
              : "";
        return `${exp.title} (${start}–${end}): ${(exp.description as string).trim()}`;
      })
      .join("\n");

    chunks.push({
      id: "about-experience",
      source: "about.md",
      title: "Work Experience & Education",
      content: expText,
    });
  }

  // About bio text
  const bioChunks = chunkText(content);
  bioChunks.forEach((chunk, i) => {
    chunks.push({
      id: `about-bio-${i}`,
      source: "about.md",
      title: "About Kaio",
      content: chunk,
    });
  });

  return chunks;
}

function parsePosts(): Chunk[] {
  const postsDir = path.join(CONTENT_DIR, "posts");
  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));
  const chunks: Chunk[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(postsDir, file), "utf-8");
    const { data, content } = matter(raw);
    const title = (data.title as string) || file.replace(".md", "");
    const slug = file.replace(".md", "");

    // Strip image markdown syntax to keep chunks text-focused
    const cleaned = content.replace(/!\[.*?\]\(.*?\)/g, "").trim();

    const textChunks = chunkText(cleaned);
    textChunks.forEach((chunk, i) => {
      chunks.push({
        id: `post-${slug}-${i}`,
        source: file,
        title,
        content: chunk,
      });
    });
  }

  return chunks;
}

function main() {
  const chunks = [...parseAbout(), ...parsePosts()];
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(chunks, null, 2));
  console.log(`Generated ${chunks.length} chunks → ${OUTPUT_PATH}`);
}

main();
