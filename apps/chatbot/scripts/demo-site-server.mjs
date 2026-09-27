// Serves the fictional contractor page (public/demo.html) on its own origin (default
// http://localhost:4000), so the widget is embedded cross-origin exactly as on a real client site.
// The deployed app also serves the same page at /demo, where the widget loads from the same origin.
//   WIDGET_BASE_URL   where the ConvoHatch app runs (default http://localhost:3001)
//   DEMO_SITE_PORT    port for this site (default 4000)

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const base = (process.env.WIDGET_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const port = Number(process.env.DEMO_SITE_PORT) || 4000;
// The page loads "/widget.js" from its own origin; point it at the ConvoHatch app instead.
const page = (await readFile(new URL("../public/demo.html", import.meta.url), "utf8")).replaceAll(
  'src="/widget.js"',
  `src="${base}/widget.js"`,
);

createServer((request, response) => {
  if (request.url === "/" || request.url === "/index.html") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    response.end(page);
  } else {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`Fictional contractor site: http://localhost:${port} (widget from ${base})`);
});
