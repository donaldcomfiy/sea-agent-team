import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// LLMs often omit the blank lines Markdown needs, so a "**Position 2**" line
// right after a list gets absorbed into the previous list item. Insert blank
// lines before/after standalone heading lines (ATX `#...` or a fully-bold line).
function normalizeMarkdown(src: string): string {
  const lines = src.split('\n');
  const out: string[] = [];
  const isHeader = (s: string) => /^#{1,6}\s/.test(s) || /^\*\*[^*].*\*\*$/.test(s);
  for (let i = 0; i < lines.length; i++) {
    if (isHeader(lines[i].trim())) {
      if (out.length && out[out.length - 1].trim() !== '') out.push('');
      out.push(lines[i]);
      if (i + 1 < lines.length && lines[i + 1].trim() !== '') out.push('');
    } else {
      out.push(lines[i]);
    }
  }
  return out.join('\n');
}

interface ParsedBlock {
  type: 'markdown' | 'details';
  summary?: string;
  content: string;
}

function parseDetailsBlocks(text: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];
  let remaining = text;

  while (remaining) {
    const detailsStart = remaining.indexOf('<details>');
    if (detailsStart === -1) {
      blocks.push({ type: 'markdown', content: remaining });
      break;
    }

    if (detailsStart > 0) {
      blocks.push({ type: 'markdown', content: remaining.slice(0, detailsStart) });
      remaining = remaining.slice(detailsStart);
    }

    // Now remaining starts with "<details>"
    const summaryStart = remaining.indexOf('<summary>');
    const summaryEnd = remaining.indexOf('</summary>');
    let summary = 'Details';
    let bodyStartIdx = 9; // length of "<details>"

    if (summaryStart !== -1 && summaryEnd !== -1 && summaryStart < summaryEnd) {
      summary = remaining.slice(summaryStart + 9, summaryEnd);
      bodyStartIdx = summaryEnd + 10; // length of "</summary>"
    }

    const detailsEnd = remaining.indexOf('</details>');
    if (detailsEnd === -1) {
      // Incomplete/streaming details block
      const bodyContent = remaining.slice(bodyStartIdx);
      blocks.push({ type: 'details', summary, content: bodyContent });
      break;
    } else {
      const bodyContent = remaining.slice(bodyStartIdx, detailsEnd);
      blocks.push({ type: 'details', summary, content: bodyContent });
      remaining = remaining.slice(detailsEnd + 10); // length of "</details>"
    }
  }

  return blocks;
}

// Renders agent output as Markdown (GFM). Tolerates partial Markdown while streaming.
export function Markdown({ text }: { text: string }) {
  const blocks = parseDetailsBlocks(text);

  return (
    <div className="md">
      {blocks.map((block, idx) => {
        if (block.type === 'details') {
          return (
            <details key={idx} className="custom-details">
              <summary className="custom-summary">{block.summary}</summary>
              <div className="details-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {normalizeMarkdown(block.content)}
                </ReactMarkdown>
              </div>
            </details>
          );
        }
        return (
          <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
            {normalizeMarkdown(block.content)}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}
