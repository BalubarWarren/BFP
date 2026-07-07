'use client';

import { useRouter } from 'next/navigation';

export default function SessionExpiredBanner() {
  const router = useRouter();

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="flex items-center justify-between gap-4 bg-bfp-red/10 border border-bfp-red text-bfp-red px-4 py-3 rounded-lg">
      <span className="text-sm font-semibold">
        Your session is out of date or no longer has access to this page. Please log out and log back in.
      </span>
      <button onClick={handleLogout} className="btn btn-danger text-sm py-1 px-3 flex-shrink-0">
        Log Out
      </button>
    </div>
  );
}
