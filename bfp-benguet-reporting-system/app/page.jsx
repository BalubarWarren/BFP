'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_HOME_PATH } from '../lib/constants';
import LandingPage from '../components/common/LandingPage';
import { requestSessionFromOtherTabs } from '../lib/session';

export default function Home() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Already signed in (in this tab, or in another open tab — e.g. this tab was opened from a
    // notification email)? Skip the landing page and go straight to the dashboard.
    const checkSession = async () => {
      if (!sessionStorage.getItem('token')) await requestSessionFromOtherTabs();
      if (cancelled) return;

      const token = sessionStorage.getItem('token');
      const user = sessionStorage.getItem('user');

      if (token && user) {
        const userData = JSON.parse(user);
        router.push(ROLE_HOME_PATH[userData.role] || '/provincial');
      } else {
        setCheckingSession(false);
      }
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingSession) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-bfp-red"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <LandingPage />;
}
