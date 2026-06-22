# BFP Benguet Fire Incident Reporting System

A comprehensive web-based centralized fire incident reporting system for the **Bureau of Fire Protection (BFP) – Benguet Provincial Office**, Philippines. The system enables the 13 municipal BFP stations of Benguet to digitally submit fire incident reports directly to the Provincial Office.

## 🎯 Features

### MVP (Phase 1)
- ✅ Authentication system with role-based access control (RBAC)
- ✅ Three user roles: SUPER_ADMIN, MUNICIPAL_OFFICER, VIEWER
- ✅ Municipality management (pre-seeded with 13 Benguet municipalities)
- ✅ Daily Report submission form
- ✅ Initial Report (First Report) submission form
- ✅ Provincial Dashboard with Fire Incident Monitoring Board
- ✅ Report approval/rejection workflow
- ✅ In-app notifications system
- ✅ Real-time incident status tracking

### Phase 2 (Upcoming)
- Progress Report and Final Report forms
- Advanced analytics and charts
- PDF export of individual and consolidated reports
- Municipal submission status panel
- Overdue report alerts

### Phase 3 (Advanced)
- Benguet map with incident location pins
- Excel export
- Email notifications
- Comprehensive audit logging
- Print-ready report formatting

## 🏗️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | Next.js 14 (React 18) |
| **Backend** | Next.js API Routes |
| **Database** | PostgreSQL + Prisma ORM |
| **Authentication** | JWT (jsonwebtoken) |
| **Styling** | Tailwind CSS |
| **Forms** | React Hook Form + Zod |
| **Charts** | Recharts (Phase 2) |

## 📋 Supported Municipalities (13 total)

1. Atok
2. Bakun
3. Bokod
4. Buguias
5. Itogon
6. Kabayan
7. Kapangan
8. Kibungan
9. La Trinidad (Provincial Capital)
10. Mankayan
11. Sablan
12. Tuba
13. Tublay

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 12+
- Git

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd bfp-benguet-reporting-system
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and set your PostgreSQL connection string:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/bfp_benguet"
   JWT_SECRET="your-secret-key-change-in-production"
   ```

3. **Set up the database:**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Seed the database with municipalities and test users:**
   ```bash
   npm run db:seed
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## 🔐 Test Credentials

After seeding, use these credentials to test the system:

| Role | Email | Password |
|------|-------|----------|
| **SUPER_ADMIN** | admin@bfp-benguet.gov.ph | admin@123 |
| **Municipal Officer (Atok)** | officer.atok@bfp-benguet.gov.ph | officer@123 |
| **Viewer** | viewer@bfp-benguet.gov.ph | viewer@123 |

## 📂 Project Structure

```
bfp-benguet-reporting-system/
├── app/
│   ├── api/                          # API routes
│   │   ├── auth/                     # Authentication endpoints
│   │   ├── reports/                  # Reports CRUD
│   │   ├── incidents/                # Incidents CRUD
│   │   ├── municipalities/           # Municipality lookup
│   │   ├── dashboard/                # Dashboard analytics
│   │   └── notifications/            # Notifications system
│   ├── (auth)/                       # Auth pages (login, register)
│   └── (dashboard)/                  # Protected dashboard routes
│       ├── provincial/               # SUPER_ADMIN/VIEWER dashboard
│       └── municipal/                # MUNICIPAL_OFFICER dashboard
├── components/                       # React components
│   ├── forms/                        # Report submission forms
│   ├── dashboard/                    # Dashboard components
│   ├── common/                       # Reusable components
│   └── ui/                           # UI components
├── lib/                              # Utilities & helpers
│   ├── auth.js                       # JWT & password utilities
│   ├── prisma.js                     # Prisma client
│   ├── constants.js                  # Fire categories, municipalities
│   ├── incident-reference.js         # Reference number generation
│   └── utils.js                      # Formatting & helpers
├── prisma/
│   └── schema.prisma                 # Database schema
├── styles/
│   └── globals.css                   # Global Tailwind styles
└── public/                           # Static assets

```

## 📊 Database Schema Highlights

### Key Models
- **Users**: Role-based authentication (SUPER_ADMIN, MUNICIPAL_OFFICER, VIEWER)
- **Municipality**: 13 Benguet municipalities
- **Incident**: Fire incident records with auto-generated reference numbers (BFP-BEN-2026-001)
- **Report**: Daily, Initial, Progress, and Final report types
- **Notification**: Real-time user notifications
- **AuditLog**: Activity tracking for compliance

## 🎨 UI/UX Design

- **Color Palette**: BFP Red (#CC0000), Navy (#1A2B4A), Green (#2E7D32), Amber (#F59E0B)
- **Layout**: Responsive sidebar navigation, collapsible on mobile
- **Tables**: Clean, modern data tables with status badges
- **Forms**: Multi-step forms for complex reports
- **Responsive**: Works on desktop, tablet, and mobile

## 🔄 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Create new user (SUPER_ADMIN only)
- `GET /api/auth/me` - Get current user

### Reports
- `GET /api/reports` - List reports (filtered by role)
- `POST /api/reports` - Create new report
- `GET /api/reports/[id]` - Get report details
- `PATCH /api/reports/[id]` - Update report
- `POST /api/reports/[id]/approve` - Approve/reject report (SUPER_ADMIN)

### Incidents
- `GET /api/incidents` - List incidents
- `POST /api/incidents` - Create incident
- `GET /api/incidents/[id]` - Get incident details
- `PATCH /api/incidents/[id]` - Update incident

### Dashboard
- `GET /api/dashboard/monitoring-board` - Fire incident monitoring table
- `GET /api/dashboard/analytics` - KPIs and chart data

### Utilities
- `GET /api/municipalities` - List all municipalities
- `GET /api/notifications` - User notifications
- `PATCH /api/notifications` - Mark notification as read

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for secure password storage
- **Role-Based Access Control (RBAC)**: Server-side enforcement
- **Data Isolation**: Municipal officers can only access their municipality's data
- **Server-side Validation**: All authorization checks on the backend

## 📝 Notes

1. **Reference Number Format**: Auto-generated as `BFP-BEN-[YEAR]-[SEQUENCE]`
2. **Timezone**: All timestamps use Philippine Standard Time (UTC+8)
3. **Validation**: Required field validation on both frontend and backend
4. **Offline PWA**: Consider adding for municipalities with limited connectivity (Phase 2)
5. **Daily Report Duplication**: System prevents duplicate daily reports for same municipality on same date

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running and DATABASE_URL is correct
# Then recreate migrations:
npx prisma migrate reset --force
npm run db:seed
```

### Port 3000 Already in Use
```bash
# Run on a different port:
npm run dev -- -p 3001
```

### Prisma Client Generation Error
```bash
npx prisma generate
npm run dev
```

## 📞 Support

For issues or questions, contact the development team or open an issue in the repository.

## 📜 License

This system is developed for the Bureau of Fire Protection (BFP) – Benguet Provincial Office.

---

**Version**: 0.1.0  
**Last Updated**: June 2026
