import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import { toString } from 'mdast-util-to-string';
import GithubSlugger from 'github-slugger';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Usage: node scripts/import-learning-notes.mjs <source-folder> [--write]');
const write = process.argv.includes('--write');
const base = '/GarveyDing_AcademicPages';
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
const plainParser = unified().use(remarkParse).use(remarkGfm);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const posix = (value) => value.replaceAll('\\', '/');
const normalize = (value) => posix(value).replace(/\.md$/i, '').normalize('NFC');
const slugs = new Map([
  ['电路零极点：原理、分析与稳定性', 'circuit-poles-and-zeros'],
  ['电路噪声：从 MOS 器件到系统设计', 'circuit-noise'],
  ['学习记录索引', 'learning-records'],
  ['ADC 架构：分类、比较与选型', 'adc-architectures'],
  ['ADC 数据输出接口：架构与设计', 'adc-data-interfaces'],
  ['CLS 技术：原理、变种与设计', 'correlated-level-shifting'],
  ['Dither-Based Calibration：原理、架构与建模', 'dither-calibration'],
  ['PVT 对 MOS 管性能参数的影响', 'mos-pvt'],
  ['TI-ADC Time-Skew 校准：原理、方法与演进', 'ti-adc-time-skew'],
  ['TSMC 28 nm CMOS 片上无源器件：电阻、电容与电感', 'cmos28-passive-devices'],
  ['ADC 比较器：架构、关键指标与设计方法', 'adc-comparators'],
  ['模拟集成电路偏置电路', 'analog-bias-circuits'],
  ['ADC Reference Buffer：架构与设计', 'adc-reference-buffer'],
  ['Bandgap 基准源：架构与设计', 'bandgap-reference'],
  ['高速 ADC Input Buffer：原理、架构与设计方法', 'high-speed-adc-input-buffer'],
]);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.')) return [];
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
  });
}

function normalizeDisplayMath(body) {
  const code = [];
  visit(plainParser.parse(body), node => {
    if (node.type === 'code' || node.type === 'inlineCode') code.push([node.position.start.offset, node.position.end.offset]);
  });
  return body.replace(/\$\$([\s\S]*?)\$\$/g, (match, expression, offset) => {
    if (code.some(([start, end]) => offset >= start && offset < end)) return match;
    return `\n$$\n${expression.trim()}\n$$\n`;
  });
}

const files = walk(source);
const notes = files.filter(file => file.endsWith('.md')).map(file => {
  const original = readFileSync(file);
  const text = original.toString('utf8').replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
  const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!frontmatter) throw new Error(`Missing metadata: ${file}`);
  const data = parse(frontmatter[1]);
  const body = normalizeDisplayMath(text.slice(frontmatter[0].length));
  const slug = slugs.get(path.basename(file, '.md'));
  if (!slug) throw new Error(`No stable URL configured: ${file}`);
  const tree = parser.parse(body);
  const slugger = new GithubSlugger();
  const headings = new Map();
  visit(tree, 'heading', node => {
    const label = toString(node);
    const id = slugger.slug(label);
    if (!headings.has(label)) headings.set(label, id);
  });
  return { file, original, data, body, slug, tree, headings };
});
const lookup = new Map();
for (const note of notes) {
  for (const key of [posix(path.relative(source, note.file)), path.basename(note.file), note.data.title, ...(note.data.aliases ?? [])]) {
    const normalized = normalize(key);
    if (lookup.has(normalized) && lookup.get(normalized) !== note) throw new Error(`Ambiguous note alias: ${key}`);
    lookup.set(normalized, note);
  }
}
const assets = new Map();
const outputs = new Map();
const counts = { notes: notes.length, images: 0, attachments: 0, diagrams: 0, links: 0, localLibraryLinks: 0 };

function assetUrl(target, note) {
  const relative = path.resolve(path.dirname(note.file), target);
  const candidates = files.includes(relative) ? [relative] : files.filter(file => path.basename(file) === target);
  if (candidates.length !== 1) throw new Error(`Missing or ambiguous attachment: ${target} in ${note.slug}`);
  const file = candidates[0];
  if (!assets.has(file)) {
    const name = path.basename(file);
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) throw new Error(`Attachment needs a web-safe name: ${name}`);
    const destination = `public/images/blog/learning-notes/${note.slug}/${name}`;
    const url = `${base}/${destination.slice('public/'.length)}`;
    assets.set(file, { file, destination, url, originalHash: hash(readFileSync(file)) });
    if (/\.(png|jpe?g|svg|webp|gif)$/i.test(name)) counts.images++;
    else counts.attachments++;
  }
  return assets.get(file).url;
}

function resolveWiki(value, note, embed = false) {
  const [targetAndHeading, alias] = value.split('|');
  const [target, heading] = targetAndHeading.split('#');
  const key = normalize(target).replace(new RegExp(`^${path.basename(source)}/`), '');
  const found = target ? lookup.get(key) : note;
  if (found) {
    if (embed) throw new Error(`Note embeds require an explicit conversion: ${value}`);
    const anchor = heading ? found.headings.get(heading) : '';
    if (heading && !anchor) throw new Error(`Missing heading: ${value} in ${note.slug}`);
    counts.links++;
    return `[${alias || heading || found.data.title}](${target ? `${base}/blog/${found.slug}/` : ''}${anchor ? `#${anchor}` : ''})`;
  }
  const url = assetUrl(target, note);
  const label = alias && !/^\d+(x\d+)?$/.test(alias) ? alias : path.basename(target, path.extname(target));
  return `${embed ? '!' : ''}[${label}](${url})`;
}

function convert(note) {
  const changes = [];
  const protectedRanges = [];
  visit(note.tree, node => {
    if (['code', 'inlineCode', 'math', 'inlineMath'].includes(node.type)) {
      protectedRanges.push([node.position.start.offset, node.position.end.offset]);
      if (node.type === 'code' && node.lang === 'mermaid') counts.diagrams++;
    }
    if (node.type === 'link' && /^(zotero|obsidian|file):/i.test(node.url)) {
      changes.push({ start: node.position.start.offset, end: node.position.end.offset, text: toString(node) });
      counts.localLibraryLinks++;
    }
  });
  const isProtected = (offset) => protectedRanges.some(([start, end]) => offset >= start && offset < end);
  const replace = (pattern, render) => {
    for (const match of note.body.matchAll(pattern)) {
      if (!isProtected(match.index)) changes.push({ start: match.index, end: match.index + match[0].length, text: render(match) });
    }
  };
  replace(/(!?)\[\[([^\]\n]+)\]\]/g, m => resolveWiki(m[2], note, !!m[1]));
  replace(/^([ \t]*>[ \t]*)\[![\w-]+\][+-]?\s*([^\n]*)$/gm, m => `${m[1]}**${m[2] || 'Note'}**`);
  replace(/%%[\s\S]*?%%/g, () => '');
  const first = note.tree.children.find(node => node.type !== 'thematicBreak');
  if (first?.type === 'heading' && first.depth === 1) changes.push({ start: first.position.start.offset, end: first.position.end.offset, text: '' });
  changes.sort((a, b) => b.start - a.start);
  let previousStart = note.body.length;
  let body = note.body;
  for (const change of changes) {
    if (change.end > previousStart) throw new Error(`Overlapping Markdown conversions in ${note.slug}`);
    body = body.slice(0, change.start) + change.text + body.slice(change.end);
    previousStart = change.start;
  }
  if (note.data.related?.length) body += `\n\n## 相关笔记\n\n${note.data.related.map(link => `- ${resolveWiki(link.slice(2, -2), note)}`).join('\n')}\n`;
  const firstQuote = note.tree.children.find(node => node.type === 'blockquote');
  const description = firstQuote ? toString(firstQuote).replace(/^\[![^\]]+\][+-]?[^\n]*\n?/, '') : '';
  const excerpt = (description || note.data.title).replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, '$2$1').replace(/\s+/g, ' ').trim().slice(0, 180);
  const date = new Date(note.data.date ?? note.data.created ?? note.data.updated);
  if (Number.isNaN(date.getTime())) throw new Error(`Missing date: ${note.slug}`);
  return `---\n${stringify({ title: note.data.title, date: date.toISOString().slice(0, 10), excerpt, tags: note.data.tags ?? ['学习记录'] })}---\n\n${body.trim()}\n`;
}

for (const note of notes) outputs.set(`src/content/BlogPosts/${note.slug}.md`, Buffer.from(convert(note)));
// Publish bibliographic provenance, not machine-specific PDF paths or library IDs.
for (const asset of assets.values()) {
  let content = readFileSync(asset.file);
  if (path.basename(asset.file) === 'figure_sources.json') {
    const publicSources = JSON.parse(content.toString()).map(entry => ({
      file: assetUrl(path.basename(entry.file), notes.find(note => note.slug === 'high-speed-adc-input-buffer')),
      title: entry.title,
      DOI: entry.DOI,
      pdf_page: entry.pdf_page,
      original_figure: entry.original_figure,
      crop_normalized: entry.crop_normalized,
    }));
    content = Buffer.from(JSON.stringify(publicSources, null, 2) + '\n');
  }
  outputs.set(asset.destination, content);
}

const manifest = {
  notes: notes.map(note => ({ source: posix(path.relative(source, note.file)), slug: note.slug, sourceSha256: hash(note.original) })),
  assets: [...assets.values()].map(asset => ({ source: posix(path.relative(source, asset.file)), destination: asset.destination, sourceSha256: asset.originalHash })),
  counts,
};
outputs.set('content-import-manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
for (const [relative, content] of outputs) {
  const target = path.join(repo, relative);
  if (existsSync(target) && !readFileSync(target).equals(content)) throw new Error(`Refusing to overwrite changed content: ${relative}`);
}
if (write) for (const [relative, content] of outputs) {
  const target = path.join(repo, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}
for (const note of notes) if (hash(readFileSync(note.file)) !== hash(note.original)) throw new Error(`Source changed during import: ${note.slug}`);
console.log(JSON.stringify({ mode: write ? 'written' : 'dry-run', ...counts, outputFiles: outputs.size }, null, 2));
