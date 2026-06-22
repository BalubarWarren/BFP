'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in by checking localStorage
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
      const userData = JSON.parse(user);
      
      // Redirect based on role
      const roleRedirects = {
        MARSHAL: '/provincial',
        INVESTIGATOR: '/municipal',
        CHIEF_INVESTIGATOR_IIS: '/provincial',
        CHIEF_SPECIAL_OPERATION_SECTION: '/provincial',
        PROVINCIAL_CHIEF_INVESTIGATOR: '/provincial',
        REGION_IIS: '/provincial',
        REGIONAL_CHIEF_OPERATION: '/provincial',
        PIO: '/provincial',
        VIEWER: '/provincial',
      };

      const redirectPath = roleRedirects[userData.role] || '/provincial';
      router.push(redirectPath);
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
