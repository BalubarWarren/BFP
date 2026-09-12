'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Menu, Bell, Settings } from 'lucide-react';
import ProfilePanel from './ProfilePanel';
import SettingsModal from './SettingsModal';
import { useOutsideClick } from '../../hooks/useOutsideClick';
import { useEscapeKey } from '../../hooks/useEscapeKey';

export default function Header({ user, onToggleSidebar }) {
  const router = useRouter();
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
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    router.push('/login');
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
      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisibilityChange);
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
          note: payload.note || '',
          attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
        };
      }
    } catch {
      // Plain notification messages are stored as normal text.
    }

    return { message, note: '', attachments: [] };
  };

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="h-1 hazard-trim" />
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - Menu toggle */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden text-gray-600 hover:text-gray-900"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Center - Page info */}
        <div className="flex-1 text-center">
          <h1 className="text-xl font-bold text-bfp-navy">
            Fire Incident Reporting System
          </h1>
        </div>

        {/* Right side - Notifications & User */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-600 hover:text-gray-900"
              aria-label="Notifications"
            >
              <Bell className="w-6 h-6" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-bfp-red rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No notifications</div>
                ) : (
                  notifications.map((notif) => {
                    const parsedNotification = parseNotificationMessage(notif.message);

                    return (
                      <div
                        key={notif.id}
                        className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                          !notif.isRead ? 'bg-bfp-red/5' : ''
                        }`}
                        onClick={() => handleMarkAsRead(notif.id)}
                      >
                        <p className="text-sm font-medium text-gray-900">{parsedNotification.message}</p>
                        {parsedNotification.note && (
                          <p className="text-sm text-gray-600 mt-1">{parsedNotification.note}</p>
                        )}
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
            className="p-2 text-gray-600 hover:text-gray-900"
            aria-label="Settings"
          >
            <Settings className="w-6 h-6" />
          </button>

          {/* User Avatar / Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="flex items-center gap-2"
              aria-label="Profile"
            >
              <div className="w-10 h-10 bg-bfp-red rounded-full flex items-center justify-center text-white font-bold">
                {user?.name?.charAt(0)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.role?.replace('_', ' ')}</p>
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
