/**
 * Script to generate content chunks and push them to Supabase with embeddings.
 * Run with: npx tsx lib/rag/generate-chunks.ts
 *
 * Reads all content sources (about page, blog posts), splits them into chunks,
 * generates embeddings via the Supabase Edge Function, and upserts to the
 * liftaris.chunks table.
 *
 * Also writes lib/rag/chunks.json as a local fallback.
 */

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { createClient } from "@supabase/supabase-js";

interface Chunk {
  id: string;
  source: string;
  title: string;
  content: string;
}

const CONTENT_DIR = path.join(process.cwd(), "content");
const OUTPUT_PATH = path.join(process.cwd(), "lib/rag/chunks.json");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function generateEmbedding(text: string): Promise<number[]> {
  const { data, error } = await supabase.functions.invoke("embed", {
    body: { input: text },
  });

  if (error) {
    throw new Error(`Embedding error: ${error.message}`);
  }

  return data.embedding;
}

async function main() {
  const chunks = [...parseAbout(), ...parsePosts()];

  // Write local fallback
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(chunks, null, 2));
  console.log(`Wrote ${chunks.length} chunks to ${OUTPUT_PATH}`);

  // Generate embeddings one at a time (edge function processes sequentially)
  console.log("Generating embeddings...");
  const batchSize = 10;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i++) {
    const text = `${chunks[i].title}: ${chunks[i].content}`;
    const embedding = await generateEmbedding(text);
    allEmbeddings.push(embedding);
    if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
      console.log(`  Embedded ${i + 1}/${chunks.length}`);
    }
  }

  // Upsert to Supabase
  console.log("Upserting to Supabase...");
  const rows = chunks.map((chunk, i) => ({
    id: chunk.id,
    source: chunk.source,
    title: chunk.title,
    content: chunk.content,
    embedding: JSON.stringify(allEmbeddings[i]),
    updated_at: new Date().toISOString(),
  }));

  // Upsert in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .schema("liftaris")
      .from("chunks")
      .upsert(batch, { onConflict: "id" });

    if (error) {
      console.error(`Upsert error at batch ${i}:`, error);
    }
  }

  // Clean up stale chunks
  const currentIds = chunks.map((c) => c.id);
  const { error: deleteError } = await supabase
    .schema("liftaris")
    .from("chunks")
    .delete()
    .not("id", "in", `(${currentIds.map((id) => `"${id}"`).join(",")})`);

  if (deleteError) {
    console.error("Cleanup error:", deleteError);
  }

  console.log("Done!");
}

main().catch(console.error);
