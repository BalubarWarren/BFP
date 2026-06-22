import prisma from './prisma.js';
import { hashPassword } from './auth.js';
import { MUNICIPALITIES, ROLES, ROLE_PERMISSIONS } from './constants.js';

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (careful in production!)
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.dailyReportEntry.deleteMany();
  await prisma.report.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.user.deleteMany();
  await prisma.municipality.deleteMany();

  // Seed municipalities
  console.log('📍 Creating municipalities...');
  const createdMunicipalities = await Promise.all(
    MUNICIPALITIES.map((mun) =>
      prisma.municipality.create({
        data: {
          name: mun.name,
          code: mun.code,
        },
      })
    )
  );

  console.log(`✅ Created ${createdMunicipalities.length} municipalities`);

  // Get La Trinidad for SUPER_ADMIN
  const laTrinidad = createdMunicipalities.find((m) => m.code === 'LT');

  // Seed MARSHAL user
  console.log('👤 Creating MARSHAL user...');
  const marshalPassword = await hashPassword('marshal@123');
  const marshal = await prisma.user.create({
    data: {
      name: 'Provincial Fire Marshal',
      email: 'marshal@bfp-benguet.gov.ph',
      passwordHash: marshalPassword,
      role: ROLES.MARSHAL,
      rank: 'Chief Fire Officer',
      municipalityId: laTrinidad.id,
    },
  });
  console.log(`✅ Created MARSHAL: ${marshal.email}`);

  // Seed INVESTIGATORS (one per municipality except La Trinidad)
  console.log('👤 Creating INVESTIGATOR users...');
  const investigators = await Promise.all(
    createdMunicipalities
      .filter((m) => m.code !== 'LT')
      .slice(0, 3) // Create for first 3 municipalities
      .map(async (mun) => {
        const hash = await hashPassword('investigator@123');
        return prisma.user.create({
          data: {
            name: `${mun.name} Fire Investigator`,
            email: `investigator.${mun.code.toLowerCase()}@bfp-benguet.gov.ph`,
            passwordHash: hash,
            role: ROLES.INVESTIGATOR,
            rank: 'Fire Officer III',
            municipalityId: mun.id,
            permissions: JSON.stringify(ROLE_PERMISSIONS.INVESTIGATOR.permissions),
          },
        });
      })
  );
  console.log(`✅ Created ${investigators.length} INVESTIGATOR users`);

  // Seed CHIEF_INVESTIGATOR_IIS (provincial level)
  console.log('👤 Creating CHIEF_INVESTIGATOR_IIS user...');
  const chiefInvestigator = await prisma.user.create({
    data: {
      name: 'Provincial Chief Investigator - IIS',
      email: 'chief.investigator.iis@bfp-benguet.gov.ph',
      passwordHash: await hashPassword('chiefiis@123'),
      role: ROLES.CHIEF_INVESTIGATOR_IIS,
      rank: 'Fire Officer I',
      municipalityId: laTrinidad.id,
      permissions: JSON.stringify(ROLE_PERMISSIONS.CHIEF_INVESTIGATOR_IIS.permissions),
    },
  });
  console.log(`✅ Created CHIEF_INVESTIGATOR_IIS: ${chiefInvestigator.email}`);

  // Seed CHIEF_SPECIAL_OPERATION_SECTION
  console.log('👤 Creating CHIEF_SPECIAL_OPERATION_SECTION user...');
  const chiefSpecialOps = await prisma.user.create({
    data: {
      name: 'Chief Special Operation Section',
      email: 'chief.special.ops@bfp-benguet.gov.ph',
      passwordHash: await hashPassword('chiefspecops@123'),
      role: ROLES.CHIEF_SPECIAL_OPERATION_SECTION,
      rank: 'Fire Officer I',
      municipalityId: laTrinidad.id,
      permissions: JSON.stringify(ROLE_PERMISSIONS.CHIEF_SPECIAL_OPERATION_SECTION.permissions),
    },
  });
  console.log(`✅ Created CHIEF_SPECIAL_OPERATION_SECTION: ${chiefSpecialOps.email}`);

  // Seed PROVINCIAL_CHIEF_INVESTIGATOR
  console.log('👤 Creating PROVINCIAL_CHIEF_INVESTIGATOR user...');
  const provincialChief = await prisma.user.create({
    data: {
      name: 'Provincial Chief Investigator',
      email: 'provincial.chief.investigator@bfp-benguet.gov.ph',
      passwordHash: await hashPassword('provchief@123'),
      role: ROLES.PROVINCIAL_CHIEF_INVESTIGATOR,
      rank: 'Senior Fire Officer',
      municipalityId: laTrinidad.id,
      permissions: JSON.stringify(ROLE_PERMISSIONS.PROVINCIAL_CHIEF_INVESTIGATOR.permissions),
    },
  });
  console.log(`✅ Created PROVINCIAL_CHIEF_INVESTIGATOR: ${provincialChief.email}`);

  // Seed REGION_IIS (regional level)
  console.log('👤 Creating REGION_IIS user...');
  const regionIIS = await prisma.user.create({
    data: {
      name: 'Regional IIS Officer',
      email: 'region.iis@bfp-benguet.gov.ph',
      passwordHash: await hashPassword('regioniis@123'),
      role: ROLES.REGION_IIS,
      rank: 'Fire Officer I',
      municipalityId: laTrinidad.id,
      permissions: JSON.stringify(ROLE_PERMISSIONS.REGION_IIS.permissions),
    },
  });
  console.log(`✅ Created REGION_IIS: ${regionIIS.email}`);

  // Seed REGIONAL_CHIEF_OPERATION
  console.log('👤 Creating REGIONAL_CHIEF_OPERATION user...');
  const regionalChiefOps = await prisma.user.create({
    data: {
      name: 'Regional Chief Operation',
      email: 'regional.chief.operation@bfp-benguet.gov.ph',
      passwordHash: await hashPassword('regchieops@123'),
      role: ROLES.REGIONAL_CHIEF_OPERATION,
      rank: 'Senior Fire Officer',
      municipalityId: laTrinidad.id,
      permissions: JSON.stringify(ROLE_PERMISSIONS.REGIONAL_CHIEF_OPERATION.permissions),
    },
  });
  console.log(`✅ Created REGIONAL_CHIEF_OPERATION: ${regionalChiefOps.email}`);

  // Seed PIO (Public Information Officer)
  console.log('👤 Creating PIO (Public Information Officer) user...');
  const pio = await prisma.user.create({
    data: {
      name: 'Public Information Officer',
      email: 'pio@bfp-benguet.gov.ph',
      passwordHash: await hashPassword('pio@123'),
      role: ROLES.PIO,
      rank: 'Fire Officer II',
      municipalityId: laTrinidad.id,
      permissions: JSON.stringify(ROLE_PERMISSIONS.PIO.permissions),
    },
  });
  console.log(`✅ Created PIO: ${pio.email}`);

  // Seed VIEWER users
  console.log('👁️  Creating VIEWER user...');
  const viewer = await prisma.user.create({
    data: {
      name: 'Provincial Monitor',
      email: 'viewer@bfp-benguet.gov.ph',
      passwordHash: await hashPassword('viewer@123'),
      role: ROLES.VIEWER,
      rank: 'Fire Officer 2',
      permissions: JSON.stringify(ROLE_PERMISSIONS.VIEWER.permissions),
    },
  });
  console.log(`✅ Created VIEWER: ${viewer.email}`);

  // Seed sample daily report entries (from June 12, 2026 data - real BFP Benguet monitoring board)
  console.log('🔥 Creating sample daily report entries for dashboard...');

  const sampleDailyData = [
    { municipalityCode: 'ATOK', residential: 0, nonResidential: 0, nonStructural: 2, transport: 0 },
    { municipalityCode: 'BAKUN', residential: 0, nonResidential: 1, nonStructural: 7, transport: 0 },
    { municipalityCode: 'BOKOD', residential: 0, nonResidential: 0, nonStructural: 8, transport: 0 },
    { municipalityCode: 'BUGUIAS', residential: 1, nonResidential: 1, nonStructural: 0, transport: 1 },
    { municipalityCode: 'ITOGON', residential: 4, nonResidential: 2, nonStructural: 26, transport: 1 },
    { municipalityCode: 'KAPANGAN', residential: 0, nonResidential: 0, nonStructural: 1, transport: 0 },
    { municipalityCode: 'KASIYAN', residential: 0, nonResidential: 0, nonStructural: 2, transport: 0 },
    { municipalityCode: 'KIBUNGAN', residential: 0, nonResidential: 0, nonStructural: 1, transport: 0 },
    { municipalityCode: 'LT', residential: 5, nonResidential: 4, nonStructural: 6, transport: 0 },
    { municipalityCode: 'MANKAYAN', residential: 0, nonResidential: 0, nonStructural: 5, transport: 0 },
    { municipalityCode: 'SABLAN', residential: 1, nonResidential: 0, nonStructural: 2, transport: 0 },
    { municipalityCode: 'TUBA', residential: 4, nonResidential: 0, nonStructural: 9, transport: 1 },
    { municipalityCode: 'TUBLAY', residential: 3, nonResidential: 0, nonStructural: 8, transport: 0 },
  ];

  const reportDate = new Date('2026-06-12');
  const dummyReport = await prisma.report.create({
    data: {
      reportType: 'DAILY',
      status: 'APPROVED',
      municipalityId: laTrinidad.id,
      reportDate,
      content: '{}',
      submittedById: marshal.id,
    },
  });

  for (const data of sampleDailyData) {
    const municipality = createdMunicipalities.find(m => m.code === data.municipalityCode);
    if (!municipality) continue;

    const total = data.residential + data.nonResidential + data.nonStructural + data.transport;

    await prisma.dailyReportEntry.create({
      data: {
        reportId: dummyReport.id,
        municipalityId: municipality.id,
        reportDate,
        residentialCount: data.residential,
        nonResidentialCount: data.nonResidential,
        nonStructuralCount: data.nonStructural,
        transportCount: data.transport,
        totalCount: total,
        reportingOfficer: 'System Seed',
      },
    });
  }
  console.log(`✅ Created daily report entries for 13 municipalities (June 12, 2026 - Total 109 incidents)`);


  console.log('');
  console.log('🎉 Seeding completed successfully!');
  console.log('');
  console.log('📋 Test Credentials:');
  console.log('─'.repeat(70));
  console.log('SUPER_ADMIN (Full System Access):');
  console.log(`  Email: ${superAdmin.email} | Password: admin@123`);
  console.log('');
  console.log('INVESTIGATOR (Creates reports):');
  console.log(`  Email: ${investigators[0]?.email || 'N/A'} | Password: investigator@123`);
  console.log('');
  console.log('CHIEF_INVESTIGATOR_IIS (Reviews investigation reports):');
  console.log(`  Email: ${chiefInvestigator.email} | Password: chiefiis@123`);
  console.log('');
  console.log('CHIEF_SPECIAL_OPERATION_SECTION (Checks reports):');
  console.log(`  Email: ${chiefSpecialOps.email} | Password: chiefspecops@123`);
  console.log('');
  console.log('MUNICIPAL_FIRE_MARSHAL (Reviews/monitors from lower units):');
  console.log(`  Email: ${municipalMarshal[0]?.email || 'N/A'} | Password: marshal@123`);
  console.log('');
  console.log('PROVINCIAL_CHIEF_INVESTIGATOR (Provincial level review):');
  console.log(`  Email: ${provincialChief.email} | Password: provchief@123`);
  console.log('');
  console.log('REGION_IIS (Regional level review):');
  console.log(`  Email: ${regionIIS.email} | Password: regioniis@123`);
  console.log('');
  console.log('REGIONAL_CHIEF_OPERATION (Regional operations monitoring):');
  console.log(`  Email: ${regionalChiefOps.email} | Password: regchieops@123`);
  console.log('');
  console.log('PIO (Public Information Officer):');
  console.log(`  Email: ${pio.email} | Password: pio@123`);
  console.log('');
  console.log('VIEWER (Read-only access):');
  console.log(`  Email: ${viewer.email} | Password: viewer@123`);
  console.log('─'.repeat(70));
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
