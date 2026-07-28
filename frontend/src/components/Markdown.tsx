import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// =============================================================================
// Minimal markdown renderer.
//
// The RAG prompt explicitly asks the model for "short headings and bullet
// points", so answers reliably come back as markdown. The chat view used to
// print them raw inside `whitespace-pre-wrap`, so users saw literal `##`, `-`
// and `**` characters in every generated note.
//
// This is deliberately not a full CommonMark implementation — it covers what
// the model actually emits (headings, lists, fenced code, inline emphasis) and
// nothing else. Written by hand rather than pulling react-markdown because this
// network's TLS interception makes package installs unreliable.
// =============================================================================

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'h'; level: number; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'quote'; text: string };

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // Fenced code
    const fence = line.match(/^```\s*(\S*)/);
    if (fence) {
      const lang = fence[1] || '';
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence
      blocks.push({ kind: 'code', lang, code: body.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'h', level: heading[1].length, text: heading[2].trim() });
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', text: body.join(' ') });
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*[-*+]\s+/, ''));
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    // Paragraph — consume until a blank line or the start of another block.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^```/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    blocks.push({ kind: 'p', text: para.join(' ') });
  }

  return blocks;
}

/** Inline emphasis. Code is matched first so `**` inside a span stays literal. */
function inline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*)/g);
  return parts.filter(Boolean).map((part, k) => {
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code
          key={k}
          className="font-mono text-[0.86em] bg-surface-sunk text-accent-ink px-1.5 py-0.5 rounded-sm"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={k} className="font-semibold text-content">{part.slice(2, -2)}</strong>;
    }
    if (/^__[^_]+__$/.test(part)) {
      return <strong key={k} className="font-semibold text-content">{part.slice(2, -2)}</strong>;
    }
    if (/^\*[^*\n]+\*$/.test(part)) {
      return <em key={k}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={k}>{part}</React.Fragment>;
  });
}

const CodeBlock: React.FC<{ lang: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard can be blocked by permissions; still show feedback so the
      // button never looks dead.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="rounded-md overflow-hidden border border-line bg-ink-900 dark:bg-ink-950 my-3">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10">
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-400">
          {lang || 'code'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 text-[11px] text-ink-400 hover:text-white
            px-1.5 py-0.5 rounded-sm transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3">
        <code className="font-mono text-[12.5px] leading-relaxed text-ink-100 whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
};

const HEADING_SIZE: Record<number, string> = {
  1: 'text-[17px] mt-4',
  2: 'text-[15.5px] mt-4',
  3: 'text-[14.5px] mt-3',
  4: 'text-[13.5px] mt-3',
  5: 'text-[13px] mt-3',
  6: 'text-[13px] mt-3',
};

export const Markdown: React.FC<{ children: string; className?: string }> = ({
  children,
  className = '',
}) => {
  const blocks = parse(children);

  return (
    <div className={`text-[14.5px] leading-relaxed text-content-body ${className}`}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h': {
            const Tag = (`h${Math.min(b.level + 2, 6)}`) as keyof JSX.IntrinsicElements;
            return (
              <Tag
                key={i}
                className={`font-semibold text-content first:mt-0 mb-1.5 ${HEADING_SIZE[b.level]}`}
              >
                {inline(b.text)}
              </Tag>
            );
          }
          case 'ul':
            return (
              <ul key={i} className="list-disc pl-5 my-2 flex flex-col gap-1 marker:text-content-disabled">
                {b.items.map((it, k) => <li key={k}>{inline(it)}</li>)}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="list-decimal pl-5 my-2 flex flex-col gap-1 marker:text-content-muted">
                {b.items.map((it, k) => <li key={k}>{inline(it)}</li>)}
              </ol>
            );
          case 'code':
            return <CodeBlock key={i} lang={b.lang} code={b.code} />;
          case 'quote':
            return (
              <blockquote
                key={i}
                className="border-l-2 border-accent pl-3 my-3 text-content-muted italic"
              >
                {inline(b.text)}
              </blockquote>
            );
          default:
            return <p key={i} className="my-2 first:mt-0 last:mb-0">{inline(b.text)}</p>;
        }
      })}
    </div>
  );
};
