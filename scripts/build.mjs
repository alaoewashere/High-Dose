/**
 * 1) Inline <style> in index.html → src/site.css (first run only), link to dist/site.min.css
 * 2) Bundle gsap (core only, no ScrollTrigger) + js/frame-sequence.js → dist/preloader.min.js
 * 3) Minify other JS → dist/*.min.js
 * 4) Patch index.html script tags to dist/*.min.js (idempotent)
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");
const tmp = path.join(root, ".esbuild-temp");
const srcDir = path.join(root, "src");
const indexPath = path.join(root, "index.html");

fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(srcDir, { recursive: true });

let indexHtml = fs.readFileSync(indexPath, "utf8");

/* --- CSS: extract once, always minify from src/site.css --- */
const hasDistCssLink = indexHtml.includes('href="dist/site.min.css"');
const styleOpen = indexHtml.indexOf("<style>");
const styleClose = indexHtml.indexOf("</style>");

if (!hasDistCssLink) {
  if (styleOpen === -1 || styleClose === -1 || styleClose <= styleOpen) {
    throw new Error("index.html: expected <style>…</style> for first build");
  }
  const cssRaw = indexHtml.slice(styleOpen + "<style>".length, styleClose).trim();
  fs.writeFileSync(path.join(srcDir, "site.css"), cssRaw, "utf8");
  const linkBlock = `    <link
      rel="stylesheet"
      href="dist/site.min.css"
      media="print"
      onload="this.media='all'"
    />
    <noscript><link rel="stylesheet" href="dist/site.min.css" /></noscript>
`;
  indexHtml = indexHtml.slice(0, styleOpen) + linkBlock + indexHtml.slice(styleClose + "</style>".length);
  fs.writeFileSync(indexPath, indexHtml, "utf8");
  console.log("Extracted CSS → src/site.css, linked dist/site.min.css in index.html");
  indexHtml = fs.readFileSync(indexPath, "utf8");
}

await esbuild.build({
  entryPoints: [path.join(srcDir, "site.css")],
  minify: true,
  outfile: path.join(dist, "site.min.css"),
  logLevel: "warning",
});

/* --- GSAP + frame-sequence --- */
const framePath = path.join(root, "js", "frame-sequence.js");
let frameSrc = fs.readFileSync(framePath, "utf8");
frameSrc = frameSrc.replace(/^\s*\(function\s*\(\)\s*\{/, "").replace(/\}\)\(\);\s*$/, "");
const entryPath = path.join(tmp, "preloader-entry.mjs");
fs.writeFileSync(
  entryPath,
  `import { gsap } from "gsap";\n` + frameSrc.replace(/typeof gsap === "undefined"/g, "false"),
  "utf8"
);

await esbuild.build({
  entryPoints: [entryPath],
  bundle: true,
  minify: true,
  legalComments: "none",
  format: "iife",
  outfile: path.join(dist, "preloader.min.js"),
  logLevel: "warning",
});

for (const name of ["site-nav-drawer.js", "menu-categories.js", "menu-product-tilt.js"]) {
  await esbuild.build({
    entryPoints: [path.join(root, "js", name)],
    minify: true,
    legalComments: "none",
    outfile: path.join(dist, name.replace(/\.js$/, ".min.js")),
    logLevel: "warning",
  });
}

/* --- Patch script tags in index.html (only when using bundled preloader, not CDN+js/frame) --- */
indexHtml = fs.readFileSync(indexPath, "utf8");
const usesCdnGsapAndLocalFrame =
  indexHtml.includes("cdnjs.cloudflare.com/ajax/libs/gsap") &&
  indexHtml.includes('src="js/frame-sequence.js"');
if (!indexHtml.includes('src="dist/preloader.min.js"') && !usesCdnGsapAndLocalFrame) {
  indexHtml = indexHtml.replace(
    /<script defer src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/gsap\/[^"]+"><\/script>\s*\n?\s*<script defer src="js\/frame-sequence\.js"><\/script>/,
    '    <script defer src="dist/preloader.min.js"></script>'
  );
  indexHtml = indexHtml.replace(
    /<script defer src="js\/site-nav-drawer\.js"><\/script>/,
    '    <script defer src="dist/site-nav-drawer.min.js"></script>'
  );
  indexHtml = indexHtml.replace(
    /<script defer src="js\/menu-categories\.js"><\/script>/,
    '    <script defer src="dist/menu-categories.min.js"></script>'
  );
  indexHtml = indexHtml.replace(
    /<script defer src="js\/menu-product-tilt\.js"><\/script>/,
    '    <script defer src="dist/menu-product-tilt.min.js"></script>'
  );
  fs.writeFileSync(indexPath, indexHtml, "utf8");
  console.log("Patched index.html → dist/*.min.js scripts");
}

console.log("Build OK.");
