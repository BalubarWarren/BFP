// Barangays of each Benguet municipality, keyed by municipality name (as in MUNICIPALITIES in
// lib/constants.js and the `municipalities` table). Used by the Spot report's Barangay dropdown
// and the Casualty Monitoring Board's per-barangay breakdown.
export const BARANGAYS = {
  Atok: ['Abiang', 'Caliking', 'Cattubo', 'Naguey', 'Paoay', 'Pasdong', 'Poblacion', 'Topdac'],
  Bakun: ['Ampusongan', 'Bagu', 'Dalipey', 'Gambang', 'Kayapa', 'Poblacion (Central)', 'Sinacbat'],
  Bokod: ['Ambuclao', 'Bila', 'Bobok-Bisal', 'Daclan', 'Ekip', 'Karao', 'Nawal', 'Pito', 'Poblacion', 'Tikey'],
  Buguias: [
    'Abatan', 'Amgaleyguey', 'Amlimay', 'Baculongan Norte', 'Baculongan Sur', 'Bangao', 'Buyacaoan',
    'Calamagan', 'Catlubong', 'Lengaoan', 'Loo', 'Natubleng', 'Poblacion (Central)', 'Sebang',
  ],
  Itogon: ['Ampucao', 'Dalupirip', 'Gumatdang', 'Loacan', 'Poblacion (Central)', 'Tinongdan', 'Tuding', 'Ucab', 'Virac'],
  Kabayan: [
    'Adaoay', 'Anchukey', 'Ballay', 'Bashoy', 'Batan', 'Duacan', 'Eddet', 'Gusaran', 'Kabayan Barrio',
    'Lusod', 'Pacso', 'Poblacion (Central)', 'Tawangan',
  ],
  Kapangan: [
    'Balakbak', 'Beleng-Belis', 'Boklaoan', 'Cayapes', 'Cuba', 'Datakan', 'Gadang', 'Gasweling', 'Labueg',
    'Paykek', 'Poblacion Central', 'Pongayan', 'Pudong', 'Sagubo', 'Taba-ao',
  ],
  Kibungan: ['Badeo', 'Lubo', 'Madaymen', 'Palina', 'Poblacion', 'Sagpat', 'Tacadang'],
  'La Trinidad': [
    'Alapang', 'Alno', 'Ambiong', 'Bahong', 'Balili', 'Beckel', 'Betag', 'Bineng', 'Cruz', 'Lubas', 'Pico',
    'Poblacion', 'Puguis', 'Shilan', 'Tawang', 'Wangal',
  ],
  Mankayan: [
    'Balili', 'Bedbed', 'Bulalacao', 'Cabiten', 'Colalo', 'Guinaoang', 'Paco', 'Palasaan', 'Poblacion',
    'Sapid', 'Tabio', 'Taneg',
  ],
  Sablan: ['Bagong', 'Balluay', 'Banangan', 'Banengbeng', 'Bayabas', 'Kamog', 'Pappa', 'Poblacion'],
  Tuba: [
    'Ansagan', 'Camp 3', 'Camp 4', 'Camp One', 'Nangalisan', 'Poblacion', 'San Pascual', 'Tabaan Norte',
    'Tabaan Sur', 'Tadiangan', 'Taloy Norte', 'Taloy Sur', 'Twin Peaks',
  ],
  Tublay: ['Ambassador', 'Ambongdolan', 'Ba-ayan', 'Basil', 'Caponga (Poblacion)', 'Daclan', 'Tublay Central', 'Tuel'],
};

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const withoutParens = (value) => String(value || '').replace(/\([^)]*\)/g, '');
const stripPrefix = (value) => String(value || '').replace(/^\s*(brgy\.?|barangay)\s+/i, '');

export function getBarangays(municipalityName) {
  if (!municipalityName) return [];
  const key = Object.keys(BARANGAYS).find((name) => normalize(name) === normalize(municipalityName));
  return key ? BARANGAYS[key] : [];
}

// The listed barangay a stored value refers to ("Brgy. Poblacion", "poblacion central" ->
// "Poblacion (Central)"), or null when it isn't one of the municipality's barangays.
export function matchBarangay(municipalityName, value) {
  const raw = stripPrefix(value);
  if (!raw.trim()) return null;
  const target = normalize(raw);
  const targetBare = normalize(withoutParens(raw));
  return (
    getBarangays(municipalityName).find((name) => {
      const full = normalize(name);
      const bare = normalize(withoutParens(name));
      return full === target || bare === target || full === targetBare || bare === targetBare;
    }) || null
  );
}
