import prisma from './prisma.js';
import { hashPassword } from './auth.js';
import { MUNICIPALITIES, ROLES, ROLE_PERMISSIONS } from './constants.js';

async function createUser({ name, email, password, role, rank, municipalityId }) {
  return prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      rank,
      municipalityId: municipalityId || null,
      permissions: JSON.stringify(ROLE_PERMISSIONS[role]?.permissions || []),
    },
  });
}

async function main() {
  console.log('Seeding database...');

  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.dailyReportEntry.deleteMany();
  await prisma.report.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.user.deleteMany();
  await prisma.municipality.deleteMany();

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

  const laTrinidad = createdMunicipalities.find((m) => m.code === 'LT');

  const superAdmin = await createUser({
    name: 'System Administrator',
    email: 'admin@bfp-benguet.gov.ph',
    password: 'admin@123',
    role: ROLES.SUPER_ADMIN,
    rank: 'Administrator',
    municipalityId: laTrinidad?.id,
  });

  const provincialChiefIIS = await createUser({
    name: 'Provincial Chief IIS',
    email: 'provincial.chief.iis@bfp-benguet.gov.ph',
    password: 'provchiefiis@123',
    role: ROLES.PROVINCIAL_CHIEF_IIS,
    rank: 'Chief Fire Officer',
    municipalityId: laTrinidad?.id,
  });

  const investigators = [];
  const municipalChiefs = [];
  const municipalMarshals = [];

  for (const mun of createdMunicipalities) {
    const code = mun.code.toLowerCase();

    investigators.push(
      await createUser({
        name: `${mun.name} Municipal Investigator`,
        email: `investigator.${code}@bfp-benguet.gov.ph`,
        password: 'investigator@123',
        role: ROLES.INVESTIGATOR,
        rank: 'Fire Officer III',
        municipalityId: mun.id,
      })
    );

    municipalChiefs.push(
      await createUser({
        name: `${mun.name} Municipal Chief IIS`,
        email: `chief.iis.${code}@bfp-benguet.gov.ph`,
        password: 'chiefiis@123',
        role: ROLES.MUNICIPAL_CHIEF_IIS,
        rank: 'Senior Fire Officer',
        municipalityId: mun.id,
      })
    );

    // Create Municipal Chief Operation account for each municipality
    await createUser({
      name: `${mun.name} Municipal Chief Operation`,
      email: `chief.operation.${code}@bfp-benguet.gov.ph`,
      password: 'chiefop@123',
      role: ROLES.MUNICIPAL_CHIEF_OPERATION,
      rank: 'Senior Fire Officer',
      municipalityId: mun.id,
    });

    municipalMarshals.push(
      await createUser({
        name: `${mun.name} Municipal Fire Marshal`,
        email: `marshal.${code}@bfp-benguet.gov.ph`,
        password: 'marshal@123',
        role: ROLES.MUNICIPAL_FIRE_MARSHAL,
        rank: 'Fire Marshal',
        municipalityId: mun.id,
      })
    );
  }

  // ── Historical fire incident data (dailyReportEntry per municipality per month) ──
  // Format: [code, residential, nonResidential, nonStructural, transport]
  const HIST_MONTHS = [
    // ── 2022 annual summary ──
    { date: '2022-06-15', rows: [['ATOK',0,0,4,0],['BAKUN',0,1,5,0],['BOKOD',0,0,7,0],['BUGUIAS',1,1,0,0],['ITOGON',5,3,18,1],['KABAYAN',0,0,2,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',7,4,7,0],['MANKAYAN',0,0,6,0],['SABLAN',2,0,3,0],['TUBA',4,1,9,1],['TUBLAY',3,0,7,0]] },
    // ── 2023 annual summary ──
    { date: '2023-06-15', rows: [['ATOK',0,0,5,0],['BAKUN',0,2,9,0],['BOKOD',0,0,9,0],['BUGUIAS',2,1,0,1],['ITOGON',8,4,28,2],['KABAYAN',0,0,2,0],['KAPANGAN',0,0,2,0],['KIBUNGAN',0,0,2,0],['LT',9,5,9,0],['MANKAYAN',0,0,8,0],['SABLAN',2,0,4,0],['TUBA',5,1,11,1],['TUBLAY',4,0,10,0]] },
    // ── 2024 annual summary ──
    { date: '2024-06-15', rows: [['ATOK',0,0,4,0],['BAKUN',0,1,7,0],['BOKOD',0,0,8,0],['BUGUIAS',1,1,0,1],['ITOGON',6,3,22,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',7,4,8,0],['MANKAYAN',0,0,7,0],['SABLAN',1,0,3,0],['TUBA',5,0,10,1],['TUBLAY',3,0,9,0]] },
    // ── 2025 monthly ──
    { date: '2025-01-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,1,0],['BOKOD',0,0,2,0],['BUGUIAS',0,1,0,0],['ITOGON',1,0,4,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,0,0],['KIBUNGAN',0,0,0,0],['LT',1,1,2,0],['MANKAYAN',0,0,1,0],['SABLAN',0,0,0,0],['TUBA',1,0,2,0],['TUBLAY',0,0,1,0]] },
    { date: '2025-02-01', rows: [['ATOK',0,0,0,0],['BAKUN',0,1,2,0],['BOKOD',0,0,2,0],['BUGUIAS',1,0,0,0],['ITOGON',1,1,5,1],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',2,1,2,0],['MANKAYAN',0,0,1,0],['SABLAN',1,0,0,0],['TUBA',1,0,3,0],['TUBLAY',1,0,2,0]] },
    { date: '2025-03-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,3,0],['BOKOD',0,0,3,0],['BUGUIAS',0,1,0,0],['ITOGON',2,1,8,0],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,0,0],['KIBUNGAN',0,0,1,0],['LT',3,2,3,0],['MANKAYAN',0,0,2,0],['SABLAN',0,0,1,0],['TUBA',2,0,4,0],['TUBLAY',1,0,3,0]] },
    { date: '2025-04-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,1,3,0],['BOKOD',0,0,4,0],['BUGUIAS',1,0,0,1],['ITOGON',2,1,10,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',3,2,4,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,1,0],['TUBA',2,0,5,1],['TUBLAY',1,0,4,0]] },
    { date: '2025-05-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,4,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,0],['ITOGON',3,1,12,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',4,2,4,0],['MANKAYAN',0,0,3,0],['SABLAN',0,0,2,0],['TUBA',3,0,5,0],['TUBLAY',2,0,4,0]] },
    { date: '2025-06-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,1,5,0],['BOKOD',0,0,5,0],['BUGUIAS',1,0,0,0],['ITOGON',3,2,14,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',4,3,5,0],['MANKAYAN',0,0,4,0],['SABLAN',1,0,2,0],['TUBA',3,0,6,0],['TUBLAY',2,0,5,0]] },
    { date: '2025-07-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,4,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,1],['ITOGON',3,2,12,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',3,2,4,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,1,0],['TUBA',2,0,5,1],['TUBLAY',2,0,4,0]] },
    { date: '2025-08-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,1,5,0],['BOKOD',0,0,5,0],['BUGUIAS',1,1,0,0],['ITOGON',4,2,16,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',4,3,5,0],['MANKAYAN',0,0,4,0],['SABLAN',1,0,2,0],['TUBA',3,0,7,0],['TUBLAY',2,0,6,0]] },
    { date: '2025-09-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,3,0],['BOKOD',0,0,3,0],['BUGUIAS',0,1,0,0],['ITOGON',2,1,10,0],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,0,0],['KIBUNGAN',0,0,0,0],['LT',3,2,3,0],['MANKAYAN',0,0,2,0],['SABLAN',0,0,1,0],['TUBA',2,0,4,0],['TUBLAY',1,0,3,0]] },
    { date: '2025-10-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,3,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,1],['ITOGON',2,1,11,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',3,2,4,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,1,0],['TUBA',2,0,5,1],['TUBLAY',1,0,4,0]] },
    { date: '2025-11-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,1,4,0],['BOKOD',0,0,5,0],['BUGUIAS',1,0,0,0],['ITOGON',3,2,13,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',4,2,5,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,2,0],['TUBA',3,0,6,0],['TUBLAY',2,0,5,0]] },
    { date: '2025-12-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,3,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,0],['ITOGON',2,1,9,0],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',3,1,4,0],['MANKAYAN',0,0,2,0],['SABLAN',0,0,1,0],['TUBA',2,0,4,0],['TUBLAY',1,0,3,0]] },
    // ── 2026 monthly (Jan–May; Jun is the screenshot data seeded below) ──
    { date: '2026-01-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,0,2,0],['BOKOD',0,0,2,0],['BUGUIAS',0,1,0,0],['ITOGON',1,1,5,0],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,0,0],['KIBUNGAN',0,0,0,0],['LT',2,1,2,0],['MANKAYAN',0,0,1,0],['SABLAN',0,0,1,0],['TUBA',1,0,2,0],['TUBLAY',1,0,2,0]] },
    { date: '2026-02-01', rows: [['ATOK',0,0,0,0],['BAKUN',0,1,3,0],['BOKOD',0,0,3,0],['BUGUIAS',1,0,0,0],['ITOGON',2,1,8,1],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',3,2,3,0],['MANKAYAN',0,0,2,0],['SABLAN',1,0,1,0],['TUBA',2,0,4,0],['TUBLAY',1,0,3,0]] },
    { date: '2026-03-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,0,4,0],['BOKOD',0,0,4,0],['BUGUIAS',0,1,0,1],['ITOGON',3,1,12,0],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,0,0],['LT',4,3,4,0],['MANKAYAN',0,0,3,0],['SABLAN',1,0,1,0],['TUBA',3,0,6,1],['TUBLAY',2,0,5,0]] },
    { date: '2026-04-01', rows: [['ATOK',0,0,1,0],['BAKUN',0,1,5,0],['BOKOD',0,0,5,0],['BUGUIAS',1,0,0,0],['ITOGON',3,2,15,1],['KABAYAN',0,0,0,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',4,3,5,0],['MANKAYAN',0,0,4,0],['SABLAN',1,0,2,0],['TUBA',3,0,7,0],['TUBLAY',2,0,6,0]] },
    { date: '2026-05-01', rows: [['ATOK',0,0,2,0],['BAKUN',0,0,5,0],['BOKOD',0,0,6,0],['BUGUIAS',1,1,0,1],['ITOGON',4,2,20,1],['KABAYAN',0,0,1,0],['KAPANGAN',0,0,1,0],['KIBUNGAN',0,0,1,0],['LT',5,3,5,0],['MANKAYAN',0,0,4,0],['SABLAN',1,0,2,0],['TUBA',4,0,8,1],['TUBLAY',2,0,7,0]] },
  ];

  for (const month of HIST_MONTHS) {
    for (const [code, r, nr, ns, t] of month.rows) {
      const mun = createdMunicipalities.find((m) => m.code === code);
      if (!mun) continue;
      await prisma.dailyReportEntry.create({
        data: {
          reportId: 0,
          municipalityId: mun.id,
          reportDate: new Date(month.date),
          residentialCount: r,
          nonResidentialCount: nr,
          nonStructuralCount: ns,
          transportCount: t,
          totalCount: r + nr + ns + t,
          reportingOfficer: 'System Seed',
        },
      });
    }
  }

  // ── June 2026 monitoring board (from screenshot) ──
  const monitoringBoardData = [
    { code: 'ATOK',     residential: 0, nonResidential: 0, nonStructural: 2,  transport: 0, total: 2  },
    { code: 'BAKUN',    residential: 0, nonResidential: 1, nonStructural: 7,  transport: 0, total: 8  },
    { code: 'BOKOD',    residential: 0, nonResidential: 0, nonStructural: 8,  transport: 0, total: 8  },
    { code: 'BUGUIAS',  residential: 1, nonResidential: 1, nonStructural: 0,  transport: 1, total: 3  },
    { code: 'ITOGON',   residential: 4, nonResidential: 2, nonStructural: 26, transport: 1, total: 33 },
    { code: 'KAPANGAN', residential: 0, nonResidential: 0, nonStructural: 1,  transport: 0, total: 1  },
    { code: 'KIBUNGAN', residential: 0, nonResidential: 0, nonStructural: 1,  transport: 0, total: 1  },
    { code: 'LT',       residential: 5, nonResidential: 4, nonStructural: 6,  transport: 0, total: 15 },
    { code: 'MANKAYAN', residential: 0, nonResidential: 0, nonStructural: 5,  transport: 0, total: 5  },
    { code: 'SABLAN',   residential: 1, nonResidential: 0, nonStructural: 2,  transport: 0, total: 3  },
    { code: 'TUBA',     residential: 4, nonResidential: 0, nonStructural: 9,  transport: 1, total: 14 },
    { code: 'TUBLAY',   residential: 3, nonResidential: 0, nonStructural: 8,  transport: 0, total: 11 },
  ];

  for (const entry of monitoringBoardData) {
    const mun = createdMunicipalities.find((m) => m.code === entry.code);
    if (!mun) continue;
    await prisma.dailyReportEntry.create({
      data: {
        reportId: 0,
        municipalityId: mun.id,
        reportDate: new Date('2026-06-01'),
        residentialCount: entry.residential,
        nonResidentialCount: entry.nonResidential,
        nonStructuralCount: entry.nonStructural,
        transportCount: entry.transport,
        totalCount: entry.total,
        reportingOfficer: 'System Seed',
      },
    });
  }

  console.log('Seed completed.');
  console.log('');
  console.log('Test credentials:');
  console.log(`SUPER_ADMIN: ${superAdmin.email} / admin@123`);
  console.log(`PROVINCIAL_CHIEF_IIS: ${provincialChiefIIS.email} / provchiefiis@123`);
  console.log(`INVESTIGATOR (sample): ${investigators[0]?.email} / investigator@123`);
  console.log(`MUNICIPAL_CHIEF_IIS (sample): ${municipalChiefs[0]?.email} / chiefiis@123`);
  console.log(`MUNICIPAL_FIRE_MARSHAL (sample): ${municipalMarshals[0]?.email} / marshal@123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
