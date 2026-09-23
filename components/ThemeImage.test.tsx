import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeImage } from "./ThemeImage";

describe("ThemeImage", () => {
  test("renders a dark-mode source with a light fallback", () => {
    const markup = renderToStaticMarkup(
      <ThemeImage lightSrc="/light.png" darkSrc="/dark.png" alt="Processing diagram" />,
    );

    expect(markup).toContain("<picture>");
    expect(markup).toContain('media="(prefers-color-scheme: dark)"');
    expect(markup).toContain('srcSet="/dark.png"');
    expect(markup).toContain('src="/light.png"');
    expect(markup).toContain('alt="Processing diagram"');
  });
});
