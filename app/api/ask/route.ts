import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import chunks from "@/lib/rag/chunks.json";

const SYSTEM_PROMPT = `You are an AI assistant embedded on Kaio Barbosa-Chifan's personal portfolio website (liftaris.dev). Your job is to answer questions from visitors about Kaio's background, projects, experience, and blog posts.

You will be given relevant context chunks from the site's content. Use ONLY the provided context to answer questions. If the context doesn't contain enough information to answer, say so honestly rather than making things up.

Keep answers concise and conversational. You're representing Kaio's portfolio, so be professional but approachable — match the tone of his writing.

If asked about something completely unrelated to Kaio or his work, politely redirect: "I'm here to help with questions about Kaio's background and projects. Is there something about his work I can help with?"`;

function buildContext(): string {
  return chunks
    .map((c) => `[${c.title}] (source: ${c.source})\n${c.content}`)
    .join("\n\n---\n\n");
}

export async function POST(req: Request) {
  const { question } = (await req.json()) as { question?: string };

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  if (question.length > 1000) {
    return Response.json({ error: "question too long (max 1000 chars)" }, { status: 400 });
  }

  const context = buildContext();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    prompt: `Here is context from Kaio's portfolio site:\n\n${context}\n\n---\n\nVisitor question: ${question}`,
    maxOutputTokens: 1024,
  });

  return result.toTextStreamResponse();
}
