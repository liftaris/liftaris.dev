declare module "winbox/src/js/winbox.js" {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Upstream declares export=; the ESM entry exports the same constructor as default.
  import WinBox = require("winbox");
  export default WinBox;
}
