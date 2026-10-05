# Emoji search

Guestbook, legacy gift editing, and Things use `EmojiSearch`. It renders with the
Noto Emoji variable font, shows local name/tag matches immediately, and requests
semantic results after a 300 ms pause. Exact matches stay first. Previous requests
are aborted and cannot replace newer results. Picking an icon is always explicit.

The catalog has exactly 255 entries, matching Clef's maximum choice count. Its
names and keywords come from pinned `emojibase-data` (CLDR). Generate it with:

```sh
bun run emoji:generate
```

The generator preserves the original 182 icons and their persisted IDs using
`tools/emoji-legacy-ids.json` (compatibility data, not handwritten search metadata).
It fills remaining places by cycling through Unicode subgroups in upstream order.
The small generated JSON is committed, so normal builds need no network retrieval.
Only that subset is shipped to the browser. Existing pasted Unicode icons remain
readable; the Things inspector also retains its direct emoji input.
Emoji-presentation selectors are omitted when rendering, keeping the monochrome
Noto glyphs instead of forcing system color emoji. The upstream data license is
included at `/licenses/emojibase-data.txt`.

`POST /api/house/suggest` uses the native `AI` binding with
`@cf/cloudflare/clef-flash`, one choice question over the catalog, and a five-second
deadline. It validates scores and returns catalog IDs, never model-generated HTML.
Only the search text is sent as state, not guestbook names or messages. Local
search survives timeouts, rate limits, or unavailable AI; the picker labels that
fallback. The endpoint enforces same-origin JSON requests and rate limits.

The Jev SDK, API-key binding, and service layer have been removed. Wrangler
provides `AI` for both the main Worker and branch previews. In local development,
Workers AI inference still runs remotely and requires Cloudflare authentication.

Sources: [Emojibase datasets](https://emojibase.dev/docs/datasets/),
[Noto Emoji](https://github.com/googlefonts/noto-emoji), and
[Clef API](https://developers.cloudflare.com/workers-ai/models/clef-flash/).
