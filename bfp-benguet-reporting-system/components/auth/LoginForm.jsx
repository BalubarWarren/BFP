'use client';

import { Eye, EyeOff } from 'lucide-react';
import BFPCrest from '../common/BFPCrest';

export default function LoginForm({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  toggleShowPassword,
  error,
  loading,
  handleSubmit,
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bfp-navy via-bfp-navy to-black px-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1.5 hazard-trim" />
      <div className="absolute bottom-0 left-0 right-0 h-1.5 hazard-trim" />
      <div className="max-w-md w-full relative">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <BFPCrest size={88} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-widest uppercase">BFP Benguet</h1>
          <p className="text-bfp-gold text-sm font-semibold uppercase tracking-wide">Bureau of Fire Protection</p>
          <p className="text-white/60 text-sm mt-1">Fire Incident Reporting System</p>
        </div>

        {/* Card */}
        <div className="card card-accent-gold shadow-2xl">
          <h2 className="text-2xl font-bold text-bfp-navy mb-6">Sign In</h2>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="your.email@bfp-benguet.gov.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input pr-10"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={toggleShowPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-bfp-navy"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mb-4"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
