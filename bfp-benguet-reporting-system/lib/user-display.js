// How the signed-in user is shown in the header, profile panel and sidebar.

const ROLE_TITLES = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  INVESTIGATOR: 'Investigator',
  MUNICIPAL_CHIEF_IIS: 'Municipal Chief IIS',
  MUNICIPAL_CHIEF_OPERATION: 'Municipal Chief Operation',
  MUNICIPAL_FIRE_MARSHAL: 'Municipal Fire Marshal',
  PROVINCIAL_CHIEF_IIS: 'Provincial Chief IIS',
  CHIEF_INVESTIGATOR_IIS: 'Chief Investigator IIS',
  PROVINCIAL_CHIEF_INVESTIGATOR: 'Provincial Chief Investigator',
  MARSHAL: 'Marshal',
  REGION_IIS: 'Regional IIS',
  REGIONAL_CHIEF_OPERATION: 'Regional Chief Operation',
  PIO: 'Public Information Officer',
  VIEWER: 'Viewer',
};

// Roles that belong to one municipality — only these show it after the title.
const MUNICIPAL_ROLES = ['INVESTIGATOR', 'MUNICIPAL_CHIEF_IIS', 'MUNICIPAL_CHIEF_OPERATION', 'MUNICIPAL_FIRE_MARSHAL'];

// The name from their Google account once they've used "Continue with Google" (see
// prisma/schema.prisma's googleName), otherwise the name the admin gave the account.
export const displayName = (user) => user?.googleName || user?.name || '';

// "SUPER_ADMIN" -> "Super Admin"; municipal roles add their municipality ("Municipal Fire
// Marshal · La Trinidad"). Unknown roles fall back to a title-cased version of the code.
export function roleTitle(user) {
  if (!user?.role) return '';
  const title = ROLE_TITLES[user.role]
    || user.role.split('_').map((w) => (w === 'IIS' ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
  const municipality = MUNICIPAL_ROLES.includes(user.role) && user.municipality?.name;
  return municipality ? `${title} · ${municipality}` : title;
}
