export interface ParsedContent {
  markdown: string;
  cards: any[];
}

// Splits an agent message into prose (Markdown) and structured cards. Agents
// append a ```json block carrying a "type" discriminator; we extract those and
// render them as rich components. Tolerant while streaming: an unclosed ```json
// fence is hidden until it completes, and invalid JSON is dropped.
export function parseContent(text: string): ParsedContent {
  const cards: any[] = [];
  const fence = /```json\s*([\s\S]*?)```/g;
  let md = '';
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text)) !== null) {
    md += text.slice(lastIndex, m.index);
    try {
      const obj = JSON.parse(m[1].trim());
      if (obj && typeof obj === 'object' && obj.type) cards.push(obj);
      else md += m[0]; // parsed but no known shape -> leave the block as-is
    } catch {
      // incomplete / invalid -> drop it from display
    }
    lastIndex = fence.lastIndex;
  }
  let rest = text.slice(lastIndex);
  const open = rest.indexOf('```json');
  if (open !== -1) rest = rest.slice(0, open); // hide a still-streaming block
  md += rest;
  return { markdown: md.trim(), cards };
}
