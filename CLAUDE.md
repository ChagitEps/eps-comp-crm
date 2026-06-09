# CLAUDE.md — EPS COMP CRM

מסמך זה מספק הנחיות ל-Claude Code בעת עבודה על מאגר זה.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build + TypeScript check
npm run lint     # ESLint (Next.js core-web-vitals + TypeScript)
npm run start    # Serve production build
# No test runner configured
```

---

## Critical: This is Next.js 16, not 14

Key differences from Next.js 14:
- **`proxy.ts`** (not `middleware.ts`) — exports `proxy()` not `middleware()`
- **Button has no `asChild`** — Base UI variant. Use `buttonVariants()` + `<Link>` instead
- **Tailwind v4** — no `tailwind.config.js`; config in CSS and `components.json`
- **`SelectValue` shows raw DB values** — never use `<SelectValue>` in triggers. Use `<span>{value ? LABEL_MAP[value] : 'placeholder'}</span>` from state
- **No PrimeReact** — uses shadcn/ui (Base UI variant); do NOT add PrimeReact

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Next.js 16 App Router, React 19, TypeScript |
| Database | Supabase (PostgreSQL) + Row Level Security |
| Auth | Supabase Auth (`@supabase/ssr`) |
| UI | shadcn/ui (Base UI variant) + Tailwind CSS v4 |
| AI | OpenAI GPT-4o (`json_object` response format) |
| Billing | iCount API (`https://api.icount.co.il/api/v3.php`) |
| Webhooks | n8n HTTP Webhooks |
| Storage | Supabase Storage (private buckets) |
| Calendar | Google Calendar API (OAuth2, per-user tokens) |
| Direction | Hebrew RTL — `<html lang="he" dir="rtl">` |

---

## Route Groups

```
app/(auth)/                    — unauthenticated (login, accept-invite)
app/(dashboard)/               — authenticated; auto-wraps Sidebar + Header
  customers/, tickets/, visits/
  calendar/, finance/, warehouse/
  settings/team/
app/api/
  ai/checklist, ai/summary
  auth/google, auth/google/callback
  billing/generate-invoice, billing/test-icount, billing/test-invitation
```

---

## Auth Flow

`proxy.ts` → `supabase.auth.getUser()` → unauthenticated → `/login`

**Invitation flow:** Admin → `generateLink({ type: 'invite' })` → n8n sends email → technician clicks link → `/auth/accept-invite` → sets password → logs in normally.

**Accountant restriction:** proxy.ts redirects `accountant` role to `/finance` for any non-finance route.

---

## Role System

| Role | Access |
|------|--------|
| `admin` | Full access, billing, delete, finance charts, profitability |
| `technician_senior` | Full operational access, no billing prices |
| `technician_junior` | Own visits only, no prices, no delete |
| `accountant` | Finance dashboard only (invoices, mark paid) |

All roles in `types/index.ts` with `USER_ROLE_LABELS` and `USER_ROLE_COLORS`.

---

## Database — Migrations

| Migration | Description |
|-----------|-------------|
| 001 | billing_model on customers |
| 002 | profiles admin policies |
| 003 | customer_files table |
| 004 | warehouse: suppliers, warehouse_items, inventory_movements |
| 005 | visit_warehouse_items junction |
| 006 | billing fields on visits (billing_status, hourly_rate_snapshot, fixed_cost, price_to_customer) |
| 007 | iCount fields on visits (icount_invoice_id, icount_invoice_url, icount_doc_date) |
| 008 | accountant role + RLS policies |
| 009 | admin hourly_rate = 250 |
| 010 | visits_billing_summary view (updated with iCount + customer_email fields) |
| 011 | google_refresh_token, google_calendar_id, google_connected_at on profiles |
| 012 | notifications table |
| 013 | vat_id on customers (ח.פ / ת.ז for iCount invoices) |
| 014 | business_name NOT NULL, name nullable — company is the B2B anchor |

---

## Multi-Tenancy & RLS

Every table has `tenant_id`. SECURITY DEFINER functions:
- `get_my_tenant_id()` — returns current user's tenant
- `get_my_role()` — returns current user's role

Never set `tenant_id` manually in inserts — RLS sets it automatically.

---

## Supabase Clients — never mix contexts

```ts
lib/supabase/server.ts   // Server Components + Server Actions (cookies)
lib/supabase/client.ts   // Client Components only (browser)
lib/supabase/admin.ts    // createAdminClient() — service role, bypasses RLS
                         // Use for: Storage uploads, profile inserts for other users
```

**Admin client required for:**
- Storage bucket operations (signed URLs, upload, delete)
- Inserting profiles for newly invited users
- Saving Google OAuth tokens to another user's profile

---

## FK Disambiguation (Critical)

`tickets` has TWO foreign keys to `profiles`:
```ts
// WRONG — PostgREST returns null silently:
.select('profiles(full_name)')

// CORRECT — always use column name alias:
.select('assigned_technician:assigned_technician_id(full_name)')
```

---

## Server Actions Pattern

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function myAction(): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'לא מחובר.' }
  // ... DB operations
  revalidatePath('/relevant-path')
  return {}
}
```

**Important:** Server Actions with fire-and-forget (`promise.then()`) may not execute — always `await` webhooks and critical operations.

---

## Implemented Modules

### Module 1 — Auth & Users
- Login page, proxy auth middleware
- Invite flow: `generateLink` → n8n email → `/auth/accept-invite` → password setup
- `app/actions/team.ts`: inviteTechnician, updateTechnician, toggleTechnicianActive
- 4 roles: admin, technician_senior, technician_junior, accountant

### Module 2 — Customers
- Full CRUD, soft delete
- Tabs: פרטים, אנשי קשר, קריאות, ביקורים, ציוד, מסמכים, חיובים
- `CustomerBillingPanel` — per-customer billing history (admin/accountant only)
- **B2B field order:** `business_name` (שם חברה) is the primary required field; `name` (איש קשר) is optional; `vat_id` (ח.פ/ת.ז) third
- **`Customer.business_name: string`** (NOT NULL in DB) — always present; **`Customer.name: string | null`** — optional contact person
- All dropdowns/lists display: `"${business_name}${name ? ' — ' + name : ''}"` (company first)
- `customers` table is ordered by `business_name` everywhere

### Module 3 — Tickets (קריאות שירות)
- Full CRUD, status tracking (8 statuses), urgency, SLA
- **Auto-read:** opening a ticket with status='new' automatically sets it to 'read'
- AI Checklist panel with technician approval step
- File attachments, equipment linking

### Module 4 — Visits + Timer
- Full CRUD with visit types
- **Live timer:** `startVisit()` → stopwatch → `endVisit()` → auto-billing
- **Manual time entry:** "הזן ידנית" when timer running, "תקן זמן" on completed visits
- **Visit Outcome:** after completion, technician selects:
  - "הבעיה נפתרה" → ticket='completed'
  - "נדרש טיפול המשך בביקורים" → ticket='in_progress' + open follow-up link
  - "ממתין ל..." (ציוד/ספק/לקוח) → corresponding ticket waiting status
- **Follow-up visits:** `/visits/new?ticket=X&prev_visit=Y` shows previous visit summary

### Module 5 — Equipment
- CRUD, warranty tracking, network/remote access fields
- Link to tickets and visits
- `equipment_status` tracking through lifecycle

### Module 7 — Calendar
- Monthly view with drag-and-drop (native HTML5, RTL-aware)
- Google Calendar sync per technician (OAuth tokens stored in profiles)
- `GoogleSyncButton`: shows "חבר Google Calendar" when not connected

### Module 8 — Dashboard
- KPI cards: active tickets, today's visits, open debt, low stock
- Recent tickets with open indicator on customer cards

### Module 9 — Warehouse (מחסן)
- Suppliers, warehouse items (cost/sell price, categories)
- Inventory movements with atomic PostgreSQL RPC (`record_inventory_movement`)
- Low-stock task auto-creation
- Visit warehouse items: items used per visit → billing line items

### Module 10 — Files & Documents
- Supabase Storage: `customer-files`, `ticket-files` (private buckets)
- Signed URLs for image preview (server-side via admin client)
- Upload/delete via admin client

### Module 11 — Finance & Billing
- `finalizeVisitBilling()` — auto-triggered when visit completes
  - `work_cost = (duration_minutes / 60) × hourly_rate` (0 for contract customers)
  - `equipment_cost` from visit_warehouse_items
  - `fixed_cost` + total with VAT
- **iCount integration:**
  - `generateInvoiceForVisit()` with draft mode (`ICOUNT_DRAFT_MODE=true`)
  - Smart doctype: `order` (draft) | `inv` (deferred) | `invrec` (paid on site)
  - 3 auth fallbacks: JSON+pass → JSON+api_key → form-encoded
- **Finance Dashboard** (`/finance`):
  - KPIs: monthly revenue, invoiced, open debt
  - Filterable table with inline Generate Invoice / Mark Paid buttons
  - Admin-only: Pie chart (billing status) + Bar chart (equipment profitability)
  - Accountant sees table only; profitability data never reaches non-admin
- `billing_status`: pending → invoiced → paid (on visits and tickets)

### Module 13 — AI (OpenAI GPT-4o)
- **Checklist:** auto-suggested items/tasks/checks before visit (requires technician approval)
- **Summary:** post-visit work summary, recommended charge, future actions
- Both log to `audit_logs`

### Webhooks (n8n)
Three separate n8n webhook endpoints:
```
N8N_INVOICE_WEBHOOK_URL          # internal notification after invoice created
N8N_INVOICE_DELIVERY_WEBHOOK_URL # sends PDF to customer email (real invoices only)
N8N_INVITATION_WEBHOOK_URL       # sends invite link to new technician
```
All are fire-and-forget with 5s timeout; failures logged but never block main flow.
**Exception:** invitation webhook is `await`ed in server action (fire-and-forget fails in server actions).

---

## Key Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server only — never expose to client

# Google Calendar (per-user tokens stored in profiles table)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI              # /api/auth/google/callback

# OpenAI
OPENAI_API_KEY                   # server only

# iCount
ICOUNT_COMPANY_ID
ICOUNT_API_USER                  # email address (not display name!)
ICOUNT_API_KEY
ICOUNT_DRAFT_MODE=true           # set false for production invoices
NEXT_PUBLIC_ICOUNT_DRAFT_MODE    # shows draft badge in UI

# n8n
N8N_INVOICE_WEBHOOK_URL
N8N_INVOICE_DELIVERY_WEBHOOK_URL
N8N_INVITATION_WEBHOOK_URL
N8N_WEBHOOK_SECRET               # optional — Bearer auth header

# App
NEXT_PUBLIC_APP_URL              # used for Supabase invite redirect
```

---

## Services

| Service | File | Purpose |
|---------|------|---------|
| iCount | `lib/services/icountService.ts` | Invoice generation, draft mode, doctype logic |
| Webhooks | `lib/services/webhookService.ts` | n8n triggers (invoice, delivery, invitation) |

---

## UI Conventions

- `cn()` from `@/lib/utils` — all conditional Tailwind merging
- `buttonVariants()` from `@/components/ui/button` — link-as-button pattern
- `StatusBadge` from `@/components/shared/status-badge` — all colored status chips
- `EmptyState` from `@/components/shared/empty-state` — empty list states
- `ConfirmDialog` from `@/components/shared/confirm-dialog` — destructive action confirmation
- Hebrew dates: `toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })`
- `dir="ltr"` on email/phone inputs
- Icons: lucide-react **only** — never add icon libraries
- Soft deletes: always filter `.eq('is_deleted', false)`

---

## What Is Still Missing (Post-MVP)

1. **Tasks module** — `tasks` table exists in DB, no UI
2. **Customer signature** — `customer_signature_url` in DB, no capture UI
3. **Reports / CSV export**
4. **Settings beyond team** (company logo, templates)
5. **SLA management** (field exists, no dedicated UI)
6. **In-app notifications**
7. **Payments UI** (table exists, only "mark paid" button)
