import { TEXT_BLAST_BLUE, TEXT_BLAST_HIGHLIGHT } from '../../lib/text-blast';

// Shows a text blast's formatted lines (see lib/text-blast.js) in the notification list. Each run
// is rendered as a plain text <span> with only the three allowed styles, so nothing typed into
// the blast can become markup. The email version is textBlastLinesHtml in lib/email.js.
export const textBlastRunStyle = (run) => ({
  ...(run.b ? { fontWeight: 700 } : {}),
  ...(run.c === 'blue' ? { color: TEXT_BLAST_BLUE } : {}),
  ...(run.h ? { backgroundColor: TEXT_BLAST_HIGHLIGHT, borderRadius: 2 } : {}),
});

export default function TextBlastContent({ lines, className = '' }) {
  if (!lines?.length) return null;
  return (
    <div className={`text-sm text-gray-700 break-words ${className}`}>
      {lines.map((line, index) => (
        <div key={index} className="min-h-[1.25rem]">
          {line.map((run, runIndex) => (
            <span key={runIndex} style={textBlastRunStyle(run)}>{run.t}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
