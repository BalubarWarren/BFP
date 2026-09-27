'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ROLE_HOME_PATH } from '../lib/constants';

export function useLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleShowPassword = () => setShowPassword((prev) => !prev);

  // Shared by both sign-in paths — same sessionStorage writes and same "go to this role's home
  // dashboard" redirect that every other part of the app already expects after login.
  const completeLogin = (user, token) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
    router.push(ROLE_HOME_PATH[user.role] || '/provincial');
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
