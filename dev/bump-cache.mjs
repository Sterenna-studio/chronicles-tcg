#!/usr/bin/env node
// dev/bump-cache.mjs — stamp a single shared ?v=<N> on every LOCAL module import
// across all .js/.html files, so the browser refetches changed ES modules.
//
// Usage:
//   node dev/bump-cache.mjs           # auto-increment the current version
//   node dev/bump-cache.mjs 7         # set an explicit version
//
// Why a script: the version MUST be identical on every import of a given file,
// otherwise the browser loads the module twice (two URLs = two instances) and
// singletons like the Supabase client in logic/supaRaw.js break.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
// NB: do NOT skip data/ — it holds .js repo modules, only its JSON is ignored (EXTS filter).
const SKIP_DIRS = new Set(['node_modules', '.git', 'assets', 'sounds']);
const EXTS = new Set(['.js', '.html']);

// Matches: from '<local>.js'  /  import('<local>.js')  (with optional existing ?v=)
// Captures the path so we can re-stamp it. Only local paths (./ or ../).
const IMPORT_RE = /((?:from|import)\s*\(?\s*['"])(\.\.?\/[^'"?]+\.js)(?:\?v=\d+)?(['"])/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(name))) out.push(full);
  }
  return out;
}

// Resolve target version
const arg = process.argv[2];
let version;
if (arg !== undefined) {
  version = parseInt(arg, 10);
  if (!Number.isFinite(version)) { console.error('Version must be a number'); process.exit(1); }
} else {
  // Auto: find current max ?v=N in the tree, add 1 (default 1 if none)
  let max = 0;
  for (const file of walk(ROOT)) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/\?v=(\d+)/g)) max = Math.max(max, parseInt(m[1], 10));
  }
  version = max + 1;
}

let filesChanged = 0, importsStamped = 0;
for (const file of walk(ROOT)) {
  const src = readFileSync(file, 'utf8');
  let count = 0;
  const next = src.replace(IMPORT_RE, (_, pre, path, quote) => {
    count++;
    return `${pre}${path}?v=${version}${quote}`;
  });
  if (next !== src) { writeFileSync(file, next); filesChanged++; importsStamped += count; }
  else if (count) importsStamped += count; // already at this version
}

console.log(`Cache version = ${version} — ${importsStamped} local imports across ${filesChanged} changed file(s).`);
