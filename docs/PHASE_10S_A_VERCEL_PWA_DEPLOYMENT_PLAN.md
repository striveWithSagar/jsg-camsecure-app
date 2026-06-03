# Phase 10S-A: Vercel Deployment + PWA Preparation Plan

**Date:** 2026-06-03  
**Build:** ✅ 32 routes + `/manifest.webmanifest` · 0 TypeScript errors  
**Lint:** ✅ 0 errors · 0 warnings

---

## Step 1 — Deployment Audit Results

### 1.1 Repo status

| Check | Result |
|---|---|
| `git status` | Clean (pending 10R-G uncommitted fix + this plan) |
| Latest `main` pushed | ✅ `e4294cd` — "chore: add final client demo readiness report" |
| `.env.local` gitignored | ✅ `.gitignore` contains `.env*` — covers `.env.local`, `.env.production.local`, etc. |

### 1.2 Environment variables

| Variable | Type | Where used | Browser? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Public** | `client.ts`, `server.ts`, all route handlers | ✅ Yes (safe — project URL only) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Public** | `client.ts`, `server.ts`, all route handlers | ✅ Yes (safe — anon/publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** | `service-role.ts` only | ❌ Never — server-only |

### 1.3 Service role key security audit

`SUPABASE_SERVICE_ROLE_KEY` is used exclusively in:
- `src/lib/supabase/service-role.ts` (creates the client)
- Imported only by API route handlers: `/api/admin/accounts`, `/api/auth/request-password-help`

No "use client" component imports `service-role.ts`. The error messages in `AccountActionsPanel.tsx`, `AddClientDialog.tsx`, `AddTechnicianDialog.tsx` mention the variable **name** as a string (for developer guidance), never the value. **Confirmed safe.** ✅

---

## Step 2 — Vercel Setup Instructions

### 2.1 Connect repo

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import from GitHub → select `striveWithSagar/jsg-camsecure-app`
3. Framework: **Next.js** (auto-detected)
4. Root directory: `app` ← **important** — the Next.js project is inside the `app/` subfolder, not the repo root

### 2.2 Environment variables to add in Vercel dashboard

Navigate to **Project Settings → Environment Variables** and add:

| Variable | Value | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gbvstrhorjjvlxnfmxcz.supabase.co` | Production + Preview + Development |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | *(copy from `.env.local`)* | Production + Preview + Development |
| `SUPABASE_SERVICE_ROLE_KEY` | *(copy from `.env.local`)* | Production only (not Preview unless needed) |

> ⚠ Never paste `SUPABASE_SERVICE_ROLE_KEY` into any public field or client-side config.

### 2.3 Deploy

1. Click **Deploy** — Vercel will run `npm run build` automatically
2. Watch for build errors (none expected — build passes locally)
3. Note the production URL: `https://jsg-camsecure-app.vercel.app` (or custom)

### 2.4 Update Supabase Auth settings after deployment

Once the Vercel URL is known:

1. Go to [Supabase Dashboard](https://app.supabase.com/project/gbvstrhorjjvlxnfmxcz) → **Authentication → URL Configuration**
2. **Site URL:** set to `https://your-app.vercel.app`
3. **Additional Redirect URLs:** add:
   ```
   https://your-app.vercel.app/**
   https://*.vercel.app/**
   http://localhost:3000/**
   ```
4. Save changes.

> Without this step, Supabase login will redirect to the old localhost URL and fail on production.

### 2.5 Test on deployed URL

- [ ] `/login/admin` → admin dashboard
- [ ] `/login/client` → client portal with JSG branding
- [ ] `/login/technician` → tech portal
- [ ] Admin: Add Client → confirms `SUPABASE_SERVICE_ROLE_KEY` is wired
- [ ] Client: Submit request → admin notification fires
- [ ] Weekly export: `/jobs?date=week` → Export button downloads `.xlsx`

---

## Step 3 — PWA Audit Results

| Feature | Before | After |
|---|---|---|
| `manifest.ts` / `manifest.json` | ❌ Missing | ✅ Added |
| Icons (`icon-192.png`, `icon-512.png`) | ❌ Missing | ⚠ Need PNG export (see Step 4) |
| `apple-touch-icon.png` | ❌ Missing | ⚠ Need PNG export |
| `themeColor` metadata | ❌ Missing | ✅ Added (`#0d1b2a`) |
| `appleWebApp` metadata | ❌ Missing | ✅ Added |
| `viewport` metadata | ❌ Missing | ✅ Added (no user-scaling) |
| Service worker / offline | ❌ Not applicable | Not added — field-ops app needs live data |
| Manifest route | ❌ Not present | ✅ `/manifest.webmanifest` (static) |

---

## Step 4 — PWA Implementation Completed

### 4.1 Files added/changed

| File | Action |
|---|---|
| `src/app/manifest.ts` | **NEW** — PWA manifest |
| `src/app/layout.tsx` | **UPDATED** — added `viewport`, `appleWebApp`, `themeColor`, `manifest` metadata |
| `public/icons/icon.svg` | **NEW** — brand SVG source for icon generation |

### 4.2 Manifest content

```typescript
{
  name:             "JSG CamSecure",
  short_name:       "JSG",
  start_url:        "/",
  display:          "standalone",
  orientation:      "portrait-primary",
  background_color: "#0d1b2a",   // dark navy
  theme_color:      "#F27622",   // JSG orange
  categories:       ["business", "productivity"],
}
```

### 4.3 PNG icons — generated ✅

All icon PNG files have been generated from `public/icons/icon.svg` using Playwright + system Chrome:

| File | Size | Purpose | File size |
|---|---|---|---|
| `public/icons/icon-192.png` | 192×192 | Android home screen / install prompt | 6.2 KB |
| `public/icons/icon-512.png` | 512×512 | Android splash screen | 19.8 KB |
| `public/icons/icon-maskable-512.png` | 512×512 | Adaptive/maskable icon | 19.8 KB |
| `public/icons/apple-touch-icon.png` | 180×180 | iOS home screen | 5.9 KB |

Icon design: dark navy background (`#0d1b2a`), orange JSG text + camera graphic (`#F27622`), cyan CAMSECURE label (`#5BC8F5`). Matches the JSG CamSecure brand palette.

### 4.4 `layout.tsx` changes

```typescript
// NEW: Viewport export (themeColor must be in viewport in Next.js 13+)
export const viewport: Viewport = {
  themeColor:   "#0d1b2a",
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// UPDATED: metadata
export const metadata: Metadata = {
  title:       "JSG CamSecure",       // was "CamSecure — Field Operations"
  description: "Field service operations — camera and security installation",
  manifest:    "/manifest.webmanifest",
  appleWebApp: {
    capable:        true,
    title:          "JSG CamSecure",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: { ... },
};
```

---

## Step 5 — Verification Checklist

### 5.1 Build / Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 32 routes + `/manifest.webmanifest` (static) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

### 5.2 Chrome DevTools / Lighthouse

After deployment to Vercel:
1. Open Chrome DevTools → **Application → Manifest**
2. Confirm: name = "JSG CamSecure", theme_color = "#F27622", icons listed
3. Run **Lighthouse → Progressive Web App** audit
4. Expected score: 60–80+ (limited by missing proper-size PNG icons until added)

### 5.3 Android install (after Vercel deployment)

1. Open the Vercel URL in Chrome Android
2. Wait for the "Add to Home Screen" prompt (or use ⋮ menu → Install app)
3. Confirm name "JSG CamSecure" on icon
4. Launch from home screen → loads in standalone mode (no browser chrome)

### 5.4 iOS Safari (after Vercel deployment)

1. Open the Vercel URL in Safari iOS
2. Tap Share → "Add to Home Screen"
3. Confirm title "JSG CamSecure"
4. Launch → loads without Safari address bar

### 5.5 Portal functionality on deployed URL

| Check | Required env var | Expected |
|---|---|---|
| Admin login | `NEXT_PUBLIC_SUPABASE_URL` + `KEY` | ✅ |
| Client portal branding | — (code-only) | ✅ |
| Add Client / Technician | `SUPABASE_SERVICE_ROLE_KEY` | Depends on Vercel config |
| Notification bell | — (Supabase RLS) | ✅ |
| Weekly Excel export | `SUPABASE_SERVICE_ROLE_KEY` | Depends on Vercel config |

---

## Summary of Changes Made

| File | Change |
|---|---|
| `src/app/manifest.ts` | **New** — PWA manifest with JSG branding |
| `src/app/layout.tsx` | Updated title + added `viewport`, `appleWebApp`, `manifest`, `themeColor` |
| `public/icons/icon.svg` | **New** — brand SVG source for icon generation |

## Remaining Manual Steps (user action required)

1. **Generate PNG icons** from `public/icons/icon.svg` at 192×192, 512×512, 180×180 sizes and save to `public/icons/`
2. **Connect repo to Vercel** with root directory = `app`
3. **Add env vars** in Vercel dashboard
4. **Update Supabase Auth redirect URLs** after getting the Vercel URL
5. **Test all portals** on the deployed URL
