import { visit } from 'unist-util-visit';

export default function remarkDiagrams() {
  return tree => {
    visit(tree, 'code', node => {
      if (node.lang !== 'mermaid') return;
      node.type = 'html';
      const source = node.value.replace(/(\b[\w-]+)\[([^\x5b\x5d\n"]+)\]/g, '$1["$2"]');
      const escaped = source.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      node.value = `<pre class="mermaid-diagram" aria-label="Diagram">${escaped}</pre>`;
    });
  };
}
