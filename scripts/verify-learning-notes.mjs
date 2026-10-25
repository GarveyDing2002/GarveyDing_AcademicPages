import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';

const manifest = JSON.parse(readFileSync('content-import-manifest.json', 'utf8'));
const source = process.argv[2];
const base = '/GarveyDing_AcademicPages';
const cache = new Map();
function inspect(file) {
  if (cache.has(file)) return cache.get(file);
  const result = { ids: new Set(), links: [], math: 0, mathErrors: [], diagrams: 0, tables: 0, mail: [] };
  const html = readFileSync(file, 'utf8');
  function walk(node) {
    const attrs = Object.fromEntries((node.attrs ?? []).map(attr => [attr.name, attr.value]));
    const classes = (attrs.class ?? '').split(/\s+/);
    if (attrs.id) result.ids.add(attrs.id);
    if (classes.includes('katex')) result.math++;
    if (classes.includes('katex-error')) result.mathErrors.push(attrs.title);
    if (classes.includes('mermaid-diagram')) result.diagrams++;
    if (node.tagName === 'table') result.tables++;
    for (const value of [attrs.href, attrs.src]) {
      if (!value) continue;
      if (value.startsWith('mailto:')) result.mail.push(value);
      else if (value.startsWith('#') || value.startsWith(`${base}/`)) result.links.push(value);
      assert.ok(!/^(zotero|obsidian|file):/.test(value), `${file}: local-only link ${value}`);
    }
    for (const child of node.childNodes ?? []) walk(child);
  }
  walk(parse(html));
  cache.set(file, result);
  return result;
}

let math = 0;
let diagrams = 0;
let tables = 0;
let links = 0;
const mathErrors = [];
for (const note of manifest.notes) {
  const file = path.resolve('dist/blog', note.slug, 'index.html');
  const result = inspect(file);
  math += result.math;
  diagrams += result.diagrams;
  tables += result.tables;
  mathErrors.push(...result.mathErrors.map(error => `${note.slug}: ${error}`));
  assert.ok(result.mail.includes('mailto:dingjiawei0616@gmail.com'), `${note.slug}: missing contact email`);
  for (const link of result.links) {
    const resolved = new URL(link, `https://site.invalid${base}/blog/${note.slug}/`);
    let target = path.resolve('dist', decodeURIComponent(resolved.pathname.slice(base.length + 1)));
    if (existsSync(target) && statSync(target).isDirectory()) target = path.join(target, 'index.html');
    assert.ok(existsSync(target), `${note.slug}: broken URL ${link}`);
    if (resolved.hash && target.endsWith('.html')) {
      assert.ok(inspect(target).ids.has(decodeURIComponent(resolved.hash.slice(1))), `${note.slug}: broken anchor ${link}`);
    }
    links++;
  }
  if (source) {
    const original = readFileSync(path.join(source, note.source));
    assert.equal(createHash('sha256').update(original).digest('hex'), note.sourceSha256, `Source changed: ${note.source}`);
  }
}
for (const asset of manifest.assets) {
  assert.ok(existsSync(asset.destination), `Missing asset ${asset.destination}`);
  if (source) {
    const original = readFileSync(path.join(source, asset.source));
    assert.equal(createHash('sha256').update(original).digest('hex'), asset.sourceSha256, `Source asset changed: ${asset.source}`);
  }
}
assert.equal(diagrams, manifest.counts.diagrams);
assert.ok(math > 0, 'Math did not render');
assert.ok(tables > 0, 'Tables did not render');
assert.deepEqual(mathErrors, [], 'Invalid LaTeX formulas');
console.log(JSON.stringify({ notes: manifest.notes.length, assets: manifest.assets.length, math, diagrams, tables, links, sourceUnchanged: !!source }, null, 2));
