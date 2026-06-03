# Client Portal — JSG CamSecure Branding & UI Polish

**Date:** 2026-05-30  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** 628c0ab (Phase 10Q-G)  
**Scope:** Client portal only — admin and technician portals unchanged.

---

## 1. Brand Reference

Logo located at: `public/brand/jsg-camsecure-logo.png`  
Source: `src/assets/images/JSG Logo.png` (copied, not moved)

| Brand element | OKLCH value | Notes |
|---|---|---|
| Orange (primary CTA) | `oklch(0.68 0.195 45)` | JSG "JSG" lettering, chevron accent |
| Orange text (readable) | `oklch(0.80 0.170 45)` | Lighter variant for text on dark bg |
| Cyan (secondary) | `oklch(0.80 0.130 207)` | "CAMSECURE" lettering color |
| Cyan text (readable) | `oklch(0.86 0.110 207)` | Lighter for body text |
| Navy background | `oklch(0.13 0.022 252)` | Existing design system value — unchanged |

---

## 2. Architecture — How Scoping Works

All brand overrides live under the CSS class `.cp-portal`, applied to the client layout wrapper. This means:
- **Admin portal**: zero CSS impact — uses the original blue primary
- **Technician portal**: zero CSS impact — unchanged
- **Client portal**: inherits orange primary, Inter body font, Rajdhani headings, and JSG color tokens

```
src/app/(client)/layout.tsx
  └─ <div class="cp-portal">       ← brand scope boundary
       <ClientHeader />            ← JSG logo, orange accents
       <main>{children}</main>     ← all pages inside scope
       <footer />
     </div>
```

### CSS variable overrides inside `.cp-portal`
```css
.cp-portal {
  --primary:            oklch(0.68 0.195 45);  /* orange replaces blue */
  --primary-foreground: oklch(0.10 0.018 45);
  --ring:               oklch(0.68 0.195 45);
  --cp-orange / --cp-orange-dim / --cp-orange-border / --cp-orange-text
  --cp-cyan   / --cp-cyan-dim   / --cp-cyan-border   / --cp-cyan-text
  font-family: var(--font-inter, sans-serif);
}
.cp-heading { font-family: var(--font-rajdhani, sans-serif); font-weight: 700; }
```

---

## 3. Files Changed

| File | Change |
|---|---|
| `public/brand/jsg-camsecure-logo.png` | **NEW** — logo asset copied from src/assets/images |
| `src/app/layout.tsx` | Added `Rajdhani` + `Inter` from `next/font/google` as CSS variables `--font-rajdhani` / `--font-inter` |
| `src/app/globals.css` | Added `.cp-portal` brand token block + `.cp-heading` + `.cp-card-orange` / `.cp-card-cyan` utility classes |
| `src/app/(client)/layout.tsx` | Added `cp-portal` class to root wrapper; orange footer border |
| `src/components/client/ClientHeader.tsx` | Replaced shield icon + text with `<Image>` JSG logo; orange/cyan gradient accent bar; orange avatar initials |
| `src/components/client/ClientTopNav.tsx` | Active state: orange background + bottom underline indicator |
| `src/app/(client)/client/ClientDashboardView.tsx` | Full hero redesign with logo, welcome, circuit-grid overlay, orange chevron accent; branded metric tiles; quick-action cards; branded job list; branded invoice alerts |
| `src/app/(client)/client/requests/page.tsx` | Rajdhani heading; orange "New Request" CTA; status-color accent bar on cards; branded empty state |
| `src/app/(client)/client/jobs/page.tsx` | Rajdhani heading; status-color accent bars; friendly status label pill; branded empty state |
| `src/app/(client)/client/invoices/page.tsx` | Rajdhani invoice numbers; Rajdhani totals; orange/cyan summary tiles; branded empty state |
| `src/app/(client)/client/requests/[id]/page.tsx` | Rajdhani heading with orange color; orange-border detail card; cp-heading section labels; cyan linked-job card |
| `src/app/(client)/client/jobs/[id]/page.tsx` | Rajdhani heading; status accent bar + friendly label pill; orange timeline dots; cyan linked-request card |

---

## 4. Design Changes in Detail

### 4.1 Header
- **Before:** Shield icon + "CamSecure" text + "Client Portal" purple label
- **After:** Real JSG CamSecure logo (`<Image priority />`, `h-8 w-auto`); top gradient bar (orange → cyan); orange avatar background; cyan user name color

### 4.2 Navigation (ClientTopNav)
- **Before:** Muted background on active
- **After:** Orange background tint + orange bottom underline on active item; whitespace-nowrap with overflow-x scroll for mobile

### 4.3 Dashboard
- **Before:** Simple welcome text + 3 metric tiles + job list
- **After:**
  - **Hero card**: dark navy gradient with JSG logo, circuit-grid overlay (CSS), orange right-edge chevron accent, "Welcome back" in Rajdhani orange
  - **Metric tiles**: orange top-border + orange icon for Active Jobs; cyan top-border + cyan icon for Completed; dynamic warning for overdue invoices
  - **Quick actions**: 2×4 grid — New Request, Your Jobs, Invoices, Request History — with branded icon badges
  - **Active jobs list**: orange icon pill, hover border highlight
  - **Invoice alerts**: orange/red bordered warning cards

### 4.4 Typography
- **Headings** (`h1`, section labels, numbers, invoice refs): `Rajdhani 700` — bold, uppercase feel, 0.04em tracking
- **Body text** (descriptions, forms, navigation, tables): `Inter` — clean, highly readable
- **Monospace** (request/job numbers in body text): `Geist Mono` — unchanged

### 4.5 Cards
All client portal cards now have a thin color accent bar at the top that reflects the item's status. Pattern:
- Orange top bar → active / pending / in-progress
- Cyan top bar → completed / secondary info
- Status-specific colors for job/request cards

### 4.6 Empty States
All empty states upgraded: branded icon in a colored circle, concise message, orange CTA button.

---

## 5. What Was Not Changed

| Area | Status |
|---|---|
| Admin portal (`/dashboard`, `/requests`, `/jobs`, `/clients`, `/technicians`, `/invoices`, `/settings`) | **Unchanged** |
| Technician portal (`/technician`) | **Unchanged** |
| Login pages (`/login/admin`, `/login/client`, `/login/technician`) | **Unchanged** |
| Supabase schema, RLS, auth, business logic | **Unchanged** |
| `RequestPhotoPanel`, `JobPhotoPanel`, `ClientRequestActions` | **Unchanged** |
| All API routes | **Unchanged** |

---

## 6. Build / Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 31 routes · 0 TypeScript errors |
| `npm run lint` | ✅ 0 errors · 0 warnings |

Fixes applied during lint pass:
- Escaped `'` → `&apos;` in `ClientDashboardView.tsx`
- Removed unused `cn` import from `invoices/page.tsx`
- Removed unused `cn` import from `jobs/[id]/page.tsx`

---

## 7. Commit Suggestion

```
feat: JSG CamSecure branding + UI polish for client portal

- Logo: public/brand/jsg-camsecure-logo.png added; used in header and dashboard hero
- Fonts: Rajdhani (headings) + Inter (body) added via next/font/google
- CSS: .cp-portal class scopes all brand tokens — admin/technician portals unaffected
- Header: JSG logo replaces generic icon; orange/cyan gradient accent bar
- Nav: orange active state with underline indicator
- Dashboard: hero card with logo + circuit grid, branded metric tiles, quick-action grid
- All client pages: Rajdhani headings, status-color accent bars, orange/cyan accents
- Empty states: branded icon circles + orange CTA buttons throughout
```
