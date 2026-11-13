'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell, Settings } from 'lucide-react';
import ProfilePanel from './ProfilePanel';
import MenuButton from './MenuButton';
import TextBlastContent from './TextBlastContent';
import UserAvatar from './UserAvatar';
import { displayName, roleTitle } from '../../lib/user-display';
import { textBlastLinesFromPayload } from '../../lib/text-blast';
import { NOTIFICATIONS_CHANGED_EVENT } from '../../lib/constants';
import SettingsModal from './SettingsModal';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { clearSession } from '../../lib/session';

export default function Header({ user, onToggleSidebar, isSidebarCollapsed }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsRef = useRef(null);
  const profileRef = useRef(null);

  useOutsideClick(notificationsRef, () => setShowNotifications(false), showNotifications);
  useOutsideClick(profileRef, () => setShowProfile(false), showProfile);
  useEscapeKey(() => setShowNotifications(false), showNotifications);
  useEscapeKey(() => setShowProfile(false), showProfile);

  const handleLogout = () => {
    clearSession();
    // A full page load, not a client-side navigation: nothing from the signed-in session stays in
    // memory, and Back can't return to the dashboard.
    window.location.replace('/login');
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      // Refresh notifications every 30 seconds, skipping ticks while the tab isn't visible —
      // unlike the page-level polls elsewhere, nothing else re-fetches notifications on focus,
      // so that's handled here too rather than waiting up to 30s after coming back.
      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') fetchNotifications();
      }, 30000);
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') fetchNotifications();
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, fetchNotifications);
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, fetchNotifications);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await axios.get('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.notifications?.filter((n) => !n.isRead).length || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const token = sessionStorage.getItem('token');
      await axios.patch(
        '/api/notifications',
        { notificationId, isRead: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const parseNotificationMessage = (message) => {
    try {
      const payload = JSON.parse(message);
      if (payload?.kind === 'TEXT_BLAST') {
        return {
          message: payload.message || 'Text blast received.',
          lines: textBlastLinesFromPayload(payload),
          attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
        };
      }
    } catch {
      // Plain notification messages are stored as normal text.
    }

    return { message, lines: [], attachments: [] };
  };

  return (
    // Solid background on purpose: a backdrop blur here makes the header the containing block for
    // every `position: fixed` element inside it (the phone-size notification and profile menus),
    // which cut them off. Modals are portaled (components/common/Portal.jsx) for the same reason.
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
        {/* Left side - Menu toggle: opens the slide-out menu on phones. On wider screens the
            sidebar has its own button, so this one only appears to bring a hidden sidebar back
            (see toggleSidebar in app/(dashboard)/layout.jsx). */}
        <MenuButton
          onClick={onToggleSidebar}
          label="Show menu"
          className={`-ml-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white ${isSidebarCollapsed ? '' : 'lg:hidden'}`}
        />

        {/* Page info */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            <span className="hidden md:inline">Fire Incident Report Tracking System</span>
            <span className="md:hidden">FireTrack</span>
          </h1>
          <span className="hidden rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 sm:inline dark:bg-gray-800">
            BFP Benguet
          </span>
        </div>

        {/* Right side - Notifications & User */}
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-1.5">
          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white ${
                showNotifications ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' : ''
              }`}
              aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-bfp-red px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white dark:ring-gray-950">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="dropdown-in fixed inset-x-4 top-14 z-50 mt-1 max-h-[28rem] overflow-y-auto rounded-xl bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
                <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="rounded-md bg-bfp-red/10 px-1.5 py-0.5 text-[11px] font-medium text-bfp-red">
                      {unreadCount} unread
                    </span>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                    <Bell className="h-5 w-5 text-gray-300" />
                    <p className="text-sm text-gray-500">You&rsquo;re all caught up</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const parsedNotification = parseNotificationMessage(notif.message);

                    return (
                      <div
                        key={notif.id}
                        className={`relative cursor-pointer border-b border-gray-100 py-3 pl-7 pr-4 transition-colors last:border-b-0 hover:bg-gray-50 ${
                          !notif.isRead ? 'bg-blue-50/40' : ''
                        }`}
                        onClick={() => handleMarkAsRead(notif.id)}
                      >
                        {!notif.isRead && (
                          <span className="absolute left-3 top-[18px] h-1.5 w-1.5 rounded-full bg-blue-500" aria-label="Unread" />
                        )}
                        <p className={`text-sm text-gray-900 ${!notif.isRead ? 'font-medium' : ''}`}>{parsedNotification.message}</p>
                        <TextBlastContent lines={parsedNotification.lines} className="mt-1" />
                        {parsedNotification.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {parsedNotification.attachments.map((attachment) => (
                              <a
                                key={attachment.url}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block text-sm text-bfp-navy hover:underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Open {attachment.name}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notif.createdAt).toLocaleString()}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
            aria-label="Settings"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>

          {/* User Avatar / Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="ml-1 flex items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-gray-100 lg:rounded-md lg:py-1 lg:pl-1 lg:pr-2.5 dark:hover:bg-gray-800"
              aria-label="Profile"
            >
              <UserAvatar user={user} size={32} />
              <div className="hidden lg:block text-left leading-tight">
                <p className="text-sm font-medium text-gray-900">{displayName(user)}</p>
                <p className="text-[11px] text-gray-500">{roleTitle(user)}</p>
              </div>
            </button>

            {showProfile && (
              <ProfilePanel
                user={user}
                onOpenSettings={() => {
                  setShowProfile(false);
                  setShowSettings(true);
                }}
                onLogout={handleLogout}
              />
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} onLogout={handleLogout} />
      )}
    </header>
  );
}
