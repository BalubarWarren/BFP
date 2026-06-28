// Fire categories and sub-categories
export const GENERAL_CATEGORIES = {
  RESIDENTIAL: 'RESIDENTIAL',
  NON_RESIDENTIAL: 'NON_RESIDENTIAL',
  NON_STRUCTURAL: 'NON_STRUCTURAL',
  TRANSPORT: 'TRANSPORT',
};

export const SUB_CATEGORIES = {
  RESIDENTIAL: [
    'Apartment, Condominium, Dormitory, Hotel, Motel',
    'Lodging and Rooming Houses',
    'Single and Two-Family Dwelling',
  ],
  NON_RESIDENTIAL: [
    'Place of Assembly',
    'Business',
    'Detention and Correctional',
    'Educational',
    'Health Care',
    'Industrial',
    'Mercantile',
    'Storage',
    'Mixed Occupancies',
    'Special Structure',
  ],
  NON_STRUCTURAL: [
    'Agricultural Land',
    'Electrical Post Fire',
    'Forest Fire',
    'Grass Fire',
    'Rubbish Fire',
  ],
  TRANSPORT: [
    'Automobile',
    'Bus',
    'Jeepney',
    'Motorcycle',
    'Tricycle',
    'Truck',
    'Heavy Equipment',
    'Ship',
    'Aircraft',
    'Locomotive',
  ],
};

export const REPORT_TYPES = {
  DAILY: 'DAILY',
  MDFIR: 'MDFIR',
  SPOT_INVESTIGATION: 'SPOT_INVESTIGATION',
  PROGRESS_INVESTIGATION: 'PROGRESS_INVESTIGATION',
  FINAL_INVESTIGATION: 'FINAL_INVESTIGATION',
};

export const REPORT_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  RETURNED: 'RETURNED',
};

export const INCIDENT_STATUS = {
  ONGOING: 'ONGOING',
  CONTROLLED: 'CONTROLLED',
  EXTINGUISHED: 'EXTINGUISHED',
};

export const ROLES = {
  MARSHAL: 'MARSHAL',
  MUNICIPAL_FIRE_MARSHAL: 'MUNICIPAL_FIRE_MARSHAL',
  INVESTIGATOR: 'INVESTIGATOR',
  MUNICIPAL_CHIEF_IIS: 'MUNICIPAL_CHIEF_IIS',
  MUNICIPAL_CHIEF_OPERATION: 'MUNICIPAL_CHIEF_OPERATION',
  CHIEF_INVESTIGATOR_IIS: 'CHIEF_INVESTIGATOR_IIS',
  PROVINCIAL_CHIEF_IIS: 'PROVINCIAL_CHIEF_IIS',
  CHIEF_SPECIAL_OPERATION_SECTION: 'CHIEF_SPECIAL_OPERATION_SECTION',
  PROVINCIAL_CHIEF_INVESTIGATOR: 'PROVINCIAL_CHIEF_INVESTIGATOR',
  REGION_IIS: 'REGION_IIS',
  REGIONAL_CHIEF_OPERATION: 'REGIONAL_CHIEF_OPERATION',
  SUPER_ADMIN: 'SUPER_ADMIN',
  PIO: 'PIO',
  VIEWER: 'VIEWER',
};

// Role-based permissions and functions
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: {
    description: 'System administrator with full access',
    level: 120,
    permissions: [
      'CREATE_REPORT',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'VIEW_ALL_REPORTS',
      'MANAGE_USERS',
      'MANAGE_MUNICIPALITIES',
      'VIEW_STATISTICS',
      'EXPORT_DATA',
      'MANAGE_INCIDENTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  MARSHAL: {
    description: 'Legacy Provincial role (kept for compatibility)',
    level: 55,
    permissions: [
      'CREATE_REPORT',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'VIEW_ALL_REPORTS',
      'VIEW_STATISTICS',
      'EXPORT_DATA',
      'MANAGE_INCIDENTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  MUNICIPAL_FIRE_MARSHAL: {
    description: 'Municipal Fire Marshal - final municipal reviewer before provincial routing',
    level: 40,
    permissions: [
      'CREATE_REPORT',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'VIEW_MUNICIPALITY_REPORTS',
      'VIEW_STATISTICS',
      'MANAGE_INCIDENTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  MUNICIPAL_CHIEF_IIS: {
    description: 'Municipal Chief IIS - reviews investigator submissions and requests corrections',
    level: 30,
    permissions: [
      'CREATE_REPORT',
      'VIEW_MUNICIPALITY_REPORTS',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'ADD_COMMENTS',
      'REQUEST_REVISIONS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  MUNICIPAL_CHIEF_OPERATION: {
    description: 'Municipal Chief Operation - receives municipal investigation reports',
    level: 35,
    permissions: [
      'VIEW_MUNICIPALITY_REPORTS',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'ADD_COMMENTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  PROVINCIAL_CHIEF_IIS: {
    description: 'Provincial Chief IIS - provincial reviewer for municipal endorsed reports',
    level: 100,
    permissions: [
      'CREATE_REPORT',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'VIEW_ALL_REPORTS',
      'MANAGE_USERS',
      'MANAGE_MUNICIPALITIES',
      'VIEW_STATISTICS',
      'EXPORT_DATA',
      'MANAGE_INCIDENTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  INVESTIGATOR: {
    description: 'Creates fire investigation reports',
    level: 10,
    permissions: [
      'CREATE_REPORT',
      'VIEW_OWN_REPORTS',
      'VIEW_MUNICIPALITY_REPORTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  CHIEF_INVESTIGATOR_IIS: {
    description: 'Legacy/alternate IIS role for compatibility',
    level: 30,
    permissions: [
      'CREATE_REPORT',
      'VIEW_ALL_REPORTS',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'ADD_COMMENTS',
      'REQUEST_REVISIONS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  CHIEF_SPECIAL_OPERATION_SECTION: {
    description: 'Checks and validates reports for operational compliance',
    level: 35,
    permissions: [
      'VIEW_ALL_REPORTS',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'ADD_COMMENTS',
      'REQUEST_REVISIONS',
      'VIEW_STATISTICS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  PROVINCIAL_CHIEF_INVESTIGATOR: {
    description: 'Reviews investigation reports at the provincial level',
    level: 50,
    permissions: [
      'CREATE_REPORT',
      'VIEW_ALL_REPORTS',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'ADD_COMMENTS',
      'VIEW_STATISTICS',
      'GENERATE_REPORTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  REGION_IIS: {
    description: 'Reviews reports at the regional level',
    level: 55,
    permissions: [
      'VIEW_ALL_REPORTS',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'ADD_COMMENTS',
      'VIEW_STATISTICS',
      'GENERATE_REPORTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  REGIONAL_CHIEF_OPERATION: {
    description: 'Reviews and monitors operational reports regionally',
    level: 60,
    permissions: [
      'CREATE_REPORT',
      'VIEW_ALL_REPORTS',
      'REVIEW_REPORT',
      'APPROVE_REPORT',
      'REJECT_REPORT',
      'ADD_COMMENTS',
      'MONITOR_INCIDENTS',
      'VIEW_STATISTICS',
      'GENERATE_REPORTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  PIO: {
    description: 'Public Information Officer - accesses approved reports and statistics for dissemination',
    level: 25,
    permissions: [
      'VIEW_APPROVED_REPORTS',
      'VIEW_STATISTICS',
      'EXPORT_DATA',
      'GENERATE_PUBLIC_REPORTS',
      'RECEIVE_NOTIFICATIONS',
    ],
  },
  VIEWER: {
    description: 'Read-only access',
    level: 5,
    permissions: ['VIEW_APPROVED_REPORTS', 'VIEW_STATISTICS'],
  },
};

// Benguet Municipalities
export const MUNICIPALITIES = [
  { name: 'Atok', code: 'ATOK' },
  { name: 'Bakun', code: 'BAKUN' },
  { name: 'Bokod', code: 'BOKOD' },
  { name: 'Buguias', code: 'BUGUIAS' },
  { name: 'Itogon', code: 'ITOGON' },
  { name: 'Kabayan', code: 'KABAYAN' },
  { name: 'Kapangan', code: 'KAPANGAN' },
  { name: 'Kibungan', code: 'KIBUNGAN' },
  { name: 'La Trinidad', code: 'LT' },
  { name: 'Mankayan', code: 'MANKAYAN' },
  { name: 'Sablan', code: 'SABLAN' },
  { name: 'Tuba', code: 'TUBA' },
  { name: 'Tublay', code: 'TUBLAY' },
];

export const NOTIFICATION_TYPES = {
  REPORT_SUBMITTED: 'REPORT_SUBMITTED',
  REPORT_APPROVED: 'REPORT_APPROVED',
  REPORT_RETURNED: 'REPORT_RETURNED',
  REPORT_OVERDUE: 'REPORT_OVERDUE',
};
