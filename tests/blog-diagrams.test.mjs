import assert from 'node:assert/strict';
import { test } from 'node:test';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkDiagrams from '../src/lib/remark-diagrams.mjs';

test('Mermaid labels containing parentheses render as quoted labels and HTML stays escaped', async () => {
  const processor = unified().use(remarkParse).use(remarkDiagrams);
  const tree = await processor.run(processor.parse('```mermaid\nflowchart LR\nA[Input x(t)] --> B[<script>alert(1)</script>]\n```'));
  assert.equal(tree.children[0].type, 'html');
  assert.ok(tree.children[0].value.includes('A["Input x(t)"]'));
  assert.ok(tree.children[0].value.includes('&lt;script&gt;'));
  assert.ok(!tree.children[0].value.includes('<script>'));
});

test('ordinary code blocks stay code rather than becoming executable diagrams', async () => {
  const processor = unified().use(remarkParse).use(remarkDiagrams);
  const tree = await processor.run(processor.parse('```text\nA[Input x(t)]\n```'));
  assert.equal(tree.children[0].type, 'code');
  assert.equal(tree.children[0].value, 'A[Input x(t)]');
});
