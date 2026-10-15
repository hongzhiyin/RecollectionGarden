export interface TextIndex {
  root: HTMLElement;
  text: string;
  runs: { node: Text; start: number; end: number }[];
}

function length(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent?.length ?? 0;
  if (node.nodeName === 'BR') return 1;
  return Array.from(node.childNodes).reduce((sum, child) => sum + length(child), 0);
}

export function indexText(root: HTMLElement): TextIndex {
  const runs: TextIndex['runs'] = [];
  let text = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const start = text.length; text += node.textContent ?? '';
      runs.push({ node: node as Text, start, end: text.length });
    } else if (node.nodeName === 'BR') text += '\n';
    else node.childNodes.forEach(walk);
  };
  walk(root); return { root, runs, text };
}

function offsetOf(index: TextIndex, target: Node, offset: number) {
  if (!index.root.contains(target)) return null;
  let total = 0;
  let found: number | null = null;
  const walk = (node: Node) => {
    if (found !== null) return;
    if (node === target) {
      found = total + (node.nodeType === Node.TEXT_NODE ? offset
        : Array.from(node.childNodes).slice(0, offset).reduce((sum, child) => sum + length(child), 0));
    } else if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') total += length(node);
    else node.childNodes.forEach(walk);
  };
  walk(index.root); return found;
}

export function selectedOffsets(index: TextIndex, selection: Selection | null) {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null;
  const range = selection.getRangeAt(0);
  const start = offsetOf(index, range.startContainer, range.startOffset);
  const end = offsetOf(index, range.endContainer, range.endOffset);
  if (start === null || end === null || end <= start || !index.text.slice(start, end).trim()) return null;
  return { start, end };
}

export function rangeRects(index: TextIndex, start: number, end: number) {
  const bounds = index.root.getBoundingClientRect();
  const rectangles = index.runs.filter(run => run.end > start && run.start < end).flatMap(run => {
    const range = document.createRange();
    range.setStart(run.node, Math.max(0, start - run.start));
    range.setEnd(run.node, Math.min(run.end, end) - run.start);
    return Array.from(range.getClientRects());
  });
  return rectangles.filter(rect => rect.width > .1 && rect.height > .1).map(rect => ({
    left: rect.left - bounds.left, top: rect.top - bounds.top, width: rect.width, height: rect.height,
  }));
}
