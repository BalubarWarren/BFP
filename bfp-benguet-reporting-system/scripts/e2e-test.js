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

    console.log('Submitting report to MUNICIPAL_CHIEF_IIS...');
    const createRes = await fetch(`${base}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${inv.token}` },
      body: JSON.stringify({
        reportType: 'SPOT_INVESTIGATION',
        municipalityId: inv.user.municipalityId,
        reportDate: new Date().toISOString(),
        content: JSON.stringify({ summary: 'E2E test report' }),
        passedToRole: 'MUNICIPAL_CHIEF_IIS'
      }),
    });
    const created = await createRes.json();
    if (!createRes.ok) throw new Error('Create failed: ' + JSON.stringify(created));
    console.log('Report created id=', created.report.id);

    const reportId = created.report.id;

    console.log('Logging in as municipal chief IIS...');
    const chiefCred = { email: 'chief.iis.atok@bfp-benguet.gov.ph', password: 'chiefiis@123' };
    const chief = await login(chiefCred.email, chiefCred.password);
    console.log('Chief token ok, id=', chief.user.id);

    console.log('Chief fetching report by id to verify access...');
    const chiefGet = await fetch(`${base}/api/reports/${reportId}`, { headers: { Authorization: `Bearer ${chief.token}` } });
    const chiefRep = await chiefGet.json();
    console.log('Chief GET status', chiefGet.status);

    if (!chiefGet.ok) {
      console.error('Chief cannot access report:', chiefRep);
      process.exit(1);
    }

    console.log('Returning report with remarks...');
    const returnRes = await fetch(`${base}/api/reports/${reportId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chief.token}` },
      body: JSON.stringify({ action: 'reject', remarks: 'Please include more details in section X.' }),
    });
    const returnJson = await returnRes.json();
    console.log('Return response status', returnRes.status, returnJson.message || returnJson.error || '');

    await sleep(500);

    console.log('Investigator fetching report to see remarks...');
    const invGet = await fetch(`${base}/api/reports/${reportId}`, { headers: { Authorization: `Bearer ${inv.token}` } });
    const invRep = await invGet.json();
    console.log('Investigator GET status', invGet.status);
    console.log('Investigator report remarks:', invRep.report?.remarks || '(none)');

    if (invRep.report?.remarks && invGet.ok) {
      console.log('E2E flow successful: investigator can see reviewer remarks.');
      process.exit(0);
    } else {
      console.error('E2E flow failed: remarks not visible or fetch failed.');
      process.exit(2);
    }
  } catch (e) {
    console.error('Test failed:', e.message || e);
    process.exit(3);
  }
})();
