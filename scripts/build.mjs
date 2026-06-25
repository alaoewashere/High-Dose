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
const siteCssPath = path.join(srcDir, "site.css");
const hasDistCssLink = indexHtml.includes('href="dist/site.min.css"');
const hasSrcCssLink = indexHtml.includes('href="src/site.css"');
const styleOpen = indexHtml.indexOf("<style>");
const styleClose = indexHtml.indexOf("</style>");
const distCssLinkBlock = `    <link
      rel="stylesheet"
      href="dist/site.min.css"
      media="print"
      onload="this.media='all'"
    />
    <noscript><link rel="stylesheet" href="dist/site.min.css" /></noscript>
`;

if (!hasDistCssLink) {
  if (styleOpen !== -1 && styleClose !== -1 && styleClose > styleOpen) {
    const cssRaw = indexHtml.slice(styleOpen + "<style>".length, styleClose).trim();
    fs.writeFileSync(siteCssPath, cssRaw, "utf8");
    indexHtml = indexHtml.slice(0, styleOpen) + distCssLinkBlock + indexHtml.slice(styleClose + "</style>".length);
    fs.writeFileSync(indexPath, indexHtml, "utf8");
    console.log("Extracted CSS → src/site.css, linked dist/site.min.css in index.html");
    indexHtml = fs.readFileSync(indexPath, "utf8");
  } else if (hasSrcCssLink && fs.existsSync(siteCssPath)) {
    indexHtml = indexHtml.replace(
      /<link\s+rel="stylesheet"\s+href="src\/site\.css"\s*\/?>/,
      distCssLinkBlock
    );
    fs.writeFileSync(indexPath, indexHtml, "utf8");
    console.log("Linked dist/site.min.css in index.html (from src/site.css)");
    indexHtml = fs.readFileSync(indexPath, "utf8");
  } else {
    throw new Error(
      "index.html: expected <style>…</style>, href=\"src/site.css\", or href=\"dist/site.min.css\" for build"
    );
  }
}

if (!fs.existsSync(siteCssPath)) {
  throw new Error("Missing src/site.css — cannot build CSS bundle");
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

/* --- Patch script tags in index.html for production bundles --- */
indexHtml = fs.readFileSync(indexPath, "utf8");
if (!indexHtml.includes('src="dist/preloader.min.js"')) {
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
