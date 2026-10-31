#!/usr/bin/env node
/**
 * Post-build step: convert the Vite-injected blocking <link rel="stylesheet">
 * into a non-blocking <link rel="preload" as="style" onload="..."> and
 * inline a tiny critical <style> so first paint is dark. Runs after
 * `vite build` and rewrites dist/index.html in place.
 *
 *   node scripts/postbuild-css-defer.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TARGET = join(ROOT, "dist/index.html");
if (!existsSync(TARGET)) {
  console.error("dist/index.html missing — run `vite build` first");
  process.exit(1);
}

let html = readFileSync(TARGET, "utf8");
if (html.charCodeAt(0) === 0xfeff) html = html.slice(1);

// Find the first <link rel="stylesheet" href="..."> injected by Vite.
const linkRe = /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/;
const m = html.match(linkRe);
if (!m) {
  console.log("no <link rel=stylesheet> in dist/index.html, nothing to do");
  process.exit(0);
}
const cssHref = m[1];
console.log("defer", cssHref);

const replacement = `    <link rel="preload" as="style" href="${cssHref}" onload="this.onload=null;this.rel='stylesheet'" />
    <noscript><link rel="stylesheet" href="${cssHref}" /></noscript>`;
const original = m[0];
html = html.replace(original, replacement);

// Inline a tiny critical <style> right before </head> so first paint is
// not white. Mirrors the minimum visible rules from src/styles.css root.
const critical = `
    <style>
      html,body{margin:0;background:#050608;color:#fff;}
      html,body,#root{width:100%;min-width:1024px;min-height:640px;height:100%;overflow:hidden;}
      #root{isolation:isolate;}
    </style>`;
html = html.replace("</head>", `${critical}\n  </head>`);

writeFileSync(TARGET, html, "utf8");
console.log("wrote", TARGET);
