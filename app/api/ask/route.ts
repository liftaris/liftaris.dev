import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import chunks from "@/lib/rag/chunks.json";

const SYSTEM_PROMPT = `You are an AI assistant embedded on Kaio Barbosa-Chifan's personal portfolio website (liftaris.dev). Your job is to answer questions from visitors about Kaio's background, projects, experience, and blog posts.

Here is context from the site's content:

${chunks.map((c) => `[${c.title}] (source: ${c.source})\n${c.content}`).join("\n\n---\n\n")}

---

Use ONLY the provided context to answer questions. If the context doesn't contain enough information to answer, say so honestly rather than making things up.

Keep answers concise and conversational. You're representing Kaio's portfolio, so be professional but approachable — match the tone of his writing.

If asked about something completely unrelated to Kaio or his work, politely redirect: "I'm here to help with questions about Kaio's background and projects. Is there something about his work I can help with?"`;

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 1024,
  });

  return result.toUIMessageStreamResponse();
}
