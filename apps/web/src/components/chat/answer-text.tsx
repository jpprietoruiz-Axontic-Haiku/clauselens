import type { CitationSource } from "@/lib/chat-types";

const CITATION_MARKER_RE = /(\[\d+\])/g;

interface AnswerTextProps {
  text: string;
  sources: CitationSource[];
  onCite: (source: CitationSource) => void;
}

/**
 * Renders the model's answer, converting each "[n]" marker (which the
 * prompt itself asks it to use) into a clickable button to the n-th source
 * fragment. Works just as well mid-stream: at any point in time, the
 * accumulated text so far is split.
 */
export function AnswerText({ text, sources, onCite }: AnswerTextProps) {
  const segments = text.split(CITATION_MARKER_RE);

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {segments.map((segment, index) => {
        const match = /^\[(\d+)\]$/.exec(segment);
        if (!match) {
          return segment.length > 0 ? <span key={index}>{segment}</span> : null;
        }

        const citationNumber = Number(match[1]);
        const source = sources[citationNumber - 1];
        if (!source) {
          // The model cited an out-of-range number: shown as plain text.
          return <span key={index}>{segment}</span>;
        }

        return (
          <button
            key={index}
            type="button"
            onClick={() => {
              onCite(source);
            }}
            className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary align-text-top hover:bg-primary/20"
            title={source.articleRef ?? source.documentTitle}
          >
            {citationNumber}
          </button>
        );
      })}
    </p>
  );
}
