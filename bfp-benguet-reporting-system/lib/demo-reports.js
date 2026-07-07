import { ROLES } from './constants.js';

const ATTACHMENTS = JSON.stringify([
  {
    name: 'Dummy Fire Investigation Report.pdf',
    type: 'application/pdf',
    size: 245760,
    url: '/uploads/reports/1782798103285-7336s65dm6-Classpin.pdf',
  },
]);

// ─── Per-municipality demo data ──────────────────────────────────────────────
// idx drives negative IDs: incidents -(idx*100+n), reports -(idx*1000+n)
const MUNICIPALITY_CONFIGS = [
  {
    code: 'ATOK', idx: 0, name: 'Atok',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-ATOK-001',
        date: '2026-06-29T05:40:00.000Z', time: '5:40 AM',
        barangay: 'Paoay', address: 'Sitio Sayangan, Paoay, Atok, Benguet',
        category: 'RESIDENTIAL', sub: 'Single and Two-Family Dwelling',
        desc: 'Kitchen-area fire in a residential structure. The fire was contained before spreading to adjacent rooms.',
        area: '10 square meters', damage: 38000, injured: 0,
        cause: 'Unattended cooking appliance',
        findings: 'Burn marks and witness statements point to the cooking area as the origin.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-ATOK-002',
        date: '2026-06-30T13:20:00.000Z', time: '1:20 PM',
        barangay: 'Cattubo', address: 'Farm access road, Cattubo, Atok, Benguet',
        category: 'NON_STRUCTURAL', sub: 'Grass Fire',
        desc: 'Grass fire near a farm access road. Responding personnel completed mop-up and perimeter checking.',
        area: '0.15 hectare', damage: 9000, injured: 0,
        cause: 'Open flame from roadside burning',
        findings: 'Fire spread from roadside vegetation toward a cleared farm boundary.',
      },
    ],
    officers: {
      primary: 'FO3 Carlo Bay-an', primaryRank: 'Fire Officer III',
      secondary: 'FO2 Mara Baucas', secondaryRank: 'Fire Officer II',
      commander: 'SINSP Elena Fianza', engine: 'Atok FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-29T07:15:00.000Z', sub: '2026-06-29T07:45:00.000Z' },
      r2: { report: '2026-06-29T10:30:00.000Z', sub: '2026-06-29T10:50:00.000Z' },
      r3: { report: '2026-06-30T15:00:00.000Z', sub: '2026-06-30T15:25:00.000Z', rev: '2026-06-30T16:10:00.000Z' },
      r4: { report: '2026-06-30T09:00:00.000Z', sub: '2026-06-30T09:30:00.000Z', rev: '2026-06-30T17:20:00.000Z' },
      r5: { report: '2026-06-30T14:15:00.000Z', sub: '2026-06-30T14:40:00.000Z', rev: '2026-06-30T15:05:00.000Z' },
      r6: { report: '2026-06-30T16:30:00.000Z', sub: '2026-06-30T16:45:00.000Z', rev: '2026-06-30T16:20:00.000Z' },
    },
  },
  {
    code: 'BAKUN', idx: 1, name: 'Bakun',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-BAKUN-001',
        date: '2026-06-20T06:10:00.000Z', time: '6:10 AM',
        barangay: 'Dalipey', address: 'Barangay Proper, Dalipey, Bakun, Benguet',
        category: 'RESIDENTIAL', sub: 'Single and Two-Family Dwelling',
        desc: 'Early morning kitchen fire in a two-storey residential building. Neighbors reported fire and assisted in evacuation.',
        area: '14 square meters', damage: 42000, injured: 0,
        cause: 'Unattended cooking stove',
        findings: 'Point of origin identified at the ground-floor kitchen. LPG stove burner was left on overnight.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-BAKUN-002',
        date: '2026-06-21T11:30:00.000Z', time: '11:30 AM',
        barangay: 'Gambang', address: 'Hillside terrace, Gambang, Bakun, Benguet',
        category: 'NON_STRUCTURAL', sub: 'Forest Fire',
        desc: 'Forest fire on terraced hillside farmland. Fire was contained after a two-hour response by ground team.',
        area: '0.4 hectare', damage: 15000, injured: 0,
        cause: 'Unauthorized burning of agricultural waste',
        findings: 'Fire origin traced to a cleared plot where farm waste was burned without a permit.',
      },
    ],
    officers: {
      primary: 'FO2 Joel Masweng', primaryRank: 'Fire Officer II',
      secondary: 'FO2 Nina Aguid', secondaryRank: 'Fire Officer II',
      commander: 'INSP Liza Bugnay', engine: 'Bakun FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-20T08:00:00.000Z', sub: '2026-06-20T08:30:00.000Z' },
      r2: { report: '2026-06-20T11:00:00.000Z', sub: '2026-06-20T11:20:00.000Z' },
      r3: { report: '2026-06-21T13:30:00.000Z', sub: '2026-06-21T13:55:00.000Z', rev: '2026-06-21T14:40:00.000Z' },
      r4: { report: '2026-06-21T09:00:00.000Z', sub: '2026-06-21T09:30:00.000Z', rev: '2026-06-22T10:00:00.000Z' },
      r5: { report: '2026-06-21T12:00:00.000Z', sub: '2026-06-21T12:25:00.000Z', rev: '2026-06-21T13:10:00.000Z' },
      r6: { report: '2026-06-22T08:00:00.000Z', sub: '2026-06-22T08:20:00.000Z', rev: '2026-06-22T07:50:00.000Z' },
    },
  },
  {
    code: 'BOKOD', idx: 2, name: 'Bokod',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-BOKOD-001',
        date: '2026-06-18T14:55:00.000Z', time: '2:55 PM',
        barangay: 'Ekip', address: 'Purok 2, Ekip, Bokod, Benguet',
        category: 'NON_RESIDENTIAL', sub: 'Educational',
        desc: 'Afternoon fire started in a school supply storage room. Teachers and students had already left. Minimal classroom damage.',
        area: '22 square meters', damage: 95000, injured: 0,
        cause: 'Electrical overload in storage area',
        findings: 'Overloaded power strip ignited combustible school supplies. Wiring passed initial visual check but showed heat damage.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-BOKOD-002',
        date: '2026-06-19T09:20:00.000Z', time: '9:20 AM',
        barangay: 'Nawal', address: 'Roadside slope, Nawal, Bokod, Benguet',
        category: 'NON_STRUCTURAL', sub: 'Grass Fire',
        desc: 'Grass fire along a road embankment. Wind spread the fire upslope before the responding team arrived.',
        area: '0.2 hectare', damage: 8000, injured: 0,
        cause: 'Discarded cigarette near dry vegetation',
        findings: 'Burn origin consistent with roadside ignition. Dry season conditions accelerated spread.',
      },
    ],
    officers: {
      primary: 'FO3 Rey Bakang', primaryRank: 'Fire Officer III',
      secondary: 'FO2 Amy Pakak', secondaryRank: 'Fire Officer II',
      commander: 'SINSP Danilo Kiyas', engine: 'Bokod FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-18T16:30:00.000Z', sub: '2026-06-18T17:00:00.000Z' },
      r2: { report: '2026-06-18T18:00:00.000Z', sub: '2026-06-18T18:20:00.000Z' },
      r3: { report: '2026-06-19T11:00:00.000Z', sub: '2026-06-19T11:30:00.000Z', rev: '2026-06-19T12:15:00.000Z' },
      r4: { report: '2026-06-19T08:30:00.000Z', sub: '2026-06-19T09:00:00.000Z', rev: '2026-06-20T10:00:00.000Z' },
      r5: { report: '2026-06-19T10:00:00.000Z', sub: '2026-06-19T10:20:00.000Z', rev: '2026-06-19T11:00:00.000Z' },
      r6: { report: '2026-06-20T09:00:00.000Z', sub: '2026-06-20T09:20:00.000Z', rev: '2026-06-20T09:00:00.000Z' },
    },
  },
  {
    code: 'BUGUIAS', idx: 3, name: 'Buguias',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-BUGUIAS-001',
        date: '2026-06-22T08:45:00.000Z', time: '8:45 AM',
        barangay: 'Abatan', address: 'Km. 47, Abatan Market Road, Buguias, Benguet',
        category: 'NON_RESIDENTIAL', sub: 'Mercantile',
        desc: 'Market stall fire at the Abatan trading post. Three adjacent stalls suffered partial smoke damage.',
        area: '30 square meters', damage: 120000, injured: 1,
        cause: 'Electrical short circuit from unauthorized wiring',
        findings: 'Improvised electrical tap showed heat fractures. Stall owner reported lights flickering the previous night.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-BUGUIAS-002',
        date: '2026-06-23T15:00:00.000Z', time: '3:00 PM',
        barangay: 'Lengaoan', address: 'National Highway, Lengaoan, Buguias, Benguet',
        category: 'TRANSPORT', sub: 'Jeepney',
        desc: 'Jeepney engine compartment fire on the highway. All passengers alighted safely before fire spread to the cabin.',
        area: 'Engine and front cabin', damage: 85000, injured: 0,
        cause: 'Fuel line leak near hot engine components',
        findings: 'Cracked fuel hose near the exhaust manifold caused ignition. Vehicle had not undergone recent maintenance.',
      },
    ],
    officers: {
      primary: 'FO3 Mark Buyacao', primaryRank: 'Fire Officer III',
      secondary: 'FO2 Jenny Lumas', secondaryRank: 'Fire Officer II',
      commander: 'INSP Alfred Lacson', engine: 'Buguias FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-22T10:00:00.000Z', sub: '2026-06-22T10:30:00.000Z' },
      r2: { report: '2026-06-22T13:00:00.000Z', sub: '2026-06-22T13:20:00.000Z' },
      r3: { report: '2026-06-23T17:00:00.000Z', sub: '2026-06-23T17:25:00.000Z', rev: '2026-06-23T18:10:00.000Z' },
      r4: { report: '2026-06-23T09:00:00.000Z', sub: '2026-06-23T09:30:00.000Z', rev: '2026-06-24T10:00:00.000Z' },
      r5: { report: '2026-06-23T16:00:00.000Z', sub: '2026-06-23T16:25:00.000Z', rev: '2026-06-23T17:00:00.000Z' },
      r6: { report: '2026-06-24T08:00:00.000Z', sub: '2026-06-24T08:20:00.000Z', rev: '2026-06-24T08:00:00.000Z' },
    },
  },
  {
    code: 'ITOGON', idx: 4, name: 'Itogon',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-ITOGON-001',
        date: '2026-06-26T14:15:00.000Z', time: '2:15 PM',
        barangay: 'Ucab', address: 'Hillside footpath near Sitio Keystone, Itogon, Benguet',
        category: 'NON_STRUCTURAL', sub: 'Grass Fire',
        desc: 'Grass fire along a hillside trail. The incident was contained with no damage to nearby homes.',
        area: '0.3 hectare', damage: 12000, injured: 0,
        cause: 'Discarded smoking material',
        findings: 'Burn pattern indicates ignition near the footpath before wind-driven spread upslope.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-ITOGON-002',
        date: '2026-06-27T10:40:00.000Z', time: '10:40 AM',
        barangay: 'Tuding', address: 'Mining compound, Tuding, Itogon, Benguet',
        category: 'NON_RESIDENTIAL', sub: 'Industrial',
        desc: 'Equipment shed fire in a small-scale mining compound. Workers evacuated the area before fire team arrived.',
        area: '45 square meters', damage: 210000, injured: 0,
        cause: 'Welding sparks on nearby combustible material',
        findings: 'Welding work was being conducted near wooden storage racks. No fire watch was posted.',
      },
    ],
    officers: {
      primary: 'FO3 Hanna Baniaga', primaryRank: 'Fire Officer III',
      secondary: 'FO2 Pete Dalupan', secondaryRank: 'Fire Officer II',
      commander: 'INSP Paolo Dominguez', engine: 'Itogon FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-26T16:00:00.000Z', sub: '2026-06-26T16:30:00.000Z' },
      r2: { report: '2026-06-26T17:30:00.000Z', sub: '2026-06-26T17:50:00.000Z' },
      r3: { report: '2026-06-27T12:30:00.000Z', sub: '2026-06-27T12:55:00.000Z', rev: '2026-06-27T13:40:00.000Z' },
      r4: { report: '2026-06-27T09:00:00.000Z', sub: '2026-06-27T09:30:00.000Z', rev: '2026-06-28T10:00:00.000Z' },
      r5: { report: '2026-06-27T11:30:00.000Z', sub: '2026-06-27T11:55:00.000Z', rev: '2026-06-27T12:30:00.000Z' },
      r6: { report: '2026-06-28T08:00:00.000Z', sub: '2026-06-28T08:20:00.000Z', rev: '2026-06-28T07:50:00.000Z' },
    },
  },
  {
    code: 'KABAYAN', idx: 5, name: 'Kabayan',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-KABAYAN-001',
        date: '2026-06-15T19:25:00.000Z', time: '7:25 PM',
        barangay: 'Kabayan Proper', address: 'Poblacion Area, Kabayan, Benguet',
        category: 'RESIDENTIAL', sub: 'Single and Two-Family Dwelling',
        desc: 'Evening kitchen fire involving a wooden-walled dwelling. Fire was controlled before spreading to adjacent structure.',
        area: '16 square meters', damage: 55000, injured: 0,
        cause: 'Overheated cooking oil',
        findings: 'Frying pan left unattended caused grease fire. No suppression equipment was available on-site.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-KABAYAN-002',
        date: '2026-06-16T12:00:00.000Z', time: '12:00 PM',
        barangay: 'Adaoay', address: 'Roadside, Adaoay, Kabayan, Benguet',
        category: 'NON_STRUCTURAL', sub: 'Rubbish Fire',
        desc: 'Rubbish pile fire along the roadside. Fire threatened nearby wooden fencing but was contained quickly.',
        area: '5 square meters', damage: 2000, injured: 0,
        cause: 'Open burning of garbage',
        findings: 'Unattended garbage pile was ignited by residents. Wind shifted flame toward roadside vegetation.',
      },
    ],
    officers: {
      primary: 'FO2 Rico Lingayo', primaryRank: 'Fire Officer II',
      secondary: 'FO2 Luz Abatan', secondaryRank: 'Fire Officer II',
      commander: 'INSP Efren Catbagan', engine: 'Kabayan FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-15T21:00:00.000Z', sub: '2026-06-15T21:30:00.000Z' },
      r2: { report: '2026-06-16T08:00:00.000Z', sub: '2026-06-16T08:20:00.000Z' },
      r3: { report: '2026-06-16T14:00:00.000Z', sub: '2026-06-16T14:25:00.000Z', rev: '2026-06-16T15:10:00.000Z' },
      r4: { report: '2026-06-16T09:00:00.000Z', sub: '2026-06-16T09:30:00.000Z', rev: '2026-06-17T10:00:00.000Z' },
      r5: { report: '2026-06-16T13:00:00.000Z', sub: '2026-06-16T13:20:00.000Z', rev: '2026-06-16T14:00:00.000Z' },
      r6: { report: '2026-06-17T08:00:00.000Z', sub: '2026-06-17T08:20:00.000Z', rev: '2026-06-17T07:50:00.000Z' },
    },
  },
  {
    code: 'KAPANGAN', idx: 6, name: 'Kapangan',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-KAPANGAN-001',
        date: '2026-06-17T07:50:00.000Z', time: '7:50 AM',
        barangay: 'Kapangan Proper', address: 'Barangay Hall Road, Kapangan, Benguet',
        category: 'RESIDENTIAL', sub: 'Apartment, Condominium, Dormitory, Hotel, Motel',
        desc: 'Early morning fire in a boarding house. Five occupants evacuated safely. Two rooms were destroyed.',
        area: '28 square meters', damage: 78000, injured: 1,
        cause: 'Faulty electrical wiring',
        findings: 'Old wiring insulation had deteriorated. A short circuit in the common area triggered the fire.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-KAPANGAN-002',
        date: '2026-06-18T16:30:00.000Z', time: '4:30 PM',
        barangay: 'Datakan', address: 'Municipal Road, Datakan, Kapangan, Benguet',
        category: 'TRANSPORT', sub: 'Motorcycle',
        desc: 'Motorcycle engine fire on the municipal road. Rider was uninjured and moved away from the vehicle before fire spread.',
        area: 'Engine and fuel tank area', damage: 25000, injured: 0,
        cause: 'Fuel leak on a hot engine',
        findings: 'Fuel cap was loose and gasoline dripped onto exhaust. Rider stated the engine had been idling for 30 minutes.',
      },
    ],
    officers: {
      primary: 'FO3 Ben Banao', primaryRank: 'Fire Officer III',
      secondary: 'FO2 Rosa Tagaya', secondaryRank: 'Fire Officer II',
      commander: 'SINSP Noel Carino', engine: 'Kapangan FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-17T09:30:00.000Z', sub: '2026-06-17T10:00:00.000Z' },
      r2: { report: '2026-06-17T12:00:00.000Z', sub: '2026-06-17T12:20:00.000Z' },
      r3: { report: '2026-06-18T18:00:00.000Z', sub: '2026-06-18T18:25:00.000Z', rev: '2026-06-18T19:10:00.000Z' },
      r4: { report: '2026-06-18T09:00:00.000Z', sub: '2026-06-18T09:30:00.000Z', rev: '2026-06-19T10:00:00.000Z' },
      r5: { report: '2026-06-18T17:00:00.000Z', sub: '2026-06-18T17:25:00.000Z', rev: '2026-06-18T18:00:00.000Z' },
      r6: { report: '2026-06-19T08:00:00.000Z', sub: '2026-06-19T08:20:00.000Z', rev: '2026-06-19T07:50:00.000Z' },
    },
  },
  {
    code: 'KIBUNGAN', idx: 7, name: 'Kibungan',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-KIBUNGAN-001',
        date: '2026-06-19T10:05:00.000Z', time: '10:05 AM',
        barangay: 'Kibungan Proper', address: 'Market Area, Kibungan, Benguet',
        category: 'NON_RESIDENTIAL', sub: 'Mercantile',
        desc: 'Fire at a small grocery store. Owner extinguished the initial flame but called responders when fire rekindled.',
        area: '20 square meters', damage: 65000, injured: 0,
        cause: 'Overloaded extension cord near LPG cylinder',
        findings: 'Extension cord overheating ignited flammable packaging near a stored LPG cylinder that was promptly moved.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-KIBUNGAN-002',
        date: '2026-06-20T13:50:00.000Z', time: '1:50 PM',
        barangay: 'Badeo', address: 'Agricultural area, Badeo, Kibungan, Benguet',
        category: 'NON_STRUCTURAL', sub: 'Agricultural Land',
        desc: 'Agricultural land fire in a vegetable farming area. Responders contained fire before it reached the residential cluster.',
        area: '0.25 hectare', damage: 18000, injured: 0,
        cause: 'Burning of post-harvest crop residue',
        findings: 'Uncontrolled crop burning spread to adjacent plots due to dry wind conditions.',
      },
    ],
    officers: {
      primary: 'FO2 Sam Pagdilao', primaryRank: 'Fire Officer II',
      secondary: 'FO2 May Balangay', secondaryRank: 'Fire Officer II',
      commander: 'INSP Jesus Alawas', engine: 'Kibungan FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-19T11:45:00.000Z', sub: '2026-06-19T12:10:00.000Z' },
      r2: { report: '2026-06-19T14:00:00.000Z', sub: '2026-06-19T14:20:00.000Z' },
      r3: { report: '2026-06-20T15:30:00.000Z', sub: '2026-06-20T15:55:00.000Z', rev: '2026-06-20T16:40:00.000Z' },
      r4: { report: '2026-06-20T09:00:00.000Z', sub: '2026-06-20T09:30:00.000Z', rev: '2026-06-21T10:00:00.000Z' },
      r5: { report: '2026-06-20T14:30:00.000Z', sub: '2026-06-20T14:55:00.000Z', rev: '2026-06-20T15:30:00.000Z' },
      r6: { report: '2026-06-21T08:00:00.000Z', sub: '2026-06-21T08:20:00.000Z', rev: '2026-06-21T07:50:00.000Z' },
    },
  },
  {
    code: 'LT', idx: 8, name: 'La Trinidad',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-LT-001',
        date: '2026-06-24T10:25:00.000Z', time: '10:25 AM',
        barangay: 'Poblacion', address: 'Public Market Extension, Km. 5, La Trinidad, Benguet',
        category: 'NON_RESIDENTIAL', sub: 'Business',
        desc: 'Small fire observed at a dry goods stall storage area. Responders contained the fire before spread to adjacent stalls.',
        area: '18 square meters', damage: 85000, injured: 0,
        cause: 'Overheated extension cord',
        findings: 'Combustible packaging was stored beside an overloaded outlet. No casualties reported.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-LT-002',
        date: '2026-06-25T19:40:00.000Z', time: '7:40 PM',
        barangay: 'Balili', address: 'Purok 3, Balili, La Trinidad, Benguet',
        category: 'RESIDENTIAL', sub: 'Single and Two-Family Dwelling',
        desc: 'Residential kitchen fire reported by neighbors. First arriving unit declared fire under control within eight minutes.',
        area: '12 square meters', damage: 45000, injured: 1,
        cause: 'Unattended cooking',
        findings: 'Fire originated near the cooking area. One occupant sustained minor burns.',
      },
    ],
    officers: {
      primary: 'FO3 Miguel Torres', primaryRank: 'Fire Officer III',
      secondary: 'FO2 Clarisse Dangan', secondaryRank: 'Fire Officer II',
      commander: 'SINSP Andrea Ramos', engine: 'La Trinidad FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-24T11:30:00.000Z', sub: '2026-06-24T12:10:00.000Z' },
      r2: { report: '2026-06-24T15:30:00.000Z', sub: '2026-06-24T15:50:00.000Z' },
      r3: { report: '2026-06-25T21:00:00.000Z', sub: '2026-06-25T21:45:00.000Z', rev: '2026-06-26T08:20:00.000Z' },
      r4: { report: '2026-06-25T09:00:00.000Z', sub: '2026-06-25T09:30:00.000Z', rev: '2026-06-26T10:00:00.000Z' },
      r5: { report: '2026-06-25T20:00:00.000Z', sub: '2026-06-25T20:25:00.000Z', rev: '2026-06-25T21:00:00.000Z' },
      r6: { report: '2026-06-26T09:00:00.000Z', sub: '2026-06-26T09:20:00.000Z', rev: '2026-06-26T09:00:00.000Z' },
    },
  },
  {
    code: 'MANKAYAN', idx: 9, name: 'Mankayan',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-MANKAYAN-001',
        date: '2026-06-21T09:30:00.000Z', time: '9:30 AM',
        barangay: 'Colalo', address: 'Mining support facility, Colalo, Mankayan, Benguet',
        category: 'NON_RESIDENTIAL', sub: 'Industrial',
        desc: 'Fire at a mining support building. Fire suppression by in-house team reduced spread; BFP unit performed final extinguishment.',
        area: '35 square meters', damage: 180000, injured: 0,
        cause: 'Electrical fault in compressor room',
        findings: 'Compressor overheating caused insulation to catch fire. Periodic maintenance records were absent.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-MANKAYAN-002',
        date: '2026-06-22T07:15:00.000Z', time: '7:15 AM',
        barangay: 'Paco', address: 'National Highway, Paco, Mankayan, Benguet',
        category: 'TRANSPORT', sub: 'Truck',
        desc: 'Delivery truck engine fire on the national highway. Cargo of general goods was unloaded safely before fire spread.',
        area: 'Engine compartment and cab', damage: 150000, injured: 0,
        cause: 'Electrical short in wiring harness',
        findings: 'Wiring harness near the battery showed melting and arcing. Probable cause: rodent damage to insulation.',
      },
    ],
    officers: {
      primary: 'FO3 Dave Manggi', primaryRank: 'Fire Officer III',
      secondary: 'FO2 Iris Bulayog', secondaryRank: 'Fire Officer II',
      commander: 'INSP Henry Tabanda', engine: 'Mankayan FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-21T11:00:00.000Z', sub: '2026-06-21T11:30:00.000Z' },
      r2: { report: '2026-06-21T14:00:00.000Z', sub: '2026-06-21T14:20:00.000Z' },
      r3: { report: '2026-06-22T09:00:00.000Z', sub: '2026-06-22T09:25:00.000Z', rev: '2026-06-22T10:10:00.000Z' },
      r4: { report: '2026-06-22T08:00:00.000Z', sub: '2026-06-22T08:30:00.000Z', rev: '2026-06-23T10:00:00.000Z' },
      r5: { report: '2026-06-22T08:00:00.000Z', sub: '2026-06-22T08:25:00.000Z', rev: '2026-06-22T09:00:00.000Z' },
      r6: { report: '2026-06-23T08:00:00.000Z', sub: '2026-06-23T08:20:00.000Z', rev: '2026-06-23T07:50:00.000Z' },
    },
  },
  {
    code: 'SABLAN', idx: 10, name: 'Sablan',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-SABLAN-001',
        date: '2026-06-23T17:10:00.000Z', time: '5:10 PM',
        barangay: 'Sablan Proper', address: 'Barangay Center, Sablan, Benguet',
        category: 'RESIDENTIAL', sub: 'Single and Two-Family Dwelling',
        desc: 'Afternoon kitchen fire in a single-family dwelling. Occupants were home and used a fire extinguisher before calling responders.',
        area: '8 square meters', damage: 22000, injured: 0,
        cause: 'Grease fire from unattended frying',
        findings: 'Cooking oil overheated and ignited. Owner used a dry chemical extinguisher which reduced damage significantly.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-SABLAN-002',
        date: '2026-06-24T11:45:00.000Z', time: '11:45 AM',
        barangay: 'Poblacion', address: 'Electrical post along barangay road, Sablan, Benguet',
        category: 'NON_STRUCTURAL', sub: 'Electrical Post Fire',
        desc: 'Fire on an electrical distribution post caused a brief power outage. Utilities crew assisted after BFP secured the area.',
        area: 'Distribution line transformer', damage: 35000, injured: 0,
        cause: 'Transformer overload',
        findings: 'Local transformer showed signs of long-term overloading. Utility provider confirmed equipment age exceeded service life.',
      },
    ],
    officers: {
      primary: 'FO2 Chris Bangwisan', primaryRank: 'Fire Officer II',
      secondary: 'FO2 Lea Bayos', secondaryRank: 'Fire Officer II',
      commander: 'INSP Teresita Cawis', engine: 'Sablan FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-23T18:30:00.000Z', sub: '2026-06-23T19:00:00.000Z' },
      r2: { report: '2026-06-24T08:00:00.000Z', sub: '2026-06-24T08:20:00.000Z' },
      r3: { report: '2026-06-24T13:30:00.000Z', sub: '2026-06-24T13:55:00.000Z', rev: '2026-06-24T14:40:00.000Z' },
      r4: { report: '2026-06-24T09:00:00.000Z', sub: '2026-06-24T09:30:00.000Z', rev: '2026-06-25T10:00:00.000Z' },
      r5: { report: '2026-06-24T12:30:00.000Z', sub: '2026-06-24T12:55:00.000Z', rev: '2026-06-24T13:30:00.000Z' },
      r6: { report: '2026-06-25T08:00:00.000Z', sub: '2026-06-25T08:20:00.000Z', rev: '2026-06-25T07:50:00.000Z' },
    },
  },
  {
    code: 'TUBA', idx: 11, name: 'Tuba',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-TUBA-001',
        date: '2026-06-27T06:05:00.000Z', time: '6:05 AM',
        barangay: 'Camp 6', address: 'Kennon Road shoulder, Camp 6, Tuba, Benguet',
        category: 'TRANSPORT', sub: 'Truck',
        desc: 'Smoke and flame reported from a delivery truck engine compartment. Fire was extinguished before cargo involvement.',
        area: 'Engine compartment only', damage: 175000, injured: 0,
        cause: 'Electrical short circuit',
        findings: 'Battery cable insulation showed thermal damage consistent with short circuit ignition.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-TUBA-002',
        date: '2026-06-28T14:00:00.000Z', time: '2:00 PM',
        barangay: 'Naguey', address: 'Pine forest road, Naguey, Tuba, Benguet',
        category: 'NON_STRUCTURAL', sub: 'Forest Fire',
        desc: 'Forest fire along a mountain road. Responding team established a firebreak to prevent spread toward residential sitio.',
        area: '0.6 hectare', damage: 28000, injured: 0,
        cause: 'Undetermined — possibly discarded smoking material',
        findings: 'No definitive ignition point identified. Burn pattern consistent with wind-driven spread from roadside.',
      },
    ],
    officers: {
      primary: 'FO3 Jay Tayaban', primaryRank: 'Fire Officer III',
      secondary: 'FO2 Alma Bangyay', secondaryRank: 'Fire Officer II',
      commander: 'SINSP Renato Ponce', engine: 'Tuba FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-27T08:00:00.000Z', sub: '2026-06-27T08:30:00.000Z' },
      r2: { report: '2026-06-27T10:00:00.000Z', sub: '2026-06-27T10:20:00.000Z' },
      r3: { report: '2026-06-28T16:00:00.000Z', sub: '2026-06-28T16:25:00.000Z', rev: '2026-06-28T17:10:00.000Z' },
      r4: { report: '2026-06-28T09:00:00.000Z', sub: '2026-06-28T09:30:00.000Z', rev: '2026-06-29T10:00:00.000Z' },
      r5: { report: '2026-06-28T15:00:00.000Z', sub: '2026-06-28T15:25:00.000Z', rev: '2026-06-28T16:00:00.000Z' },
      r6: { report: '2026-06-29T08:00:00.000Z', sub: '2026-06-29T08:20:00.000Z', rev: '2026-06-29T07:50:00.000Z' },
    },
  },
  {
    code: 'TUBLAY', idx: 12, name: 'Tublay',
    incidents: [
      {
        num: 1, ref: 'BFP-BEN-2026-DEMO-TUBLAY-001',
        date: '2026-06-16T08:20:00.000Z', time: '8:20 AM',
        barangay: 'Tublay Proper', address: 'Purok 1, Tublay Central, Tublay, Benguet',
        category: 'RESIDENTIAL', sub: 'Single and Two-Family Dwelling',
        desc: 'Morning fire that started inside the kitchen of a residential building. One room destroyed; structure partially damaged.',
        area: '15 square meters', damage: 48000, injured: 0,
        cause: 'Gas burner left on after cooking',
        findings: 'LPG burner was still open when occupant left for work. Accumulated gas was ignited by a pilot light.',
      },
      {
        num: 2, ref: 'BFP-BEN-2026-DEMO-TUBLAY-002',
        date: '2026-06-17T15:35:00.000Z', time: '3:35 PM',
        barangay: 'Caponga', address: 'Slope area, Caponga, Tublay, Benguet',
        category: 'NON_STRUCTURAL', sub: 'Grass Fire',
        desc: 'Grass fire on a slope below a residential area. Firebreak was established to protect nearby houses.',
        area: '0.18 hectare', damage: 7000, injured: 0,
        cause: 'Uncontrolled burning of weeds',
        findings: 'Landowner was conducting weed clearing when fire spread beyond the intended area.',
      },
    ],
    officers: {
      primary: 'FO2 Art Bidang', primaryRank: 'Fire Officer II',
      secondary: 'FO2 Marie Sanog', secondaryRank: 'Fire Officer II',
      commander: 'INSP Victor Laoyan', engine: 'Tublay FS Engine 1',
    },
    reportDates: {
      r1: { report: '2026-06-16T10:00:00.000Z', sub: '2026-06-16T10:30:00.000Z' },
      r2: { report: '2026-06-16T13:00:00.000Z', sub: '2026-06-16T13:20:00.000Z' },
      r3: { report: '2026-06-17T17:00:00.000Z', sub: '2026-06-17T17:25:00.000Z', rev: '2026-06-17T18:10:00.000Z' },
      r4: { report: '2026-06-17T09:00:00.000Z', sub: '2026-06-17T09:30:00.000Z', rev: '2026-06-18T10:00:00.000Z' },
      r5: { report: '2026-06-17T16:00:00.000Z', sub: '2026-06-17T16:25:00.000Z', rev: '2026-06-17T17:00:00.000Z' },
      r6: { report: '2026-06-18T08:00:00.000Z', sub: '2026-06-18T08:20:00.000Z', rev: '2026-06-18T07:50:00.000Z' },
    },
  },
];

// Build lookup map by code
const MUN_MAP = Object.fromEntries(MUNICIPALITY_CONFIGS.map((m) => [m.code, m]));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMunCodeFromUser(user) {
  if (!user?.email) return null;
  const localPart = user.email.split('@')[0]; // e.g., "investigator.atok" or "chief.iis.lt"
  const segments = localPart.split('.');
  const lastSegment = segments[segments.length - 1].toUpperCase();
  return MUN_MAP[lastSegment] ? lastSegment : null;
}

function makeUserObj(role, code, name, idx, currentUser) {
  const codeLower = code.toLowerCase();
  const emailByRole = {
    [ROLES.INVESTIGATOR]: `investigator.${codeLower}@bfp-benguet.gov.ph`,
    [ROLES.MUNICIPAL_CHIEF_IIS]: `chief.iis.${codeLower}@bfp-benguet.gov.ph`,
    [ROLES.MUNICIPAL_CHIEF_OPERATION]: `chief.operation.${codeLower}@bfp-benguet.gov.ph`,
    [ROLES.MUNICIPAL_FIRE_MARSHAL]: `marshal.${codeLower}@bfp-benguet.gov.ph`,
    [ROLES.PROVINCIAL_CHIEF_IIS]: 'provincial.chief.iis@bfp-benguet.gov.ph',
  };
  const nameByRole = {
    [ROLES.INVESTIGATOR]: `${name} Municipal Investigator`,
    [ROLES.MUNICIPAL_CHIEF_IIS]: `${name} Municipal Chief IIS`,
    [ROLES.MUNICIPAL_CHIEF_OPERATION]: `${name} Municipal Chief Operation`,
    [ROLES.MUNICIPAL_FIRE_MARSHAL]: `${name} Municipal Fire Marshal`,
    [ROLES.PROVINCIAL_CHIEF_IIS]: 'Provincial Chief IIS',
  };
  const roleIdx = [
    ROLES.INVESTIGATOR,
    ROLES.MUNICIPAL_CHIEF_IIS,
    ROLES.MUNICIPAL_CHIEF_OPERATION,
    ROLES.MUNICIPAL_FIRE_MARSHAL,
    ROLES.PROVINCIAL_CHIEF_IIS,
  ].indexOf(role);

  return {
    id: currentUser?.role === role ? currentUser.id : -(idx * 10 + roleIdx + 1) * 100,
    name: nameByRole[role],
    email: emailByRole[role],
    rank: role === ROLES.INVESTIGATOR ? 'Fire Officer III' : undefined,
    role,
  };
}

function buildIncident(cfg, incData) {
  const munId = -(cfg.idx + 1) * 1000;
  return {
    id: -(cfg.idx * 100 + incData.num),
    referenceNumber: incData.ref,
    municipalityId: munId,
    municipality: { id: munId, name: cfg.name, code: cfg.code },
    dateOfIncident: incData.date,
    timeOfIncident: incData.time,
    barangay: incData.barangay,
    address: incData.address,
    generalCategory: incData.category,
    subCategory: incData.sub,
    description: incData.desc,
    estimatedAffectedArea: incData.area,
    status: 'EXTINGUISHED',
    casualtiesInjured: incData.injured || 0,
    casualtiesFatalities: 0,
    estimatedDamage: incData.damage,
    causeOfFire: incData.cause,
    fireInvestigationFindings: incData.findings,
  };
}

function buildReport({
  id, reportType, status, munId, munName, munCode,
  linkedIncident, reportDate, submittedAt, reviewedAt,
  submittedBy, passedToRole, passedTo, reviewedBy, remarks,
  content, respondingUnits, respondingOfficer, reportingOfficerRank, stationCommanderName,
}) {
  return {
    id,
    reportType,
    status,
    municipalityId: munId,
    municipality: { id: munId, name: munName, code: munCode },
    incidentId: linkedIncident?.id || null,
    incident: linkedIncident || null,
    reportDate,
    content: JSON.stringify(content),
    respondingUnits,
    respondingOfficer,
    reportingOfficerRank,
    stationCommanderName,
    remarks: remarks || null,
    passedToRole: passedToRole || null,
    passedToId: passedTo?.id || null,
    passedTo: passedTo || null,
    submittedAt,
    reviewedAt: reviewedAt || null,
    reviewedById: reviewedBy?.id || null,
    reviewedBy: reviewedBy || null,
    submittedById: submittedBy.id,
    submittedBy,
    attachments: ATTACHMENTS,
    createdAt: submittedAt,
    updatedAt: reviewedAt || submittedAt,
    isDemo: true,
  };
}

const addHours = (iso, hours) => new Date(new Date(iso).getTime() + hours * 3600000).toISOString();

function generateDemoReportsForMunicipality(cfg, currentUser) {
  const { code, idx, name, incidents, officers, reportDates } = cfg;
  const munId = -(idx + 1) * 1000;
  const munInfo = { id: munId, name, code };

  const submitter = makeUserObj(ROLES.INVESTIGATOR, code, name, idx, currentUser);
  const chiefIis = makeUserObj(ROLES.MUNICIPAL_CHIEF_IIS, code, name, idx, currentUser);
  const chiefOp = makeUserObj(ROLES.MUNICIPAL_CHIEF_OPERATION, code, name, idx, currentUser);
  const marshal = makeUserObj(ROLES.MUNICIPAL_FIRE_MARSHAL, code, name, idx, currentUser);
  const provincial = makeUserObj(ROLES.PROVINCIAL_CHIEF_IIS, code, name, idx, currentUser);

  const inc1 = buildIncident(cfg, incidents[0]);
  const inc2 = buildIncident(cfg, incidents[1]);

  const baseArgs = {
    munId, munName: name, munCode: code,
    respondingUnits: `${officers.engine}`,
    stationCommanderName: officers.commander,
  };

  return [
    // R1 — MDFIR submitted to Municipal Chief IIS
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 1),
      reportType: 'MDFIR',
      status: 'SUBMITTED',
      linkedIncident: inc1,
      reportDate: reportDates.r1.report,
      submittedAt: reportDates.r1.sub,
      submittedBy: submitter,
      passedToRole: ROLES.MUNICIPAL_CHIEF_IIS,
      passedTo: chiefIis,
      respondingOfficer: officers.primary,
      reportingOfficerRank: officers.primaryRank,
      content: {
        incidentReference: inc1.referenceNumber,
        location: `${inc1.barangay}, ${name}`,
        occupancyType: `${inc1.subCategory}`,
        estimatedDamage: `PHP ${inc1.estimatedDamage.toLocaleString()}`,
        actionTaken: 'Scene documented, witnesses interviewed, and photographs taken',
        recommendation: 'For Municipal Chief IIS review',
      },
    }),
    // R2 — Progress submitted to Municipal Chief Operation
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 2),
      reportType: 'PROGRESS_INVESTIGATION',
      status: 'SUBMITTED',
      linkedIncident: inc1,
      reportDate: reportDates.r2.report,
      submittedAt: reportDates.r2.sub,
      submittedBy: submitter,
      passedToRole: ROLES.MUNICIPAL_CHIEF_OPERATION,
      passedTo: chiefOp,
      respondingUnits: `${officers.engine}, Barangay ${inc1.barangay} responders`,
      respondingOfficer: officers.primary,
      reportingOfficerRank: officers.primaryRank,
      content: {
        incidentReference: inc1.referenceNumber,
        operationalConcern: 'Narrow access road required careful apparatus positioning.',
        resourcesUsed: `One engine company and barangay responders`,
        coordinationNeeded: 'Operational review requested for access-route notes',
        currentStatus: 'Submitted to Municipal Chief Operation',
      },
    }),
    // R3 — Spot approved by Chief IIS, ready for investigator to forward to Marshal
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 3),
      reportType: 'SPOT_INVESTIGATION',
      status: 'APPROVED',
      linkedIncident: inc2,
      reportDate: reportDates.r3.report,
      submittedAt: reportDates.r3.sub,
      reviewedAt: reportDates.r3.rev,
      submittedBy: submitter,
      passedToRole: ROLES.INVESTIGATOR,
      passedTo: submitter,
      reviewedBy: chiefIis,
      remarks: `Approved — ready to pass to the Municipal Fire Marshal.`,
      respondingOfficer: officers.secondary,
      reportingOfficerRank: officers.secondaryRank,
      content: {
        incidentReference: inc2.referenceNumber,
        pointOfOrigin: inc2.address,
        witnessStatement: `Nearby resident observed the fire starting at approximately ${inc2.timeOfIncident}.`,
        preliminaryCause: inc2.causeOfFire,
        investigationStatus: 'Spot investigation complete; forwarded to Fire Marshal',
      },
    }),
    // R4 — Final investigation approved by Provincial Chief IIS
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 4),
      reportType: 'FINAL_INVESTIGATION',
      status: 'APPROVED',
      linkedIncident: inc1,
      reportDate: reportDates.r4.report,
      submittedAt: reportDates.r4.sub,
      reviewedAt: reportDates.r4.rev,
      submittedBy: submitter,
      reviewedBy: provincial,
      remarks: 'Approved for filing. No additional action required.',
      respondingOfficer: officers.primary,
      reportingOfficerRank: officers.primaryRank,
      content: {
        incidentReference: inc1.referenceNumber,
        finalCause: inc1.causeOfFire,
        damageAssessment: `PHP ${inc1.estimatedDamage.toLocaleString()}`,
        casualties: inc1.casualtiesInjured > 0 ? `${inc1.casualtiesInjured} injured` : 'None',
        disposition: 'Final investigation complete and approved by Provincial Chief IIS',
      },
    }),
    // R5 — Spot returned for revision by Chief IIS
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 5),
      reportType: 'SPOT_INVESTIGATION',
      status: 'RETURNED',
      linkedIncident: inc2,
      reportDate: reportDates.r5.report,
      submittedAt: reportDates.r5.sub,
      reviewedAt: reportDates.r5.rev,
      submittedBy: submitter,
      passedToRole: ROLES.INVESTIGATOR,
      passedTo: submitter,
      reviewedBy: chiefIis,
      remarks: 'Please include additional scene photographs and clarify the estimated affected area before resubmission.',
      respondingOfficer: officers.secondary,
      reportingOfficerRank: officers.secondaryRank,
      content: {
        incidentReference: inc2.referenceNumber,
        correctionNeeded: 'Additional scene photographs and clearer area estimate required.',
        currentStatus: 'Returned to investigator for revision',
      },
    }),
    // R6 — Progress approved by Marshal, ready for investigator to forward to Provincial Chief IIS
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 6),
      reportType: 'PROGRESS_INVESTIGATION',
      status: 'APPROVED',
      linkedIncident: inc2,
      reportDate: reportDates.r6.report,
      submittedAt: reportDates.r6.sub,
      reviewedAt: reportDates.r6.rev,
      submittedBy: submitter,
      passedToRole: ROLES.INVESTIGATOR,
      passedTo: submitter,
      reviewedBy: marshal,
      remarks: 'Approved — ready to pass to the Provincial Chief IIS.',
      respondingOfficer: officers.secondary,
      reportingOfficerRank: officers.secondaryRank,
      content: {
        incidentReference: inc2.referenceNumber,
        containmentSummary: 'Area perimeter checked with no rekindling observed after mop-up.',
        evidenceCollected: 'Scene photographs, witness statements, and burned-area sketch',
        nextAction: 'Provincial validation of investigation findings',
      },
    }),
    // R7 — 2nd MDFIR submitted to Chief IIS
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 7),
      reportType: 'MDFIR',
      status: 'SUBMITTED',
      linkedIncident: inc2,
      reportDate: reportDates.r6.report,
      submittedAt: reportDates.r6.sub,
      submittedBy: submitter,
      passedToRole: ROLES.MUNICIPAL_CHIEF_IIS,
      passedTo: chiefIis,
      respondingOfficer: officers.secondary,
      reportingOfficerRank: officers.secondaryRank,
      content: {
        incidentReference: inc2.referenceNumber,
        location: `${inc2.barangay}, ${name}`,
        occupancyType: inc2.subCategory,
        estimatedDamage: `PHP ${inc2.estimatedDamage.toLocaleString()}`,
        actionTaken: 'Initial scene assessment and damage documentation completed',
        recommendation: 'Pending review by Municipal Chief IIS',
      },
    }),
    // R8 — Spot investigation approved by Chief IIS, ready for investigator to forward to Marshal
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 8),
      reportType: 'SPOT_INVESTIGATION',
      status: 'APPROVED',
      linkedIncident: inc1,
      reportDate: reportDates.r1.report,
      submittedAt: reportDates.r1.sub,
      submittedBy: submitter,
      passedToRole: ROLES.INVESTIGATOR,
      passedTo: submitter,
      reviewedBy: chiefIis,
      reviewedAt: reportDates.r3.rev,
      remarks: 'Approved — ready to pass to the Municipal Fire Marshal.',
      respondingOfficer: officers.primary,
      reportingOfficerRank: officers.primaryRank,
      content: {
        incidentReference: inc1.referenceNumber,
        pointOfOrigin: inc1.address,
        witnessStatement: `Occupant reported noticing smoke at ${inc1.timeOfIncident}.`,
        preliminaryCause: inc1.causeOfFire,
        investigationStatus: 'Spot investigation forwarded to Fire Marshal',
      },
    }),
    // R9 — 2nd Progress submitted to Chief Operation
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 9),
      reportType: 'PROGRESS_INVESTIGATION',
      status: 'SUBMITTED',
      linkedIncident: inc2,
      reportDate: reportDates.r3.report,
      submittedAt: reportDates.r3.sub,
      submittedBy: submitter,
      passedToRole: ROLES.MUNICIPAL_CHIEF_OPERATION,
      passedTo: chiefOp,
      respondingUnits: `${officers.engine}`,
      respondingOfficer: officers.secondary,
      reportingOfficerRank: officers.secondaryRank,
      content: {
        incidentReference: inc2.referenceNumber,
        operationalConcern: 'Limited road width reduced maneuverability during initial attack.',
        resourcesUsed: 'One engine and water relay team',
        coordinationNeeded: 'Barangay coordination for water supply access',
        currentStatus: 'Submitted to Municipal Chief Operation for review',
      },
    }),
    // R10 — MDFIR returned by Chief IIS
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 10),
      reportType: 'MDFIR',
      status: 'RETURNED',
      linkedIncident: inc1,
      reportDate: reportDates.r2.report,
      submittedAt: reportDates.r2.sub,
      submittedBy: submitter,
      passedToRole: ROLES.INVESTIGATOR,
      passedTo: submitter,
      reviewedBy: chiefIis,
      reviewedAt: reportDates.r3.rev,
      remarks: 'Clarify the estimated damage amount and include receipt or assessment document.',
      respondingOfficer: officers.primary,
      reportingOfficerRank: officers.primaryRank,
      content: {
        incidentReference: inc1.referenceNumber,
        correctionNeeded: 'Damage estimate needs supporting documentation.',
        currentStatus: 'Returned to investigator for revision',
      },
    }),
    // R11 — Spot investigation submitted, awaiting Municipal Fire Marshal review
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 11),
      reportType: 'SPOT_INVESTIGATION',
      status: 'SUBMITTED',
      linkedIncident: inc1,
      reportDate: addHours(reportDates.r1.report, 26),
      submittedAt: addHours(reportDates.r1.sub, 26),
      submittedBy: submitter,
      passedToRole: ROLES.MUNICIPAL_FIRE_MARSHAL,
      passedTo: marshal,
      respondingOfficer: officers.primary,
      reportingOfficerRank: officers.primaryRank,
      content: {
        incidentReference: inc1.referenceNumber,
        pointOfOrigin: inc1.address,
        witnessStatement: `Occupant reported noticing smoke at ${inc1.timeOfIncident}.`,
        preliminaryCause: inc1.causeOfFire,
        investigationStatus: 'Spot investigation complete; awaiting Fire Marshal review',
      },
    }),
    // R12 — Progress investigation submitted, awaiting Municipal Fire Marshal review
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 12),
      reportType: 'PROGRESS_INVESTIGATION',
      status: 'SUBMITTED',
      linkedIncident: inc2,
      reportDate: addHours(reportDates.r2.report, 30),
      submittedAt: addHours(reportDates.r2.sub, 30),
      submittedBy: submitter,
      passedToRole: ROLES.MUNICIPAL_FIRE_MARSHAL,
      passedTo: marshal,
      respondingUnits: `${officers.engine}`,
      respondingOfficer: officers.secondary,
      reportingOfficerRank: officers.secondaryRank,
      content: {
        incidentReference: inc2.referenceNumber,
        operationalConcern: 'Follow-up mop-up required to confirm no rekindling.',
        resourcesUsed: 'One engine company and barangay responders',
        coordinationNeeded: 'Fire Marshal sign-off on containment status',
        currentStatus: 'Submitted to Municipal Fire Marshal for review',
      },
    }),
    // R13 — MDFIR submitted, awaiting Municipal Fire Marshal review
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 13),
      reportType: 'MDFIR',
      status: 'SUBMITTED',
      linkedIncident: inc1,
      reportDate: addHours(reportDates.r1.report, 34),
      submittedAt: addHours(reportDates.r1.sub, 34),
      submittedBy: submitter,
      passedToRole: ROLES.MUNICIPAL_FIRE_MARSHAL,
      passedTo: marshal,
      respondingOfficer: officers.primary,
      reportingOfficerRank: officers.primaryRank,
      content: {
        incidentReference: inc1.referenceNumber,
        location: `${inc1.barangay}, ${name}`,
        occupancyType: inc1.subCategory,
        estimatedDamage: `PHP ${inc1.estimatedDamage.toLocaleString()}`,
        actionTaken: 'Scene documented, witnesses interviewed, and photographs taken',
        recommendation: 'For Municipal Fire Marshal review',
      },
    }),
    // R14 — Spot investigation approved by Fire Marshal, ready for investigator to forward to Provincial Chief IIS
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 14),
      reportType: 'SPOT_INVESTIGATION',
      status: 'APPROVED',
      linkedIncident: inc2,
      reportDate: addHours(reportDates.r3.report, 4),
      submittedAt: addHours(reportDates.r3.sub, 4),
      reviewedAt: addHours(reportDates.r3.rev, 4),
      submittedBy: submitter,
      passedToRole: ROLES.INVESTIGATOR,
      passedTo: submitter,
      reviewedBy: marshal,
      remarks: 'Approved — ready to pass to the Provincial Chief IIS.',
      respondingOfficer: officers.secondary,
      reportingOfficerRank: officers.secondaryRank,
      content: {
        incidentReference: inc2.referenceNumber,
        pointOfOrigin: inc2.address,
        witnessStatement: `Nearby resident observed the fire starting at approximately ${inc2.timeOfIncident}.`,
        preliminaryCause: inc2.causeOfFire,
        investigationStatus: 'Spot investigation complete; forwarded to Provincial Chief IIS',
      },
    }),
    // R15 — MDFIR returned by Fire Marshal
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 15),
      reportType: 'MDFIR',
      status: 'RETURNED',
      linkedIncident: inc2,
      reportDate: addHours(reportDates.r2.report, 8),
      submittedAt: addHours(reportDates.r2.sub, 8),
      reviewedAt: addHours(reportDates.r2.sub, 20),
      submittedBy: submitter,
      passedToRole: ROLES.INVESTIGATOR,
      passedTo: submitter,
      reviewedBy: marshal,
      remarks: 'Please reconcile the estimated damage figure with the attached assessment before resubmission.',
      respondingOfficer: officers.secondary,
      reportingOfficerRank: officers.secondaryRank,
      content: {
        incidentReference: inc2.referenceNumber,
        location: `${inc2.barangay}, ${name}`,
        occupancyType: inc2.subCategory,
        estimatedDamage: `PHP ${inc2.estimatedDamage.toLocaleString()}`,
        actionTaken: 'Scene documented and preliminary damage estimate submitted',
        recommendation: 'Returned to investigator for revision',
      },
    }),
    // R16 — Final investigation submitted, awaiting Provincial Chief IIS review
    buildReport({
      ...baseArgs,
      id: -(idx * 1000 + 16),
      reportType: 'FINAL_INVESTIGATION',
      status: 'SUBMITTED',
      linkedIncident: inc2,
      reportDate: addHours(reportDates.r4.report, 40),
      submittedAt: addHours(reportDates.r4.sub, 40),
      submittedBy: submitter,
      passedToRole: ROLES.PROVINCIAL_CHIEF_IIS,
      passedTo: provincial,
      respondingOfficer: officers.secondary,
      reportingOfficerRank: officers.secondaryRank,
      content: {
        incidentReference: inc2.referenceNumber,
        finalCause: inc2.causeOfFire,
        damageAssessment: `PHP ${inc2.estimatedDamage.toLocaleString()}`,
        casualties: inc2.casualtiesInjured > 0 ? `${inc2.casualtiesInjured} injured` : 'None',
        disposition: 'Final investigation complete; pending review by Provincial Chief IIS',
      },
    }),
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const isDemoReportId = (id) => Number(id) < 0;

const PROVINCIAL_ROLES = [
  ROLES.PROVINCIAL_CHIEF_IIS,
  ROLES.MARSHAL,
  ROLES.CHIEF_INVESTIGATOR_IIS,
];

export function getDemoReportsForUser(user) {
  if (!user) return [];

  const munCode = getMunCodeFromUser(user);
  const isProvincial = PROVINCIAL_ROLES.includes(user.role);

  if (!munCode && !isProvincial) return [];

  let allReports = [];

  if (munCode) {
    const cfg = MUN_MAP[munCode];
    if (cfg) allReports = generateDemoReportsForMunicipality(cfg, user);
  } else {
    // Provincial users see reports from all municipalities
    allReports = MUNICIPALITY_CONFIGS.flatMap((cfg) =>
      generateDemoReportsForMunicipality(cfg, user)
    );
  }

  if (user.role === ROLES.INVESTIGATOR) {
    return allReports.filter((r) => r.submittedBy.email === user.email);
  }

  if (user.role === ROLES.MUNICIPAL_CHIEF_IIS) {
    return allReports.filter(
      (r) =>
        r.passedToRole === ROLES.MUNICIPAL_CHIEF_IIS ||
        r.reviewedBy?.role === ROLES.MUNICIPAL_CHIEF_IIS
    );
  }

  if (user.role === ROLES.MUNICIPAL_CHIEF_OPERATION) {
    return allReports.filter((r) => r.passedToRole === ROLES.MUNICIPAL_CHIEF_OPERATION);
  }

  if (user.role === ROLES.MUNICIPAL_FIRE_MARSHAL) {
    return allReports.filter(
      (r) =>
        r.passedToRole === ROLES.MUNICIPAL_FIRE_MARSHAL ||
        r.reviewedBy?.role === ROLES.MUNICIPAL_FIRE_MARSHAL
    );
  }

  if (isProvincial) {
    return allReports.filter(
      (r) =>
        r.passedToRole === ROLES.PROVINCIAL_CHIEF_IIS ||
        r.reviewedBy?.role === ROLES.PROVINCIAL_CHIEF_IIS ||
        PROVINCIAL_ROLES.includes(r.passedToRole) ||
        PROVINCIAL_ROLES.includes(r.reviewedBy?.role)
    );
  }

  return [];
}

export function filterDemoReports(reports, { reportType, status, view } = {}) {
  return reports.filter((r) => {
    if (reportType && r.reportType !== reportType) return false;
    if (status && r.status !== status) return false;
    if (view === 'outgoing') return Boolean(r.reviewedById);
    if (view === 'incoming') return r.status === 'SUBMITTED' && Boolean(r.passedToId);
    return true;
  });
}

export function getDemoReportById(user, id) {
  return getDemoReportsForUser(user).find((r) => r.id === Number(id)) || null;
}
