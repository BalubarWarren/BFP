'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Highlighter } from 'lucide-react';

const PdfAnnotator = dynamic(() => import('./PdfAnnotator'), { ssr: false });

const parseAttachments = (attachments) => {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments;
  try {
    return JSON.parse(attachments);
  } catch {
    return [];
  }
};

const isPdf = (attachment) =>
  attachment.type === 'application/pdf' || attachment.name?.toLowerCase().endsWith('.pdf');

export default function AttachmentList({ attachments, reportId, canAnnotate = false, className = '' }) {
  const [openAttachment, setOpenAttachment] = useState(null);
  const files = parseAttachments(attachments);

  if (!files.length) return null;

  return (
    <>
      <ul className={`space-y-2 text-sm ${className}`}>
        {files.map((attachment) => (
          <li key={attachment.url}>
            {isPdf(attachment) ? (
              <button
                type="button"
                onClick={() => setOpenAttachment(attachment)}
                title={attachment.name}
                className="btn btn-secondary flex w-full items-center justify-start gap-2 px-3 py-2 text-left text-xs"
              >
                <Highlighter className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">
                  {canAnnotate ? 'Review & Annotate' : 'View'}: {attachment.name}
                </span>
              </button>
            ) : (
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                title={attachment.name}
                className="btn btn-secondary flex w-full items-center justify-start gap-2 px-3 py-2 text-left text-xs no-underline"
              >
                <span className="truncate">{attachment.name}</span>
              </a>
            )}
          </li>
        ))}
      </ul>

      {openAttachment && (
        <PdfAnnotator
          attachmentUrl={openAttachment.url}
          attachmentName={openAttachment.name}
          reportId={reportId}
          canAnnotate={canAnnotate}
          onClose={() => setOpenAttachment(null)}
        />
      )}
    </>
  );
}
