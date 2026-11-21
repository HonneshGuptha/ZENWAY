# ZENWAY — Campus Mobility & Peer Exchange Platform

ZENWAY is a secure, student-only peer-to-peer mobility exchange platform designed exclusively for verified college and university campus communities. It enables authenticated students to share rides (carpooling), rent campus mobility resources (bicycles, e-scooters, motorcycles, cars), and request parcel transport across campus boundaries with strict identity verification and direct peer-to-peer UPI settlement.

---

## Key Features

- **Multi-Modal Campus Exchange**:
  - **Rent**: Peer-to-peer vehicle lending (bicycles, e-scooters, two-wheelers, cars) with authoritative hourly/daily pricing, security deposits, and GiST-backed concurrent schedule protection.
  - **Ride**: Campus carpool coordination with departure scheduling, real-time seat tracking, and atomic seat acceptance.
  - **Carry**: Student parcel and item transport with photo verification and single-winner assignment state machines.
- **Strict Student Identity Verification**:
  - Multi-stage onboarding requiring valid institutional credentials and student ID document submissions.
  - Private document storage in non-public Supabase storage buckets accessible only to the owner and verified campus administrators.
  - Administrative review queue with 1-click approvals, rejection handling, and reason logging.
- **Financial & Data Integrity**:
  - Server-side authoritative price calculation and validation preventing client-side request tampering.
  - Gated contact disclosure: Phone numbers and UPI handles (`handle@psp`) are revealed strictly to confirmed exchange counterparts.
  - Defense-in-depth: RPC endpoints paired with database trigger constraints.
- **Dedicated Obsidian Operations Command Center**:
  - Isolated administrative portal (`/admin/*`) with server-side 2FA session verification.
  - Live exchange telemetry, dispute arbitration, user directory management, account suspension, and immutable audit logs.
- **Optimized Performance & UX**:
  - Instant session restoration with zero artificial loading delays.
  - Smooth animated mascot transitions, dark/light theme switching, and responsive design.

---

## Technology Stack

- **Frontend Core**: React 19, TypeScript, Vite 8
- **Styling & Design System**: Tailwind CSS 4, `@base-ui/react`, Lucide React, CVA (`class-variance-authority`), `sonner`
- **Motion & Interactions**: Motion (`motion/react`)
- **Backend & Database**: Supabase (PostgreSQL 15+, PostgREST, GoTrue Auth, Realtime, Storage, pg_net, pgcrypto)
- **Settlement Architecture**: Direct peer-to-peer UPI intent links (`upi://pay`) and QR code generation
- **Testing & Quality**: Vitest, ESLint, TypeScript Compiler (`tsc`)

---

## Project Structure

```text
ZENWAY/
├── public/                 # Static brand assets and icons
├── src/
│   ├── assets/             # Brand illustrations and vector assets
│   ├── components/         # Reusable modular UI components
│   │   ├── admin/          # Admin operations shell and consoles
│   │   ├── auth/           # Route guards and authentication components
│   │   ├── brand/          # ZENWAY brand logos and badges
│   │   ├── exchange/       # Modals for cancellations, disputes, and reviews
│   │   ├── home/           # Landing page and student dashboard
│   │   ├── layout/         # Navigation docks, header, and shell
│   │   ├── location/       # Campus interactive map and location pickers
│   │   ├── notifications/  # Realtime notification center
│   │   ├── profile/        # Student public and private profile modals
│   │   └── ui/             # Design system primitives (buttons, inputs, dialogs)
│   ├── context/            # Global React contexts (AuthContext, RouterContext)
│   ├── hooks/              # Custom React hooks (useScrollLock, etc.)
│   ├── lib/                # Client utilities, motion presets, and Supabase client
│   ├── pages/              # Routed application views
│   │   ├── activity/       # Booking history and activity log
│   │   ├── admin/          # Admin portal pages (Dashboard, Users, Moderation, etc.)
│   │   ├── auth/           # Login, registration, password recovery, callback
│   │   ├── exchange/       # Rent, Ride, and Carry exchange modules
│   │   ├── legal/          # Campus terms and privacy policies
│   │   ├── onboarding/     # Student ID verification submission and status
│   │   └── support/        # Help center and contact forms
│   ├── test/               # Automated test suites for pricing, auth, and security
│   ├── types/              # Database schema definitions and TypeScript interfaces
│   ├── App.tsx             # Root application router and auth hydration
│   └── main.tsx            # Application entry point
├── supabase/
│   ├── functions/          # Deno-based Supabase Edge Functions (notify-exchange)
│   └── migrations/         # Forward-only SQL migrations (23 sequential migrations)
├── package.json            # Node dependencies and project scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build pipeline configuration
└── validate_migrations.mjs # Static SQL syntax and dollar-quote migration validator
```

---

## Local Setup Instructions

### Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- A Supabase project (local CLI or hosted on supabase.com)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ZENWAY
   ```

2. **Install project dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase connection parameters:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
   > **Note**: Never commit `.env.local` or expose service role keys to client environment variables.

4. **Run the local development server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

---

## Supabase Database Setup & Migrations

All database structures, Row Level Security policies, storage buckets, triggers, and RPC procedures are maintained as sequential SQL migrations in `supabase/migrations/`.

### Applying Migrations

You can apply the migrations using either the Supabase CLI or the Supabase Web Dashboard:

#### Method A: Supabase CLI (Recommended)
```bash
# Link your remote Supabase project
npx supabase link --project-ref <your-project-ref>

# Push all sequential migrations to the database
npx supabase db push
```

#### Method B: Supabase Dashboard SQL Editor
Apply the migration files in numerical order:
1. `20261110000001_core_extensions_and_enums.sql` through `20261110000015_transaction_trust_and_disputes.sql`
2. `20261117211116_add_notification_webhooks.sql` through `20261121000004_inapp_notifications_and_realtime.sql`
3. `20261121000005_security_and_financial_integrity_remediation.sql`

To validate SQL syntax across all migration files locally:
```bash
node validate_migrations.mjs
```

---

## Administrator Provisioning & Access Key Management

The administrator portal (`/admin`) is protected by dual-layer authorization:
1. Supabase Auth credentials for an account assigned `role = 'admin'` in `public.profiles`.
2. Server-side verified 2FA access key verified via cryptographically salted hash comparison.

### Provisioning the Initial Administrator
Run the following SQL procedure in the **Supabase Dashboard SQL Editor** (executed under `service_role` privileges):

```sql
-- 1. Create a user via Supabase Auth or use an existing registered user's email
-- 2. Execute the trusted provisioning function with a strong access key (minimum 8 characters):
SELECT public.provision_initial_admin(
    'admin@campus.edu',
    'YourStrongInitialAccessKey2026!'
);
```

### Rotating the Administrator Access Key
1. **Via Admin Portal**:
   - Log into `/admin/dashboard` as an authenticated administrator.
   - Navigate to the **Admin Security Key** panel.
   - Enter your current key and specify a new key with at least 8 characters.
2. **Via SQL Console (Emergency Override)**:
   ```sql
   SELECT public.provision_admin_access_key('NewStrongEmergencyKey2026!');
   ```

---

## Automated Testing & Quality Checks

Run the automated test suites, type checking, and production build:

```bash
# Run automated Vitest test suites (29 unit tests covering price integrity, auth, and security)
npm run test

# Run TypeScript type check
npx tsc -b

# Run ESLint validation
npm run lint

# Build production bundle
npm run build
```

---

## Deployment Instructions

### Frontend (Vercel / Netlify / Cloudflare Pages)

1. Connect your repository to your preferred hosting platform.
2. Configure build settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Production Environment Variables in the hosting dashboard:
   - `VITE_SUPABASE_URL` = `https://<your-project-id>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `<your-production-anon-key>`
4. Configure Single Page Application (SPA) routing redirects:
   Ensure all requests rewrite to `/index.html` (already configured in `vercel.json`).

### Supabase Storage Buckets
Ensure the following 4 buckets exist and match configuration in migration `20261110000011`:
- `student-ids`: Private, 10MB limit, allowed: JPG, PNG, WEBP, PDF
- `carry-photos`: Private, 10MB limit, allowed: JPG, PNG, WEBP
- `vehicle-images`: Public, 8MB limit, allowed: JPG, PNG, WEBP
- `avatars`: Public, 5MB limit, allowed: JPG, PNG, WEBP

---

## Security Considerations

1. **Zero Client Trust on Financial Calculations**:
   - Rental total prices and deposits are computed server-side via `create_rental_booking` using authoritative rates stored in `vehicles`.
   - Ride seat totals are calculated server-side via `create_ride_booking` using authoritative rates in `rides`.
   - Triggers `protect_rental_request_owner` and `protect_ride_request_submission` enforce price and schedule rules on any direct database write.
2. **Student ID Privacy**:
   - Identity documents stored in `student-ids` bucket cannot be read by public/anonymous callers. Access is strictly locked to the submitting student and verified administrators.
3. **Contact Privacy Gating**:
   - Phone numbers and UPI IDs are never exposed in public profile listings. They are revealed only to confirmed transaction peers once a request reaches `accepted`, `active`, or `completed` standing.
4. **No Secrets in Bundles**:
   - No administrative passwords, fallback keys, or secrets exist in the frontend repository or production bundle.
   - Administrator session validity is tracked through server-side records in `admin_sessions` with automatic 2-hour expiration.
