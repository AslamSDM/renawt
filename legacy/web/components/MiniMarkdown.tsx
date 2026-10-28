import React from "react";

/**
 * Tiny markdown renderer for the casual posts in /posts.
 * Handles paragraphs, **bold**, *italic*, `code`, ## headings, and a
 * trailing #hashtag line (rendered as tags). No external dependency.
 */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Split on **bold**, *italic*, and `code`, keeping delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="font-medium text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={key} className="font-serif-italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={key}
          className="rounded-sm border border-rule px-1.5 py-0.5 text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export function MiniMarkdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);

  return (
    <div className="space-y-6 text-lg leading-relaxed text-ink/85">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        const key = `b-${i}`;

        // Hashtag line → tag chips
        if (/^#\w/.test(trimmed) && /^#[\w\s#]+$/.test(trimmed)) {
          const tags = trimmed.split(/\s+/).filter(Boolean);
          return (
            <div key={key} className="flex flex-wrap gap-2 pt-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="mono-tick rounded-sm border border-rule px-2 py-1"
                >
                  {t}
                </span>
              ))}
            </div>
          );
        }

        // ## heading
        const h = trimmed.match(/^(#{2,3})\s+(.*)$/);
        if (h) {
          return (
            <h2
              key={key}
              className="font-serif-italic text-2xl text-ink"
            >
              {renderInline(h[2], key)}
            </h2>
          );
        }

        return <p key={key}>{renderInline(trimmed, key)}</p>;
      })}
    </div>
  );
}
