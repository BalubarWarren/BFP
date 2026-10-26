'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ROLE_HOME_PATH } from '../lib/constants';
import { saveSession, safeNextPath } from '../lib/session';

export function useLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Set after "Continue with Google" identifies the account; null while typing an email by hand.
  const [googleUser, setGoogleUser] = useState(null);
  // "Forgot password?" swaps the sign-in form for components/auth/ForgotPasswordForm.jsx.
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  // Set when Google picked an account that can't use FireTrack — drives
  // components/auth/GoogleAccountWarningModal.jsx. Keeps the credential for "Request Access".
  const [googleWarning, setGoogleWarning] = useState(null);

  const toggleShowPassword = () => setShowPassword((prev) => !prev);

  // Sent here by lib/session.js's redirectToLogin after a session ended — say so, rather than
  // leaving the user wondering why they're on the login page.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('expired') === '1') {
      setError('Your session has ended. Please sign in again to continue where you left off.');
    }
  }, []);

  // Shared by both sign-in paths — same sessionStorage writes and same "go to this role's home
  // dashboard" redirect that every other part of the app already expects after login.
  // Returns to the page the user was on when their session ended (the `next` parameter set by
  // redirectToLogin in lib/session.js); the dashboard layout still bounces them to their own
  // home if that page belongs to a different role.
  const completeLogin = (user, token) => {
    saveSession(token, user);
    // Wipe the form so the credentials don't stay visible (or come back via the Back button)
    // once the user is signed in.
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setGoogleUser(null);
    const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
    router.push(next || ROLE_HOME_PATH[user.role] || '/provincial');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      completeLogin(response.data.user, response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Called with the signed ID token Google's own button hands back once someone picks an account
  // (see components/auth/GoogleSignInButton.jsx). POST /api/auth/google verifies it and returns
  // the matching FireTrack email — this only fills in and locks the email field; the user still
  // has to enter their admin-set system password, which goes through the normal handleSubmit.
  const handleGoogleCredential = async (credential) => {
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/google', { credential });
      setEmail(response.data.email);
      setGoogleUser({ email: response.data.email, name: response.data.name });
      setPassword('');
    } catch (err) {
      const data = err.response?.data;
      if (data?.code) {
        setGoogleWarning({ code: data.code, email: data.email, name: data.name, credential });
      } else {
        setError(data?.error || 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const closeGoogleWarning = () => setGoogleWarning(null);

  // "Use Email & Password" in the warning — back to the normal form with the email box empty.
  const switchToPasswordLogin = () => {
    setGoogleWarning(null);
    setGoogleUser(null);
    setEmail('');
    setPassword('');
  };

  const openForgotPassword = () => {
    setError('');
    setShowForgotPassword(true);
  };

  // `resetEmail` is set once a reset succeeded, so the user can sign in straight away with it.
  const closeForgotPassword = (resetEmail) => {
    setShowForgotPassword(false);
    setError('');
    if (resetEmail) {
      setGoogleUser(null);
      setEmail(resetEmail);
      setPassword('');
    }
  };

  // "Not you?" — back to typing an email (or choosing a different Google account).
  const clearGoogleUser = () => {
    setGoogleUser(null);
    setEmail('');
    setPassword('');
    setError('');
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    toggleShowPassword,
    error,
    loading,
    handleSubmit,
    handleGoogleCredential,
    googleUser,
    clearGoogleUser,
    showForgotPassword,
    openForgotPassword,
    closeForgotPassword,
    googleWarning,
    closeGoogleWarning,
    switchToPasswordLogin,
  };
}
