'use client';

import { Mail, ShieldCheck, MapPin, KeyRound, Settings as SettingsIcon, LogOut } from 'lucide-react';

export default function ProfilePanel({ user, onOpenSettings, onLogout }) {
  const formattedRole = user?.role?.replace(/_/g, ' ');

  return (
    <div className="modal-pop-in absolute right-0 mt-2 w-80 rounded-lg bg-white shadow-lg z-50 dark:bg-gray-800">
      <div className="flex items-center gap-3 border-b border-gray-200 p-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-bfp-red text-lg font-bold text-white">
          {user?.name?.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{user?.name}</p>
          <p className="text-xs text-gray-500">{formattedRole}</p>
        </div>
      </div>

      <div className="space-y-3 p-4 text-sm">
        <div className="flex items-center gap-2 text-gray-700">
          <Mail className="w-4 h-4 flex-shrink-0 text-gray-400" />
          <span className="truncate">{user?.email}</span>
        </div>
        {user?.rank && (
          <div className="flex items-center gap-2 text-gray-700">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span>{user.rank}</span>
          </div>
        )}
        {user?.municipality?.name && (
          <div className="flex items-center gap-2 text-gray-700">
            <MapPin className="w-4 h-4 flex-shrink-0 text-gray-400" />
            <span>{user.municipality.name}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2 text-gray-700">
          <span className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 flex-shrink-0 text-gray-400" /> Password
          </span>
          <span className="tracking-widest text-gray-400">••••••••</span>
        </div>
      </div>

      <div className="space-y-1 border-t border-gray-200 p-3">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <SettingsIcon className="w-4 h-4" /> Settings
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-bfp-red hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" /> Log Out
        </button>
      </div>
    </div>
  );
}
