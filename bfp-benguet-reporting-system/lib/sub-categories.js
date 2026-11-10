// Sub-category helpers shared by the dashboard endpoints (monitoring board and analytics).

export const CATEGORY_FIELDS = ['residential', 'nonResidential', 'nonStructural', 'transport'];

export const emptySubCategories = () => ({ residential: {}, nonResidential: {}, nonStructural: {}, transport: {} });

// Spot Investigation reports carry their sub-category on the linked Incident; MDFIR reports don't
// create an Incident at all, so theirs only lives inside the stored content JSON.
export const getReportSubCategory = (report) => {
  if (report.incident?.subCategory) return report.incident.subCategory;
  try {
    return JSON.parse(report.content || '{}').subCategory || null;
  } catch {
    return null;
  }
};

// A daily report entry's optional sub-category breakdown (the subCategories JSON column), as
// { field: { subCategory: count } } with only known fields and positive whole counts kept.
export const getEntrySubCategories = (entry) => {
  if (!entry.subCategories) return null;
  let parsed;
  try {
    parsed = JSON.parse(entry.subCategories);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const result = {};
  CATEGORY_FIELDS.forEach((field) => {
    Object.entries(parsed[field] || {}).forEach(([sub, count]) => {
      const n = Number(count);
      if (!Number.isInteger(n) || n <= 0) return;
      (result[field] ||= {})[sub] = n;
    });
  });
  return result;
};

// Adds `count` of `sub` under `field` into a { field: { sub: n } } accumulator.
export const addSubCategory = (target, field, sub, count = 1) => {
  if (!target[field]) target[field] = {};
  target[field][sub] = (target[field][sub] || 0) + count;
};
