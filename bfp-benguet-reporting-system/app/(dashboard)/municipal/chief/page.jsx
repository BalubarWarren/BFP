'use client';

import { useEffect, useState } from 'react';
import ReviewerDashboard from '../../../../components/dashboard/ReviewerDashboard';

export default function MunicipalChiefDashboardPage() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  const isOperationsChief = currentUser?.role === 'MUNICIPAL_CHIEF_OPERATION';
  const roleTitle = isOperationsChief ? 'Municipal Chief Operation' : 'Municipal Chief IIS';

  return (
    <ReviewerDashboard
      title={`${roleTitle} Dashboard`}
      description="Review assigned reports. If corrections are needed, return the report to the investigator. If the report is complete, approve it — it will be returned to the investigator who will then submit it to the Municipal Fire Marshal."
      incomingSectionTitle={`Reports Submitted to ${roleTitle}`}
      nextStepLabel="Municipal Fire Marshal"
    />
  );
}
