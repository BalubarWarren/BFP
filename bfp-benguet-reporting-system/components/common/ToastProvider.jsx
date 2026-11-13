'use client';

import { createContext, useContext, useMemo } from 'react';
import { Toaster, toast as sonner } from 'sonner';
import { useTheme } from './ThemeProvider';

const ToastContext = createContext(null);

// Toasts are rendered by Sonner. The `useToast()` API the pages already call
// (toast.success / toast.error) is unchanged, so no caller needed editing; info/warning/promise
// are passed through for new code.
export function ToastProvider({ children }) {
  const { theme } = useTheme();

  const toast = useMemo(
    () => ({
      success: (message, options) => sonner.success(message, options),
      error: (message, options) => sonner.error(message, options),
      info: (message, options) => sonner.info(message, options),
      warning: (message, options) => sonner.warning(message, options),
      promise: (promise, messages) => sonner.promise(promise, messages),
    }),
    []
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Toaster
        theme={theme}
        position="bottom-right"
        richColors
        closeButton
        duration={5000}
        toastOptions={{ className: 'text-sm' }}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
