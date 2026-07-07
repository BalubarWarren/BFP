'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, FileText, ClipboardList, FilePlus, Search,
  Clock, CheckCircle2, ShieldCheck, LogOut,
} from 'lucide-react';
import BFPCrest from './BFPCrest';

export default function Sidebar({ isOpen, user }) {
  const router = useRouter();

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.push('/login');
  };

  const isMarshal = user?.role === 'MARSHAL';
  const isProvincialChiefIIS = user?.role === 'PROVINCIAL_CHIEF_IIS';
  const isInvestigator = user?.role === 'INVESTIGATOR';
  const isMunicipalChiefIIS = user?.role === 'MUNICIPAL_CHIEF_IIS';
  const isMunicipalChiefOperation = user?.role === 'MUNICIPAL_CHIEF_OPERATION';
  const isMunicipalFireMarshal = user?.role === 'MUNICIPAL_FIRE_MARSHAL';
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

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
          <div className="p-6 border-b-2 border-bfp-gold">
            <div className="flex items-center gap-3">
              <BFPCrest size={44} className="flex-shrink-0" />
              <div>
                <h1 className="font-bold text-lg leading-tight tracking-wide">BFP Benguet</h1>
                <p className="text-xs text-bfp-gold tracking-wide uppercase">Incident Reporting</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {/* Provincial Dashboard — MARSHAL */}
              {isMarshal && (
                <>
                  <Link
                    href="/provincial"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Dashboard
                  </Link>
                  <Link
                    href="/provincial/reports"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <FileText className="w-4 h-4 flex-shrink-0" /> Fire Incident Reports
                  </Link>
                </>
              )}

              {/* Provincial Chief IIS */}
              {isProvincialChiefIIS && (
                <>
                  <Link
                    href="/provincial"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Dashboard
                  </Link>
                  <Link
                    href="/provincial/reports"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <FileText className="w-4 h-4 flex-shrink-0" /> Fire Incident Reports
                  </Link>
                </>
              )}

              {/* Municipal Dashboard (INVESTIGATOR) */}
              {isInvestigator && (
                <>
                  <Link
                    href="/municipal"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Dashboard
                  </Link>
                  <Link
                    href="/municipal/reports"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <ClipboardList className="w-4 h-4 flex-shrink-0" /> My Reports
                  </Link>

                  <div className="mt-4 pt-4 border-t border-bfp-gold/30">
                    <p className="text-xs font-semibold uppercase text-white/60 mb-2">
                      Submit Investigation Report
                    </p>
                    <div className="space-y-2">
                      <Link
                        href="/municipal/reports/mdfir"
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                      >
                        <FilePlus className="w-4 h-4 flex-shrink-0" /> MDFIR
                      </Link>
                      <Link
                        href="/municipal/reports/spot"
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                      >
                        <Search className="w-4 h-4 flex-shrink-0" /> Spot Investigation
                      </Link>
                      <Link
                        href="/municipal/reports/progress"
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                      >
                        <Clock className="w-4 h-4 flex-shrink-0" /> Progress Investigation
                      </Link>
                      <Link
                        href="/municipal/reports/final"
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                      >
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Final Investigation
                      </Link>
                    </div>
                  </div>
                </>
              )}

              {(isMunicipalChiefIIS || isMunicipalChiefOperation) && (
                <>
                  <Link
                    href="/municipal/chief"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Chief IIS Dashboard
                  </Link>
                </>
              )}

              {isMunicipalFireMarshal && (
                <>
                  <Link
                    href="/municipal/marshal"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Fire Marshal Dashboard
                  </Link>
                </>
              )}

              {/* Admin — same dashboard as Provincial Chief IIS, plus Report Tracking */}
              {isAdmin && (
                <>
                  <Link
                    href="/provincial"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Dashboard
                  </Link>
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-red transition-colors text-sm font-medium"
                  >
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" /> Report Tracking
                  </Link>
                </>
              )}
            </div>
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-bfp-gold/30">
            <div className="mb-3 pb-3 border-b border-white/15">
              <p className="text-xs text-white/60">Logged in as</p>
              <p className="font-semibold text-sm truncate">{user?.name}</p>
              <p className="text-xs text-white/50">{user?.municipality?.name || 'Provincial'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-bfp-red rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" /> Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
