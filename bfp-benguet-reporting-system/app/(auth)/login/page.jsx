'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

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

      // Store token and user in localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Redirect based on role
      const roleRedirects = {
        MARSHAL: '/provincial',
        PROVINCIAL_CHIEF_IIS: '/provincial',
        INVESTIGATOR: '/municipal',
        MUNICIPAL_CHIEF_IIS: '/municipal/chief',
        MUNICIPAL_CHIEF_OPERATION: '/municipal/chief',
        MUNICIPAL_FIRE_MARSHAL: '/municipal/marshal',
        CHIEF_INVESTIGATOR_IIS: '/provincial',
        CHIEF_SPECIAL_OPERATION_SECTION: '/provincial',
        PROVINCIAL_CHIEF_INVESTIGATOR: '/provincial',
        REGION_IIS: '/provincial',
        REGIONAL_CHIEF_OPERATION: '/provincial',
        PIO: '/provincial',
        VIEWER: '/provincial',
      };

      const redirectPath = roleRedirects[user.role] || '/provincial';
      router.push(redirectPath);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-bfp-navy to-blue-900 px-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-bfp-red rounded-full p-4 mb-4">
            <span className="text-4xl">🚒</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">BFP Benguet</h1>
          <p className="text-blue-100">Fire Incident Reporting System</p>
        </div>

        {/* Card */}
        <div className="card shadow-2xl">
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
            <p><strong>Viewer:</strong> viewer@bfp-benguet.gov.ph / viewer@123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
