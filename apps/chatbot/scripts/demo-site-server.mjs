// Serves the fictional contractor website in demo-site/ on its own origin (default
// http://localhost:4000), so the widget is embedded cross-origin exactly as on a real client site.
//   WIDGET_BASE_URL   where the ConvoHatch app runs (default http://localhost:3001)
//   DEMO_SITE_PORT    port for this site (default 4000)

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const base = (process.env.WIDGET_BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const port = Number(process.env.DEMO_SITE_PORT) || 4000;
const page = (await readFile(new URL("../demo-site/index.html", import.meta.url), "utf8")).replaceAll("{{WIDGET_BASE_URL}}", base);

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
