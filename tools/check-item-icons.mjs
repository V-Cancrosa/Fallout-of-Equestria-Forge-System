import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const ICON_DIR = join(ROOT, "icons", "items");

const walk = dir => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? walk(path) : [path];
});

const sourceFiles = walk(join(ROOT, "data"))
  .concat(walk(join(ROOT, "module")))
  .concat(walk(join(ROOT, "templates")));

const referenced = new Set();
for (const path of sourceFiles) {
  if (!/\.(json|mjs|hbs)$/.test(path)) continue;
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(/systems\/foe-rpg\/icons\/items\/([a-z0-9-]+\.svg)/g)) {
    referenced.add(match[1]);
  }
}

const files = readdirSync(ICON_DIR).filter(name => name.endsWith(".svg"));
const fileSet = new Set(files);
const missing = [...referenced].filter(name => !fileSet.has(name)).sort();
const unused = files.filter(name => !referenced.has(name)).sort();

const malformed = [];
const hashes = new Map();
for (const name of files) {
  const path = join(ICON_DIR, name);
  const svg = readFileSync(path, "utf8");
  if (!svg.includes('viewBox="0 0 512 512"')) malformed.push(`${name}: viewBox`);
  if (!/<(?:g|path|circle|rect|polygon|polyline|ellipse)\b/.test(svg)) malformed.push(`${name}: brak grafiki`);

  const hash = createHash("sha256").update(svg).digest("hex");
  if (!hashes.has(hash)) hashes.set(hash, []);
  hashes.get(hash).push(name);
}

const duplicates = [...hashes.entries()]
  .filter(([, names]) => names.length > 1)
  .map(([, names]) => names.sort());

const problems = [];
if (missing.length) problems.push(`brakujące pliki: ${missing.join(", ")}`);
if (unused.length) problems.push(`nieużywane pliki: ${unused.join(", ")}`);
if (malformed.length) problems.push(`niepoprawne SVG:\n${malformed.join("\n")}`);
if (duplicates.length) problems.push(`identyczne SVG:\n${duplicates.map(names => names.join(", ")).join("\n")}`);

console.log(`Ikony przedmiotów: ${files.length}`);
console.log(`Odwołania w źródłach: ${referenced.size}`);
console.log(`Różne zawartości SVG: ${hashes.size}`);

if (problems.length) {
  console.error(`\nBłędy walidacji ikon:\n${problems.join("\n")}`);
  process.exit(1);
}

console.log("Walidacja ikon: OK");
