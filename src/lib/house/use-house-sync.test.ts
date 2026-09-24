import { expect, test } from "bun:test";
import { createElement, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { useHouseSync } from "./use-house-sync";

test("house sync renders on the server without a browser or an active socket", () => {
  let snapshots = 0;
  function Probe() {
    useHouseSync(() => { snapshots++; });
    return createElement("span", null, "house");
  }
  expect(typeof window).toBe("undefined");
  expect(renderToString(createElement(StrictMode, null, createElement(Probe)))).toBe("<span>house</span>");
  expect(snapshots).toBe(0);
});
