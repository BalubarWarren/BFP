'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

// Opens a report when the page is loaded with `?open=<reportId>` (how notifications link to a
// specific report, see lib/notification-target.js). Waits until `ready` (e.g. the page's list has
// loaded), calls `onOpen(id)` once, then drops the parameter from the URL so a refresh doesn't
// reopen it and clicking the same notification again works.
export function useOpenReportParam(onOpen, ready = true) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const openId = parseInt(searchParams.get('open'), 10);

  useEffect(() => {
    if (!ready || !(openId > 0)) return;
    router.replace(pathname);
    onOpen(openId);
    // onOpen is recreated every render; the id and readiness are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, ready]);
}
