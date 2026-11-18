'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';

// On an investigator's report row: marks a report someone else submitted that this investigator
// co-edits by approved Letter of Order (lib/report-requests.js).
export default function SharedReportBadge({ report }) {
  const [myId, setMyId] = useState(null);

  useEffect(() => {
    try {
      setMyId(JSON.parse(sessionStorage.getItem('user') || 'null')?.id ?? null);
    } catch {
      setMyId(null);
    }
  }, []);

  if (!myId || !report?.submittedById || report.submittedById === myId) return null;

  return (
    <span
      className="mt-1 inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
      title={`Submitted by ${report.submittedBy?.name || 'another investigator'}; you co-edit it by Letter of Order`}
    >
      <Users className="h-3 w-3" /> Shared by {report.submittedBy?.name || 'another investigator'}
    </span>
  );
}
