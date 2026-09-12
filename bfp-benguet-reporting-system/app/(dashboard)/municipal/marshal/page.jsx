'use client';

import ReviewerDashboard from '../../../../components/dashboard/ReviewerDashboard';

export default function MunicipalMarshalDashboardPage() {
  return (
    <ReviewerDashboard
      title="Municipal Fire Marshal Dashboard"
      description="Review assigned reports. If corrections are needed, return the report to the investigator. If the report is complete, approve it — it will be returned to the investigator who will then submit it to the Provincial Chief IIS."
      incomingSectionTitle="Reports Submitted for Your Review"
      nextStepLabel="Provincial Chief IIS"
    />
  );
}
