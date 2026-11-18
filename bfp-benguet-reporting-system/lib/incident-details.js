// Extra incident information an investigator records on the Spot report (kept in the report's
// content JSON) and the cause of fire set by the Final report (Incident.causeOfFire). Shown in
// the report details and used by the dashboard's statistics.

export const PROPERTY_TYPES = [
  'Single-family house',
  'Apartment / Boarding house',
  'Commercial establishment',
  'Industrial facility',
  'Government building',
  'School',
  'Health facility',
  'Place of worship',
  'Vehicle',
  'Grassland / Forest',
  'Vacant lot',
  'Other',
];

export const CAUSES_OF_FIRE = [
  'Faulty electrical wiring',
  'Overloaded electrical connection',
  'Unattended cooking',
  'LPG leak',
  'Open flame (candle, kerosene lamp)',
  'Lighted cigarette',
  'Rubbish / kaingin burning',
  'Children playing with fire',
  'Vehicle malfunction',
  'Spontaneous combustion',
  'Lightning',
  'Arson (intentional)',
  'Undetermined',
];

// The labelled details of a Spot report's content, for display (only the ones filled in).
export function getIncidentDetailRows(content = {}) {
  const rows = [
    ['Property type', content.propertyType],
    ['Establishment / property', content.establishmentName],
    ['Owner', content.ownerName],
    ['Occupant', content.occupantName],
    ['Number of storeys', content.numberOfStoreys ?? null],
    ['Rescue operations', Number(content.rescueOperations) > 0 ? content.rescueOperations : null],
  ];
  return rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
}
