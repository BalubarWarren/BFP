// Extra incident information an investigator records on the Spot report (kept in the report's
// content JSON) and the cause of fire set by the Final report (Incident.causeOfFire). Shown in
// the report details and used by the dashboard's statistics.

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
// Property/owner details are confidential and are never recorded or shown.
export function getIncidentDetailRows(content = {}) {
  const rows = [
    ['Rescue operations', Number(content.rescueOperations) > 0 ? content.rescueOperations : null],
  ];
  return rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
}
