'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '../../components/common/Sidebar';
import Header from '../../components/common/Header';
import { ToastProvider } from '../../components/common/ToastProvider';
import SessionManager from '../../components/common/SessionManager';
import { requestSessionFromOtherTabs, redirectToLogin } from '../../lib/session';
import { ROLE_HOME_PATH, isRouteAllowedForRole } from '../../lib/constants';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Only matters below the lg breakpoint, where the sidebar becomes a slide-out menu; on wider
  // screens it is always shown (see the lg: classes in Sidebar). Starts closed so a phone or a
  // narrow window isn't covered by the menu on every page load.
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close the slide-out menu after navigating to another page.
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      // A new tab (e.g. opened from a notification email) starts with no session of its own —
      // borrow the one from another open, logged-in tab before deciding the user is logged out.
      if (!sessionStorage.getItem('token') || !sessionStorage.getItem('user')) {
        await requestSessionFromOtherTabs();
        if (cancelled) return;
      }

      const token = sessionStorage.getItem('token');
      const userData = sessionStorage.getItem('user');

      if (!token || !userData) {
        redirectToLogin();
        return;
      }

      try {
        const parsedUser = JSON.parse(userData);

        // The URL may not belong to this user's role (e.g. a stale tab from a previous
        // session, or a different account logged in on this browser before). Bounce back
        // to that role's own dashboard instead of rendering the wrong one.
        if (!isRouteAllowedForRole(parsedUser.role, pathname)) {
          router.replace(ROLE_HOME_PATH[parsedUser.role] || '/login');
          return;
        }

        setUser(parsedUser);
      } catch (error) {
        console.error('Failed to parse user data:', error);
        redirectToLogin();
        return;
      }

      setLoading(false);
    };

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-bfp-red"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <SessionManager onUserChange={setUser} />
      <div className="app-shell flex bg-gray-50">
        {/* Sidebar */}
        <Sidebar isOpen={isSidebarOpen} user={user} onClose={() => setIsSidebarOpen(false)} />

        {/* Main Content — min-w-0 lets it shrink with the window instead of overflowing it */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Header */}
          <Header
            user={user}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />

          {/* Content Area */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
