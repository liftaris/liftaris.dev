export const SUGGESTED_PROMPTS: Record<string, string[]> = {
  "/": [
    "Who is Kaio?",
    "What's his strongest project?",
    "What's he building on GitHub lately?",
    "Pitch Kaio for an AI engineering role",
  ],
  "/about": [
    "Where has Kaio lived?",
    "What does he do outside of code?",
    "What languages does he speak?",
  ],
  "/work": [
    "What did Kaio build at Moderna?",
    "Walk me through his career arc",
    "What infrastructure work has he done?",
  ],
  "/projects": [
    "Tell me about BazaarGhost",
    "What's the most technically interesting project?",
    "Show me something with computer vision",
  ],
  "/posts": [
    "What does Kaio write about?",
    "Summarize the BazaarGhost post",
  ],
};

export function promptsFor(pathname: string): string[] {
  if (SUGGESTED_PROMPTS[pathname]) return SUGGESTED_PROMPTS[pathname];
  const base = "/" + (pathname.split("/")[1] ?? "");
  return SUGGESTED_PROMPTS[base] ?? SUGGESTED_PROMPTS["/"];
}
