import {
  streamText,
  convertToModelMessages,
  gateway,
  type UIMessage,
} from "ai";
import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
);

const SYSTEM_PROMPT = `You are an AI assistant embedded on Kaio Barbosa-Chifan's personal portfolio website (liftaris.dev). Your job is to answer questions from visitors about Kaio's background, projects, experience, and blog posts.

You will be given relevant context chunks from the site's content. Use ONLY the provided context to answer questions. If the context doesn't contain enough information to answer, say so honestly rather than making things up.

Keep answers concise and conversational. You're representing Kaio's portfolio, so be professional but approachable — match the tone of his writing.

If asked about something completely unrelated to Kaio or his work, politely redirect: "I'm here to help with questions about Kaio's background and projects. Is there something about his work I can help with?"

You have a "navigate" tool that can take the user to specific pages on the site. When the user asks about a topic that has a dedicated page (e.g., "tell me about your projects", "what's your background?", "show me your blog posts"), use the navigate tool to take them there while also providing a conversational response. Available pages: /about, /projects, /projects/bazaarghost, /posts.`;

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
      .map(
        (c: { title: string; source: string; content: string }) =>
          `[${c.title}] (source: ${c.source})\n${c.content}`,
      )
      .join("\n\n---\n\n");
  }

  // Vector search via the match function
  const { data: matches, error: matchError } = await supabase
    .schema("liftaris")
    .rpc("match_chunks", {
      query_embedding: JSON.stringify(embedData.embedding),
      match_threshold: 0.3,
      match_count: 8,
      filter_type: null,
      filter_tags: null,
    });

  if (matchError || !matches?.length) {
    console.error("Match error:", matchError);
    // Fallback to local chunks
    const chunks = await import("@/lib/rag/chunks.json");
    return chunks.default
      .map(
        (c: { title: string; source: string; content: string }) =>
          `[${c.title}] (source: ${c.source})\n${c.content}`,
      )
      .join("\n\n---\n\n");
  }

  return matches
    .map(
      (m: {
        title: string;
        type: string;
        source: string;
        content: string;
        tags: string[];
        similarity: number;
      }) =>
        `[${m.title}] (type: ${m.type}, source: ${m.source}, tags: ${
          m.tags?.join(", ") || "none"
        }, relevance: ${m.similarity.toFixed(2)})\n${m.content}`,
    )
    .join("\n\n---\n\n");
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  // Use the latest user message for retrieval
  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === "user");
  const query =
    lastUserMessage?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join(" ") ?? "";

  const context = await getRelevantChunks(query);

  const systemPrompt = `${SYSTEM_PROMPT}\n\nHere is relevant context from Kaio's portfolio site:\n\n${context}`;
  const convertedMessages = await convertToModelMessages(messages);
  const toolsDef = {
    navigate: {
      description:
        "Navigate the user to a specific page on the portfolio site. Use this when the user asks about a topic that has a dedicated page.",
      inputSchema: z.object({
        path: z.enum([
          "/about",
          "/projects",
          "/projects/bazaarghost",
          "/posts",
        ]),
      }),
      execute: async ({ path }: { path: string }) => ({ navigatedTo: path }),
    },
  };

  const streamOpts = {
    system: systemPrompt,
    messages: convertedMessages,
    maxOutputTokens: 1024,
    tools: toolsDef,
  } as const;

  const result = streamText({
    model: gateway("anthropic/claude-haiku-4-5-x"),
    providerOptions: {
      gateway: {
        models: ["anthropic/claude-haiku-4-5", "google/gemini-2.5-flash"],
        byok: {
          anthropic: [{ apiKey: process.env.ANTHROPIC_API_KEY! }],
          google: [{ apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY! }],
        },
      } satisfies GatewayProviderOptions,
    },
    ...streamOpts,
  });

  return result.toUIMessageStreamResponse();
}
