'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { X, Trash2 } from 'lucide-react';
import {
  PdfLoader,
  PdfHighlighter,
  Highlight,
  Popup,
} from 'react-pdf-highlighter';

const PDFJS_VERSION = '4.10.38';
const WORKER_SRC = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

function CommentComposer({ onSave, onCancel }) {
  const [text, setText] = useState('');

  return (
    <div className="w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
      <textarea
        autoFocus
        rows={3}
        className="form-textarea w-full text-sm"
        placeholder="What needs to be corrected here?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn btn-secondary px-3 py-1 text-xs">
          Cancel
        </button>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => onSave(text.trim())}
          className="btn btn-primary px-3 py-1 text-xs"
        >
          Save comment
        </button>
      </div>
    </div>
  );
}

export default function PdfAnnotator({ attachmentUrl, attachmentName, reportId, canAnnotate, onClose }) {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnnotations = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('token');
      const userData = sessionStorage.getItem('user');
      const currentUserId = userData ? JSON.parse(userData).id : null;
      const params = new URLSearchParams({ attachmentUrl });
      const res = await axios.get(`/api/reports/${reportId}/annotations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const mapped = (res.data.annotations || []).map((row) => {
        const parsed = JSON.parse(row.highlightData);
        return {
          id: String(row.id),
          position: parsed.position,
          content: parsed.content,
          comment: { text: row.comment, emoji: '' },
          author: row.author,
          authorIsSelf: row.author?.id === currentUserId,
          createdAt: row.createdAt,
        };
      });
      setHighlights(mapped);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load annotations');
    } finally {
      setLoading(false);
    }
  }, [attachmentUrl, reportId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  const saveAnnotation = async (position, content, comment, hideTipAndSelection) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(
        `/api/reports/${reportId}/annotations`,
        { attachmentUrl, comment, highlightData: { position, content } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      hideTipAndSelection();
      fetchAnnotations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save annotation');
    }
  };

  const deleteAnnotation = async (id) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.delete(`/api/reports/${reportId}/annotations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchAnnotations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete annotation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-bfp-navy">
              {canAnnotate ? 'Review & Annotate' : 'Attachment'}
            </p>
            <h2 className="text-lg font-bold text-gray-900 truncate max-w-md">{attachmentName}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border-b border-red-300 text-red-700 px-4 py-2 text-sm">{error}</div>
        )}

        <div className="flex flex-1 min-h-0">
          <div className="relative flex-1 min-w-0">
            <PdfLoader
              url={attachmentUrl}
              workerSrc={WORKER_SRC}
              beforeLoad={<div className="p-10 text-center text-gray-500">Loading PDF…</div>}
              errorMessage={<div className="p-10 text-center text-red-600">Failed to load PDF.</div>}
            >
              {(pdfDocument) => (
                <PdfHighlighter
                  pdfDocument={pdfDocument}
                  highlights={highlights}
                  enableAreaSelection={() => false}
                  onScrollChange={() => {}}
                  scrollRef={() => {}}
                  onSelectionFinished={(position, content, hideTipAndSelection) => {
                    if (!canAnnotate) return null;
                    return (
                      <CommentComposer
                        onCancel={hideTipAndSelection}
                        onSave={(text) => saveAnnotation(position, content, text, hideTipAndSelection)}
                      />
                    );
                  }}
                  highlightTransform={(highlight, index, setTip, hideTip, viewportToScaled, screenshot, isScrolledTo) => (
                    <Popup
                      key={highlight.id}
                      popupContent={
                        <div className="max-w-xs rounded bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
                          <p className="font-semibold">{highlight.author?.name || 'Reviewer'}</p>
                          <p className="mt-1">{highlight.comment.text}</p>
                        </div>
                      }
                      onMouseOver={(popupContent) => setTip(highlight, () => popupContent)}
                      onMouseOut={hideTip}
                    >
                      <Highlight
                        isScrolledTo={isScrolledTo}
                        position={highlight.position}
                        comment={highlight.comment}
                      />
                    </Popup>
                  )}
                />
              )}
            </PdfLoader>
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                <p className="text-sm text-gray-500">Loading annotations…</p>
              </div>
            )}
          </div>

          <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {canAnnotate ? 'Select text in the PDF to add a correction' : 'Corrections noted by reviewer'}
            </p>
            {highlights.length === 0 ? (
              <p className="text-sm text-gray-500">No comments yet.</p>
            ) : (
              <ul className="space-y-3">
                {highlights.map((h) => (
                  <li key={h.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm shadow-sm">
                    {h.content?.text && (
                      <p className="mb-1 border-l-2 border-bfp-amber pl-2 text-xs italic text-gray-500 line-clamp-3">
                        "{h.content.text}"
                      </p>
                    )}
                    <p className="text-gray-800">{h.comment.text}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                      <span>{h.author?.name || 'Reviewer'}</span>
                      {h.authorIsSelf && (
                        <button onClick={() => deleteAnnotation(h.id)} className="text-gray-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
