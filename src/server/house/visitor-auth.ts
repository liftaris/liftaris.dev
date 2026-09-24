import { betterAuth } from "better-auth";
import { anonymous, bearer } from "better-auth/plugins";
import { DateTime } from "effect";

const ANIMALS = ["Capybara", "Otter", "Puffin", "Axolotl", "Panda", "Wombat", "Quokka", "Badger", "Hedgehog", "Octopus", "Fox", "Koala", "Raccoon", "Manta", "Kiwi", "Lemur"];
// Better Auth requires a finite date. This is effectively lifelong ownership,
// with renewal near expiry; it does not provide recovery after storage is lost.
export const VISITOR_SESSION_SECONDS = 100 * 365.25 * 24 * 60 * 60;
const ownershipExpiry = () => DateTime.toDateUtc(DateTime.add(DateTime.nowUnsafe(), { seconds: VISITOR_SESSION_SECONDS }));

export function visitorAuth(env: Env, origin: string) {
  if (!env.VISITOR_AUTH_SECRET || env.VISITOR_AUTH_SECRET.length < 32) throw new Error("Visitor authentication is not configured.");
  return betterAuth({
    baseURL: origin,
    basePath: "/api/visitors",
    secret: env.VISITOR_AUTH_SECRET,
    database: env.VISITOR_DB,
    user: { modelName: "visitor_user" },
    session: {
      modelName: "visitor_session",
      // The library still serializes a temporary cookie before our route strips it.
      // Its serializer caps Max-Age at 400 days; stored bearer ownership is separate.
      expiresIn: 400 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
      cookieCache: { enabled: false },
    },
    account: { modelName: "visitor_account" },
    verification: { modelName: "visitor_verification" },
    databaseHooks: {
      session: {
        create: { before: async (session) => ({ data: { ...session, expiresAt: ownershipExpiry() } }) },
        update: { before: async (session) => ({ data: { ...session, ...(session.expiresAt ? { expiresAt: ownershipExpiry() } : {}) } }) },
      },
    },
    advanced: {
      cookiePrefix: "portfolio-visitor",
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    rateLimit: {
      enabled: true, storage: "database", modelName: "visitor_rate_limit",
      window: 60, max: 120,
      customRules: { "/sign-in/anonymous": { window: 60 * 60, max: 30 } },
    },
    plugins: [
      anonymous({
        disableDeleteAnonymousUser: true,
        generateName: () => ANIMALS[crypto.getRandomValues(new Uint32Array(1))[0] % ANIMALS.length],
      }),
      bearer(),
    ],
  });
}

/** Visitor cookies cannot silently restore an identity after localStorage clears. */
export function visitorHeaders(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  return headers;
}
