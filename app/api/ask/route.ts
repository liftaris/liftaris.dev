import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const SYSTEM_PROMPT = `You are an AI assistant embedded on Kaio Barbosa-Chifan's personal portfolio website (liftaris.dev). Your job is to answer questions from visitors about Kaio's background, projects, experience, and blog posts.

You will be given relevant context chunks from the site's content. Use ONLY the provided context to answer questions. If the context doesn't contain enough information to answer, say so honestly rather than making things up.

Keep answers concise and conversational. You're representing Kaio's portfolio, so be professional but approachable — match the tone of his writing.

If asked about something completely unrelated to Kaio or his work, politely redirect: "I'm here to help with questions about Kaio's background and projects. Is there something about his work I can help with?"`;

async function getRelevantChunks(query: string): Promise<string> {
  // Generate embedding for the query via Edge Function
  const { data: embedData, error: embedError } =
    await supabase.functions.invoke("embed", {
      body: { input: query },
    });

  if (embedError || !embedData?.embedding) {
    console.error("Embedding error:", embedError);
    // Fallback: return all chunks from local JSON
    const chunks = await import("@/lib/rag/chunks.json");
    return chunks.default
      .map((c: { title: string; source: string; content: string }) =>
        `[${c.title}] (source: ${c.source})\n${c.content}`
      )
      .join("\n\n---\n\n");
  }

  // Vector search via the match function
  const { data: matches, error: matchError } = await supabase.rpc(
    "match_chunks",
    {
      query_embedding: JSON.stringify(embedData.embedding),
      match_threshold: 0.3,
      match_count: 8,
      filter_type: null,
      filter_tags: null,
    },
    { schema: "liftaris" }
  );

  if (matchError || !matches?.length) {
    console.error("Match error:", matchError);
    // Fallback to local chunks
    const chunks = await import("@/lib/rag/chunks.json");
    return chunks.default
      .map((c: { title: string; source: string; content: string }) =>
        `[${c.title}] (source: ${c.source})\n${c.content}`
      )
      .join("\n\n---\n\n");
  }

  return matches
    .map(
      (m: { title: string; type: string; source: string; content: string; tags: string[]; similarity: number }) =>
        `[${m.title}] (type: ${m.type}, source: ${m.source}, tags: ${m.tags?.join(", ") || "none"}, relevance: ${m.similarity.toFixed(2)})\n${m.content}`
    )
    .join("\n\n---\n\n");
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  // Use the latest user message for retrieval
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const query = lastUserMessage?.parts
    ?.filter((p) => p.type === "text")
    .map((p) => p.text)
    .join(" ") ?? "";

  const context = await getRelevantChunks(query);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `${SYSTEM_PROMPT}\n\nHere is relevant context from Kaio's portfolio site:\n\n${context}`,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 1024,
  });

  return result.toUIMessageStreamResponse();
}
