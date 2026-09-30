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

  // Called with the signed ID token Google's own "Sign in with Google" button hands back once
  // someone picks an account (see components/auth/GoogleSignInButton.jsx) — POST
  // /api/auth/google does the actual verification and account lookup; this just completes the
  // session the same way a successful password login does.
  const handleGoogleCredential = async (credential) => {
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/google', { credential });
      completeLogin(response.data.user, response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
  };
}
