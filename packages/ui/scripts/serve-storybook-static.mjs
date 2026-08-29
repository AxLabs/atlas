#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../storybook-static");
const port = Number(process.env.STORYBOOK_STATIC_PORT ?? 6006);
const host = process.env.STORYBOOK_STATIC_HOST ?? "127.0.0.1";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
};

function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const relative = decoded === "/" ? "/index.html" : decoded;
  const candidate = path.join(root, relative);

  if (!candidate.startsWith(root)) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  const htmlFallback = `${candidate}.html`;
  if (existsSync(htmlFallback) && statSync(htmlFallback).isFile()) {
    return htmlFallback;
  }

  const indexFallback = path.join(candidate, "index.html");
  if (existsSync(indexFallback) && statSync(indexFallback).isFile()) {
    return indexFallback;
  }

  return path.join(root, "index.html");
}

const server = createServer((request, response) => {
  const filePath = resolveFile(request.url ?? "/");
  if (!filePath || !existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const ext = path.extname(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`storybook-static listening on http://${host}:${port}\n`);
});

function shutdown(signal) {
  server.close(() => process.exit(signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
