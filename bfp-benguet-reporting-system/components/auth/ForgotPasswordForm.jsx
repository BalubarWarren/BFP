'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Eye, EyeOff, ArrowLeft, MailCheck, CheckCircle2 } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

// "Forgot password?" on the login page, replacing the sign-in form inside the same card:
//   1. enter the account email → POST /api/auth/forgot-password emails a 6-digit code
//   2. enter the code and a new password → POST /api/auth/reset-password
//   3. done → back to Sign In with the email filled in
// `onBack(email)` returns to the sign-in form; it gets the email once the reset succeeded.
export default function ForgotPasswordForm({ initialEmail = '', onBack }) {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const requestCode = async () => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      setInfo(res.data.message);
      setResendIn(res.data.resendAfterSeconds || 60);
      setStep('code');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send a reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = (e) => {
    e.preventDefault();
    requestCode();
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/auth/reset-password', { email, code, newPassword });
      setNewPassword('');
      setConfirmPassword('');
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset the password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setError('');
    setInfo('');
  };

  return (
    <>
      <div className="flex items-center gap-2 mb-6">
        {step !== 'done' && (
          <button
            type="button"
            onClick={() => onBack()}
            className="text-gray-400 hover:text-bfp-navy"
            aria-label="Back to sign in"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-2xl font-bold text-bfp-navy">
          {step === 'done' ? 'Password Reset' : 'Forgot Password'}
        </h2>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleSendCode}>
          <p className="text-sm text-gray-600 mb-4">
            Enter the email address of your FireTrack account. We&rsquo;ll send you a 6-digit code to
            reset your password.
          </p>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="your.email@bfp-benguet.gov.ph"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Sending…' : 'Send Code'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleReset}>
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 mb-4 text-sm text-blue-800">
            <MailCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              {info} Check <span className="font-semibold">{email}</span>, including the Spam folder.
              The code expires in 10 minutes.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">6-Digit Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="form-input text-center text-2xl tracking-[0.5em] font-bold"
              placeholder="000000"
              // No maxLength: the browser would cut a pasted "123 456" to "123 4" before the
              // non-digits are stripped below, which already keeps it to 6 digits.
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="form-input pr-10"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-bfp-navy"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="form-input"
              placeholder="Type the new password again"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading || code.length !== 6} className="btn btn-primary w-full mb-4">
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={changeEmail} className="text-bfp-navy hover:underline">
              Use a different email
            </button>
            <button
              type="button"
              onClick={requestCode}
              disabled={loading || resendIn > 0}
              className="text-bfp-navy hover:underline disabled:text-gray-400 disabled:no-underline"
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <div className="text-center">
          <CheckCircle2 className="w-12 h-12 text-bfp-green mx-auto mb-4" />
          <p className="text-sm text-gray-600 mb-6">
            Your password has been changed. Sign in with your new password.
          </p>
          <button type="button" onClick={() => onBack(email)} className="btn btn-primary w-full" autoFocus>
            Back to Sign In
          </button>
        </div>
      )}
    </>
  );
}
