'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Sidebar({ isOpen, user }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const isMarshal = user?.role === 'MARSHAL';
  const isInvestigator = user?.role === 'INVESTIGATOR';
  const isViewer = user?.role === 'VIEWER';

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40"></div>
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar fixed left-0 top-0 h-screen w-64 transform transition-transform duration-300 overflow-y-auto z-50 lg:relative lg:transform-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-blue-700">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚒</span>
              <div>
                <h1 className="font-bold text-lg">BFP Benguet</h1>
                <p className="text-xs text-blue-200">Incident Reporting</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {/* Provincial Dashboard (MARSHAL & VIEWER) */}
              {(isMarshal || isViewer) && (
                <>
                  <Link
                    href="/provincial"
                    className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    📊 Dashboard
                  </Link>
                  <Link
                    href="/provincial/reports"
                    className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    📋 All Reports
                  </Link>
                </>
              )}

              {/* Municipal Dashboard (INVESTIGATOR) */}
              {isInvestigator && (
                <>
                  <Link
                    href="/municipal"
                    className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    📊 Dashboard
                  </Link>
                  <Link
                    href="/municipal/reports"
                    className="block px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    📋 My Reports
                  </Link>

                  <div className="mt-4 pt-4 border-t border-blue-700">
                    <p className="text-xs font-semibold uppercase text-blue-200 mb-2">
                      Submit Investigation Report
                    </p>
                    <div className="space-y-2">
                      <Link
                        href="/municipal/reports/spot"
                        className="block px-4 py-2 bg-blue-700 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                      >
                        🔍 Spot Investigation
                      </Link>
                      <Link
                        href="/municipal/reports/progress"
                        className="block px-4 py-2 bg-blue-700 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                      >
                        ⏳ Progress Investigation
                      </Link>
                      <Link
                        href="/municipal/reports/final"
                        className="block px-4 py-2 bg-blue-700 rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                      >
                        ✅ Final Investigation
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-blue-700">
            <div className="mb-3 pb-3 border-b border-blue-700">
              <p className="text-xs text-blue-200">Logged in as</p>
              <p className="font-semibold text-sm truncate">{user?.name}</p>
              <p className="text-xs text-blue-300">{user?.municipality?.name || 'Provincial'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
