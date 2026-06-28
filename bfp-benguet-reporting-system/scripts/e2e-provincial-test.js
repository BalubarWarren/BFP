(async () => {
  const base = 'http://localhost:3000';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const login = async (email, password) => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json));
    return json;
  };

  try {
    console.log('Logging in as investigator...');
    const invCred = { email: 'investigator.atok@bfp-benguet.gov.ph', password: 'investigator@123' };
    const inv = await login(invCred.email, invCred.password);
    console.log('Investigator token ok, id=', inv.user.id, 'mun=', inv.user.municipalityId);

    console.log('Submitting report to PROVINCIAL_CHIEF_IIS...');
    const createRes = await fetch(`${base}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${inv.token}` },
      body: JSON.stringify({
        reportType: 'SPOT_INVESTIGATION',
        municipalityId: inv.user.municipalityId,
        reportDate: new Date().toISOString(),
        content: JSON.stringify({ summary: 'E2E provincial test report' }),
        passedToRole: 'PROVINCIAL_CHIEF_IIS'
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) throw new Error('Create failed: ' + JSON.stringify(created));
    console.log('Report created id=', created.report.id);

    const reportId = created.report.id;

    console.log('Logging in as provincial chief IIS...');
    const provCred = { email: 'provincial.chief.iis@bfp-benguet.gov.ph', password: 'provchiefiis@123' };
    const prov = await login(provCred.email, provCred.password);
    console.log('Provincial token ok, id=', prov.user.id);

    console.log('Provincial fetching incoming reports list...');
    const listRes = await fetch(`${base}/api/reports?view=incoming`, { headers: { Authorization: `Bearer ${prov.token}` } });
    const listJson = await listRes.json();
    console.log('List status', listRes.status, 'reports found', (listJson.reports || []).length);

    const found = (listJson.reports || []).some(r => r.id === reportId);
    if (found) {
      console.log('Provincial can see the report in incoming list — success');
      process.exit(0);
    }

    console.log('Provincial fetching report by id...');
    const getRes = await fetch(`${base}/api/reports/${reportId}`, { headers: { Authorization: `Bearer ${prov.token}` } });
    const getJson = await getRes.json();
    console.log('GET status', getRes.status);
    if (getRes.ok && getJson.report) {
      console.log('Provincial can fetch the report by id — success');
      process.exit(0);
    }

    console.error('Provincial cannot access the report');
    process.exit(2);
  } catch (e) {
    console.error('Test failed:', e.message || e);
    process.exit(3);
  }
})();
