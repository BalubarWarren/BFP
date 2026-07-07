'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_HOME_PATH } from '@/lib/constants';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in by checking sessionStorage
    const token = sessionStorage.getItem('token');
    const user = sessionStorage.getItem('user');

    if (token && user) {
      const userData = JSON.parse(user);
      router.push(ROLE_HOME_PATH[userData.role] || '/provincial');
    } else {
      // Redirect to login if not logged in
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-bfp-red"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
