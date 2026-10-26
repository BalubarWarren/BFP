'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, FileText, ClipboardList, FilePlus, Search,
  Clock, CheckCircle2, ShieldCheck, LogOut, Users, History, Archive, UserCheck, MessageSquare, Trash2,
} from 'lucide-react';
import BFPCrest from './BFPCrest';
import MenuButton from './MenuButton';
import { APPROVED_REPORTS_PATH, canViewApprovedReports, TRASH_PATH, canViewTrash } from '../../lib/constants';
import { clearSession } from '../../lib/session';

export default function Sidebar({ isOpen, isCollapsed, user, onClose, onToggle }) {
  const router = useRouter();

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  // Every role whose ROLE_HOME_PATH/isRouteAllowedForRole (lib/constants.js) points at
  // /provincial — including the legacy/regional roles that previously had no sidebar links
  // at all once logged in.
  const PROVINCIAL_DASHBOARD_ROLES = [
    'MARSHAL',
    'PROVINCIAL_CHIEF_IIS',
    'CHIEF_INVESTIGATOR_IIS',
    'PROVINCIAL_CHIEF_INVESTIGATOR',
    'REGION_IIS',
    'REGIONAL_CHIEF_OPERATION',
    'PIO',
  ];
  const isProvincialDashboardRole = PROVINCIAL_DASHBOARD_ROLES.includes(user?.role);
  const isInvestigator = user?.role === 'INVESTIGATOR';
  const isMunicipalChiefIIS = user?.role === 'MUNICIPAL_CHIEF_IIS';
  const isMunicipalChiefOperation = user?.role === 'MUNICIPAL_CHIEF_OPERATION';
  const isMunicipalFireMarshal = user?.role === 'MUNICIPAL_FIRE_MARSHAL';
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  // Shared across three tiers (Provincial Chief IIS, Municipal Fire Marshal, Municipal Chief IIS),
  // so this link is rendered once below the role-specific blocks rather than inside each of them.
  const showApprovedReports = canViewApprovedReports(user?.role);
  const showTrash = canViewTrash(user?.role);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40" onClick={onClose} aria-hidden="true"></div>
      )}

      {/* Sidebar */}
      <aside
        // Phones: slides in over the page (isOpen). lg and up: part of the layout, slid off to the
        // left when collapsed — the negative margin lets the page take the freed width, and
        // `invisible` (applied once the slide ends) keeps hidden links out of the Tab order.
        className={`sidebar app-shell fixed left-0 top-0 w-64 flex-shrink-0 transform transition-[transform,margin,visibility] duration-300 overflow-y-auto z-50 lg:relative lg:translate-x-0 lg:transform-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:-ml-64 lg:invisible' : 'lg:ml-0 lg:visible'}`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="py-6 pl-5 pr-3 border-b-2 border-bfp-gold">
            <div className="flex items-center gap-2.5">
              <BFPCrest size={40} className="flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="font-bold text-lg leading-tight tracking-wide">FireTrack</h1>
                <p className="text-xs text-bfp-gold tracking-wide uppercase whitespace-nowrap">Report Tracking</p>
              </div>
              {/* Hides the sidebar on wide screens, closes the slide-out menu on phones */}
              <MenuButton onClick={onToggle} label="Hide menu" className="-mr-1 text-white/80 hover:bg-white/10 hover:text-white" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <div className="space-y-2">
              {/* Provincial Dashboard — Marshal, Provincial Chief IIS, and every other
                  provincial/regional reviewer role (see PROVINCIAL_DASHBOARD_ROLES above) */}
              {isProvincialDashboardRole && (
                <>
                  <Link
                    href="/provincial"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Dashboard
                  </Link>
                  <Link
                    href="/provincial/reports"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
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
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Dashboard
                  </Link>
                  <Link
                    href="/municipal/reports"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
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
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                      >
                        <FilePlus className="w-4 h-4 flex-shrink-0" /> MDFIR
                      </Link>
                      <Link
                        href="/municipal/reports/spot"
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                      >
                        <Search className="w-4 h-4 flex-shrink-0" /> Spot Investigation
                      </Link>
                      <Link
                        href="/municipal/reports/progress"
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                      >
                        <Clock className="w-4 h-4 flex-shrink-0" /> Progress Investigation
                      </Link>
                      <Link
                        href="/municipal/reports/final"
                        className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                      >
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Final Investigation
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-bfp-gold/30">
                    <Link
                      href="/municipal/reports/text-blast"
                      className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0" /> Text Blast
                    </Link>
                  </div>
                </>
              )}

              {(isMunicipalChiefIIS || isMunicipalChiefOperation) && (
                <>
                  <Link
                    href="/municipal/chief"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Chief IIS Dashboard
                  </Link>
                </>
              )}

              {isMunicipalFireMarshal && (
                <>
                  <Link
                    href="/municipal/marshal"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Fire Marshal Dashboard
                  </Link>
                  <Link
                    href="/municipal/marshal/team"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <UserCheck className="w-4 h-4 flex-shrink-0" /> My Investigators
                  </Link>
                </>
              )}

              {/* Admin — same dashboard as Provincial Chief IIS, plus Report Tracking */}
              {isAdmin && (
                <>
                  <Link
                    href="/provincial"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <LayoutDashboard className="w-4 h-4 flex-shrink-0" /> Dashboard
                  </Link>
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <ShieldCheck className="w-4 h-4 flex-shrink-0" /> Report Tracking
                  </Link>
                  <Link
                    href="/admin/users"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <Users className="w-4 h-4 flex-shrink-0" /> User Management
                  </Link>
                  <Link
                    href="/admin/activity"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <History className="w-4 h-4 flex-shrink-0" /> Activity Log
                  </Link>
                </>
              )}

              {/* Shared archive of reports that cleared final approval by the Provincial Chief IIS */}
              {showApprovedReports && (
                <div className="mt-4 pt-4 border-t border-bfp-gold/30">
                  <Link
                    href={APPROVED_REPORTS_PATH}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <Archive className="w-4 h-4 flex-shrink-0" /> Reports
                  </Link>
                  <p className="mt-1 px-4 text-xs text-white/50">Approved &amp; filed records</p>
                </div>
              )}

              {/* Recycle bin for deleted reports — investigators and admins (see TRASH_ROLES) */}
              {showTrash && (
                <div className="mt-4 pt-4 border-t border-bfp-gold/30">
                  <Link
                    href={TRASH_PATH}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-bfp-navy-light transition-colors text-sm font-medium"
                  >
                    <Trash2 className="w-4 h-4 flex-shrink-0" /> Trash
                  </Link>
                  <p className="mt-1 px-4 text-xs text-white/50">Recover deleted reports</p>
                </div>
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" /> Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
