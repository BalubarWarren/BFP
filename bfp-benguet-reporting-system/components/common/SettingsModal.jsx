'use client';

import { useState } from 'react';
import axios from 'axios';
import { X, Sun, Moon, Monitor, KeyRound, LogOut } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useToast } from './ToastProvider';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

const emptyPasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

export default function SettingsModal({ onClose, onLogout }) {
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      const token = sessionStorage.getItem('token');
      await axios.post(
        '/api/auth/change-password',
        { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPasswordForm(emptyPasswordForm);
      toast.success('Password updated successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="modal-pop-in max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <h2 className="text-xl font-bold text-bfp-navy">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8 p-6">
          {/* Appearance */}
          <section>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Appearance</h3>
            <div className="grid grid-cols-3 gap-3">
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                      active
                        ? 'border-bfp-navy bg-bfp-navy/5 dark:border-white dark:bg-white/10'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Change password */}
          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-gray-500">
              <KeyRound className="w-4 h-4" /> Change Password
            </h3>
            {error && (
              <div className="mb-3 rounded border border-red-400 bg-red-100 px-4 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  className="form-input"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    className="form-input"
                    minLength={8}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    className="form-input"
                    minLength={8}
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </section>

          {/* Session */}
          <section className="border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-bfp-red hover:bg-red-50 dark:border-red-900"
            >
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
