/** Exact native routes shared by the plugin, client and deny-by-default CMS perimeter. */
export const GIFT_API = "/_emdash/api/plugins/liftaris-gifts";
export const GIFT_METHODS = {
  snapshot: ["GET"],
  "public-gift": ["GET"],
  create: ["POST"],
  gift: ["GET", "DELETE"],
  update: ["PATCH"],
} as const;
