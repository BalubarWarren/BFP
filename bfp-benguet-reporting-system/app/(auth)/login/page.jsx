'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import BFPCrest from '@/components/common/BFPCrest';
import { ROLE_HOME_PATH } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@bfp-benguet.gov.ph');
  const [password, setPassword] = useState('admin@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      const { user, token } = response.data;

      // Store token and user in sessionStorage
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));

      // Redirect based on role
      router.push(ROLE_HOME_PATH[user.role] || '/provincial');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
              <input
                type="password"
                className="form-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full mb-4"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="border-t pt-4 text-sm text-gray-600">
            <p className="mb-2 font-semibold">Test Credentials:</p>
            <p><strong>Provincial Chief IIS:</strong> provincial.chief.iis@bfp-benguet.gov.ph / provchiefiis@123</p>
            <p><strong>Investigator:</strong> investigator.atok@bfp-benguet.gov.ph / investigator@123</p>
            <p><strong>Municipal Chief IIS:</strong> chief.iis.atok@bfp-benguet.gov.ph / chiefiis@123</p>
            <p><strong>Municipal Fire Marshal:</strong> marshal.atok@bfp-benguet.gov.ph / marshal@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
