import { env } from "cloudflare:workers";

export interface ClefDecision {
  approved: boolean;
  score?: number;
  reason?: string;
}

/**
 * Moderate a guestbook message using Cloudflare Clef (@cf/cloudflare/clef-flash).
 * Clef is a structured decision model designed for agentic classification and hot-path decisions.
 */
export async function moderateWithClef(text: string, authorName?: string): Promise<ClefDecision> {
  const content = `Author: ${authorName || "Anonymous"}\nMessage: ${text}`;
  try {
    const cfEnv = env as unknown as { AI?: { run: (model: string, input: unknown) => Promise<unknown> } };
    if (cfEnv?.AI && typeof cfEnv.AI.run === "function") {
      const response = (await cfEnv.AI.run("@cf/cloudflare/clef-flash", {
        state: content,
        questions: {
          appropriate: {
            type: "noul",
            instructions:
              "Is this message safe, friendly, and appropriate to publish on a public portfolio guestbook without human review? Answer true if it is benign and safe to publish automatically; false if it contains spam, insults, profanity, harassment, or controversial links requiring moderation.",
          },
        },
      })) as { answers?: { appropriate?: { noul?: number } } };

      const prob = response?.answers?.appropriate?.noul;
      if (typeof prob === "number") {
        const approved = prob >= 0.75;
        return {
          approved,
          score: prob,
          reason: approved
            ? `Clef decision model auto-approved (confidence: ${(prob * 100).toFixed(0)}%)`
            : `Clef decision model held for review (confidence: ${(prob * 100).toFixed(0)}%)`,
        };
      }
    }
  } catch (error) {
    console.warn("[Clef] Workers AI run failed or unavailable:", error);
  }

  // Fallback when Clef is unavailable or offline:
  // External links always require manual review
  if (/https?:\/\/|www\./i.test(text)) {
    return {
      approved: false,
      reason: "Contains external link — held for review",
    };
  }

  // Default to pending review so Kaio can review in the EmDash comments admin
  return {
    approved: false,
    reason: "Held for admin review",
  };
}
