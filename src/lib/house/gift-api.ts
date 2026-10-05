/** Exact native routes shared by the plugin, client and deny-by-default CMS perimeter. */
export const GIFT_API = "/_emdash/api/plugins/liftaris-gifts";
export const GIFT_METHODS = {
  mine: ["GET"],
  snapshot: ["GET"],
  create: ["POST"],
  gift: ["DELETE"],
  update: ["PATCH"],
} as const;
