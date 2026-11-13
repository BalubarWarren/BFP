'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, ClipboardList, FilePlus, Search,
  ShieldCheck, LogOut, Users, History, Archive, UserCheck, MessageSquare, FolderArchive,
} from 'lucide-react';
import BFPCrest from './BFPCrest';
import MenuButton from './MenuButton';
import UserAvatar from './UserAvatar';
import { displayName } from '../../lib/user-display';
import { APPROVED_REPORTS_PATH, canViewApprovedReports, ARCHIVE_PATH, canViewArchive } from '../../lib/constants';
import { clearSession } from '../../lib/session';

// Every role whose ROLE_HOME_PATH/isRouteAllowedForRole (lib/constants.js) points at /provincial —
// including the legacy/regional roles.
const PROVINCIAL_DASHBOARD_ROLES = [
  'MARSHAL',
  'PROVINCIAL_CHIEF_IIS',
  'CHIEF_INVESTIGATOR_IIS',
  'PROVINCIAL_CHIEF_INVESTIGATOR',
  'REGION_IIS',
  'REGIONAL_CHIEF_OPERATION',
  'PIO',
];

// The sidebar for a role, as sections of links. Progress and Final Investigation are deliberately
// absent: they continue a case and are started from the approved report's row (CaseFollowUpCta).
function getNavSections(role) {
  const sections = [];

  if (PROVINCIAL_DASHBOARD_ROLES.includes(role)) {
    sections.push({
      items: [
        { href: '/provincial', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/provincial/reports', label: 'Fire Incident Reports', icon: FileText },
      ],
    });
  }

  if (role === 'INVESTIGATOR') {
    sections.push(
      {
        items: [
          { href: '/municipal', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/municipal/reports', label: 'My Reports', icon: ClipboardList },
        ],
      },
      {
        title: 'New Report',
        items: [
          { href: '/municipal/reports/mdfir', label: 'MDFIR', icon: FilePlus },
          { href: '/municipal/reports/spot', label: 'Spot Investigation', icon: Search },
        ],
      },
      {
        title: 'Communication',
        items: [{ href: '/municipal/reports/text-blast', label: 'Text Blast', icon: MessageSquare }],
      }
    );
  }

  if (role === 'MUNICIPAL_CHIEF_IIS' || role === 'MUNICIPAL_CHIEF_OPERATION') {
    sections.push({ items: [{ href: '/municipal/chief', label: 'Chief IIS Dashboard', icon: LayoutDashboard }] });
  }

  if (role === 'MUNICIPAL_FIRE_MARSHAL') {
    sections.push({
      items: [
        { href: '/municipal/marshal', label: 'Fire Marshal Dashboard', icon: LayoutDashboard },
        { href: '/municipal/marshal/team', label: 'My Investigators', icon: UserCheck },
      ],
    });
  }

  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    sections.push(
      { items: [{ href: '/provincial', label: 'Dashboard', icon: LayoutDashboard }] },
      {
        title: 'Administration',
        items: [
          { href: '/admin', label: 'Report Tracking', icon: ShieldCheck },
          { href: '/admin/users', label: 'User Management', icon: Users },
          { href: '/admin/activity', label: 'Activity Log', icon: History },
        ],
      }
    );
  }

  const records = [];
  if (canViewApprovedReports(role)) {
    records.push({ href: APPROVED_REPORTS_PATH, label: 'Reports', hint: 'Approved & filed records', icon: Archive });
  }
  if (canViewArchive(role)) {
    records.push({ href: ARCHIVE_PATH, label: 'Archive', hint: 'Earlier versions of revised reports', icon: FolderArchive });
  }
  if (records.length) sections.push({ title: 'Records', items: records });

  return sections;
}

// The link to highlight is the longest href the current path starts with — so on
// /municipal/reports/mdfir it's "MDFIR", not also "My Reports" or "Dashboard".
function findActiveHref(pathname, hrefs) {
  return hrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];
}

export default function Sidebar({ isOpen, isCollapsed, user, onClose, onToggle }) {
  const pathname = usePathname();
  const sections = getNavSections(user?.role);
  const activeHref = findActiveHref(pathname || '', sections.flatMap((s) => s.items.map((i) => i.href)));

  const handleLogout = () => {
    clearSession();
    // A full page load, not a client-side navigation: nothing from the signed-in session stays in
    // memory, and Back can't return to the dashboard.
    window.location.replace('/login');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 modal-overlay lg:hidden z-40" onClick={onClose} aria-hidden="true"></div>
      )}

      <aside
        // Phones: slides in over the page (isOpen). lg and up: part of the layout, slid off to the
        // left when collapsed — the negative margin lets the page take the freed width, and
        // `invisible` (applied once the slide ends) keeps hidden links out of the Tab order.
        className={`sidebar app-shell fixed left-0 top-0 w-64 flex-shrink-0 transform transition-[transform,margin,visibility] duration-300 ease-out overflow-y-auto z-50 lg:relative lg:translate-x-0 lg:transform-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:-ml-64 lg:invisible' : 'lg:ml-0 lg:visible'}`}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="flex h-14 flex-shrink-0 items-center gap-2.5 border-b border-gray-200 pl-4 pr-2 dark:border-gray-800">
            <BFPCrest size={28} className="flex-shrink-0" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">FireTrack</p>
              <p className="truncate text-[11px] text-gray-500">BFP Benguet</p>
            </div>
            {/* Hides the sidebar on wide screens, closes the slide-out menu on phones */}
            <MenuButton
              onClick={onToggle}
              label="Hide menu"
              className="text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-3" aria-label="Main">
            {sections.map((section, index) => (
              <div key={section.title || `section-${index}`} className={index > 0 && !section.title ? 'mt-3' : ''}>
                {section.title && <p className="nav-section">{section.title}</p>}
                <div className="space-y-0.5">
                  {section.items.map(({ href, label, hint, icon: Icon }) => (
                    <Link
                      key={href + label}
                      href={href}
                      className="nav-item"
                      aria-current={href === activeHref ? 'page' : undefined}
                      title={hint}
                    >
                      <Icon />
                      <span className="truncate">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          {/* User & Logout */}
          <div className="flex-shrink-0 border-t border-gray-200 p-3 dark:border-gray-800">
            <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
              <UserAvatar user={user} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{displayName(user)}</p>
                <p className="truncate text-xs text-gray-500">{user?.municipality?.name || 'Provincial'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-800"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
