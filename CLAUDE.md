# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build + TypeScript check
npm run lint     # ESLint (Next.js core-web-vitals + TypeScript)
npm run start    # Serve production build
# No test runner configured
```

## Critical: This is Next.js 16, not 14

Next.js 16 breaks several conventions. Always read `node_modules/next/dist/docs/` before using new APIs.

Key differences from Next.js 14:
- **`proxy.ts`** (not `middleware.ts`) — file is named `proxy.ts` and exports `proxy()` not `middleware()`
- **Button has no `asChild`** — shadcn here uses Base UI (`@base-ui/react/button`), not Radix. Use `buttonVariants()` + `<Link>` instead of `<Button asChild><Link>`
- **Tailwind v4** — no `tailwind.config.js`; configuration is in CSS and `components.json`
- **`SelectValue` shows raw DB values** — Base UI's `SelectValue` renders the raw enum (`private`, `pay_per_visit`) not the display label. Never use `<SelectValue>` in triggers. Put a `<span>` with the Hebrew label directly from state: `<span>{value ? LABEL_MAP[value] : 'placeholder...'}</span>`

## Architecture

### Stack
- **Runtime**: Next.js 16 App Router, React 19, TypeScript
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Auth**: Supabase Auth (`@supabase/ssr`)
- **UI**: shadcn/ui (Base UI variant) + Tailwind CSS v4
- **Direction**: Hebrew RTL — `<html lang="he" dir="rtl">`

### Route Groups
- `app/(auth)/` — unauthenticated pages (login only)
- `app/(dashboard)/` — all authenticated pages; layout auto-wraps with Sidebar + Header

### Auth Flow
`proxy.ts` runs on every request → checks `supabase.auth.getUser()` → unauthenticated users redirect to `/login`. Authenticated users on `/login` redirect to `/`.

### Supabase Clients — never mix contexts
- `lib/supabase/server.ts` — Server Components + Server Actions (reads cookies)
- `lib/supabase/client.ts` — Client Components only (browser)

### Data Fetching Pattern
Pages are async Server Components. Query Supabase directly:
```ts
const supabase = await createClient() // from @/lib/supabase/server
const { data } = await supabase.from('customers').select('*').eq('is_deleted', false)
```

### Server Actions
Live in `app/actions/[module].ts`. Always start with `'use server'` and use the server client. RLS enforces tenant isolation automatically — never set `tenant_id` manually.

### Multi-Tenancy & RLS
Every table has `tenant_id`. Postgres functions `get_my_tenant_id()` and `get_my_role()` are `SECURITY DEFINER` — they bypass RLS to identify the current user. All application queries go through RLS policies automatically.

### Role System
`admin` > `technician_senior` > `technician_junior`
- Junior: sees only tickets assigned to them; read-only equipment
- Admin: only role with access to payments/financials
- All roles in `types/index.ts` with Hebrew label maps

### Types
`types/index.ts` — single source of truth. Use the exported label maps and color maps in UI:
```ts
TICKET_STATUS_LABELS[status]     // Hebrew label
TICKET_STATUS_COLORS[status]     // Tailwind classes for badge
CUSTOMER_TYPE_LABELS[type]
```

### UI Conventions
- `cn()` from `@/lib/utils` for all conditional Tailwind class merging
- `buttonVariants()` from `@/components/ui/button` — use with `<Link className={buttonVariants()}>` for link buttons
- **Supabase FK disambiguation** — `tickets` has two FKs to `profiles` (`assigned_technician_id` and `opened_by`). Never write `profiles(full_name)` in a tickets select — PostgREST returns null silently. Always use the column name: `assigned_technician:assigned_technician_id(full_name)`. Same rule for any table with multiple FKs to the same target.
- Email/phone inputs need `dir="ltr"` to override the page-level RTL
- Hebrew dates: `toLocaleDateString('he-IL', { weekday: 'long', ... })`
- Icons: lucide-react only
- Soft deletes: always filter `is_deleted = false`; never hard-delete from UI
