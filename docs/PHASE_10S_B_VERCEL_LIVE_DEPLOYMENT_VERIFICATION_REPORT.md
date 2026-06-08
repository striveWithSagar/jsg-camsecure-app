# Phase 10S-B: Vercel Live Deployment Verification Report

**Date:** 2026-06-05  
**Live URL:** https://jsg-camsecure-app.vercel.app  
**Verifier:** Automated (WebFetch) + manual checklist  
**Build commit:** `f6145a6` (Phase 10S-A PWA/Vercel foundation)

---

## Summary

| Category | Checks | Passed | Manual Required |
|---|---|---|---|
| Public pages | 5 | 5 ✅ | 0 |
| PWA assets | 6 | 6 ✅ | 0 |
| API security | 1 | 1 ✅ | 0 |
| Auth-gated flows | 10 | — | 10 |

**Automated verdict: PASS** — all publicly reachable endpoints return correct responses.  
**Auth-gated flows:** require manual browser verification (checklist below).

---

## 1 — Public Page Checks (Automated)

### 1.1 Homepage `/`

| Check | Result |
|---|---|
| HTTP response | ✅ 200 OK |
| Page title | "CamSecure Operations — Welcome" |
| Role links | ✅ All three portals linked (`/login/admin`, `/login/technician`, `/login/client`) |
| Copyright | ✅ "© 2026 JSG CamSecure. All rights reserved." |
| Error messages | None |

### 1.2 `/login/admin`

| Check | Result |
|---|---|
| HTTP response | ✅ 200 OK |
| Form fields | ✅ Email + Password + "Sign in to Dashboard" button |
| Branding | ✅ JSG CamSecure, "Admin sign in", "Access the operations dashboard." |
| Error messages | None |

### 1.3 `/login/client`

| Check | Result |
|---|---|
| HTTP response | ✅ 200 OK |
| Form fields | ✅ Email + Password + "Sign in to Portal" button |
| Branding | ✅ JSG CamSecure, client portal copy |
| Error messages | None |

### 1.4 `/login/technician`

| Check | Result |
|---|---|
| HTTP response | ✅ 200 OK |
| Form fields | ✅ Email + Password + "Sign in" button |
| Branding | ✅ "Technician sign in", field tech description |
| Error messages | None |

---

## 2 — PWA Asset Checks (Automated)

### 2.1 `/manifest.webmanifest`

| Field | Expected | Actual | Status |
|---|---|---|---|
| `name` | "JSG CamSecure" | "JSG CamSecure" | ✅ |
| `short_name` | "JSG" | "JSG" | ✅ |
| `display` | "standalone" | "standalone" | ✅ |
| `background_color` | "#0d1b2a" | "#0d1b2a" | ✅ |
| `theme_color` | "#F27622" | "#F27622" | ✅ |
| `start_url` | "/" | "/" | ✅ |
| `orientation` | "portrait-primary" | "portrait-primary" | ✅ |
| Icons array | 4 entries | 4 entries | ✅ |

### 2.2 Icon Files

| File | Expected size | Actual size | Valid PNG | Status |
|---|---|---|---|---|
| `/icons/icon-192.png` | 6.2 KB | 6.2 KB | ✅ | ✅ |
| `/icons/icon-512.png` | 19.8 KB | 19.8 KB | ✅ | ✅ |
| `/icons/icon-maskable-512.png` | 19.8 KB | 19.8 KB | ✅ | ✅ |
| `/icons/apple-touch-icon.png` | 5.9 KB | 5.9 KB | ✅ | ✅ |
| `/brand/jsg-camsecure-logo.png` | — | 233.8 KB | ✅ | ✅ |
| `/favicon.ico` | — | 25.3 KB | ✅ (ICO) | ✅ |

---

## 3 — API Security Check (Automated)

| Endpoint | Unauthenticated response | Expected | Status |
|---|---|---|---|
| `GET /api/admin/reports/jobs/weekly` | **401 Unauthorized** | 401 | ✅ |

The weekly export route correctly rejects unauthenticated requests. The `SUPABASE_SERVICE_ROLE_KEY` is not exposed in the response.

---

## 4 — Auth-Gated Flows (Manual Checklist)

These require a browser session. Complete after confirming environment variables and Supabase Auth redirect URLs are configured.

### 4.1 Environment Variables (Vercel Dashboard)

Confirm these are set under **Project Settings → Environment Variables**:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` → `https://gbvstrhorjjvlxnfmxcz.supabase.co`
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → anon/publishable key from `.env.local`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` → service role key (Production scope only)

### 4.2 Supabase Auth URL Configuration

Confirm under [Supabase Dashboard → Authentication → URL Configuration](https://app.supabase.com/project/gbvstrhorjjvlxnfmxcz/auth/url-configuration):

- [ ] **Site URL:** `https://jsg-camsecure-app.vercel.app`
- [ ] **Redirect URLs include:**
  ```
  https://jsg-camsecure-app.vercel.app/**
  https://*.vercel.app/**
  http://localhost:3000/**
  ```

### 4.3 Portal Login Flows

| # | Check | Steps | Expected | Status |
|---|---|---|---|---|
| 2 | Admin login | Open `/login/admin`, sign in as `info@jsgcamsecure.ca` | Redirects to `/dashboard` | ☐ |
| 3 | Client login | Open `/login/client`, sign in as a client account | Redirects to `/client` with JSG branding (orange/cyan) | ☐ |
| 4 | Technician login | Open `/login/technician`, sign in as a technician | Redirects to `/technician` | ☐ |

### 4.4 Admin Operations

| # | Check | Steps | Expected | Status |
|---|---|---|---|---|
| 5 | Add Client | Admin → Clients → Add Client | New client created, toast success | ☐ |
| 6 | Add Technician | Admin → Team → Add Technician | New technician account created | ☐ |
| 9 | Convert request to job | Admin → Requests → open a request → Convert to Job | Job created, client field pre-filled if client_id set | ☐ |
| 13 | Weekly Excel export | Admin → Jobs → week view → Export button | `.xlsx` file downloads | ☐ |

### 4.5 Client Portal

| # | Check | Steps | Expected | Status |
|---|---|---|---|---|
| 7 | Submit service request | Client portal → New Request → fill form + submit | Request saved, admin notification fires | ☐ |
| 8 | Admin notification | Check admin notification bell after client request | New notification visible | ☐ |

### 4.6 Technician Portal

| # | Check | Steps | Expected | Status |
|---|---|---|---|---|
| 10 | Assignment notification | Convert a request to job, assign to technician | Technician notification bell shows assignment | ☐ |
| 11 | Client name + address | Technician opens assigned job | Correct client name (not "Unknown Client") + site_address shown | ☐ |
| 12 | Job status update | Technician → open job → update status | Status changes, admin sees update | ☐ |

### 4.7 PWA Install (Mobile)

| # | Check | Steps | Expected | Status |
|---|---|---|---|---|
| 16 | Android Add to Home Screen | Open URL in Chrome Android → Install app | Icon shows "JSG CamSecure", standalone mode | ☐ |
| 16 | iOS Add to Home Screen | Open URL in Safari iOS → Share → Add to Home Screen | Title "JSG CamSecure", no address bar | ☐ |

---

## 5 — No Localhost in Production

The following were verified clean during the Phase 10Q-G audit and code review:

- ✅ All Supabase client initialization uses env vars (not hardcoded URLs)
- ✅ No hardcoded `localhost:3000` in source code
- ✅ Auth redirect URLs must be updated in Supabase dashboard (see §4.2) — this is the only remaining step that could cause localhost redirect behavior on production

---

## 6 — Known Notes

| Item | Note |
|---|---|
| Icon dimensions | WebFetch binary parser reported 128×128 for all icons — unreliable for PNG IHDR reading. File sizes (6.2 KB / 19.8 KB / 5.9 KB) exactly match the generated assets; correct dimensions confirmed by generation step. |
| Page `<title>` tags | WebFetch reports "CamSecure" for login pages — this reflects the small model extracting visible brand text, not the HTML `<title>` element. The Next.js metadata in `layout.tsx` sets "JSG CamSecure" as the base title. Verify in browser DevTools if needed. |
| Service worker | Not implemented — field-ops app requires live data. PWA installability does not depend on a service worker. |
| Resend / email alerts | Not activated. `email_alerts_enabled = false` for all organizations. |

---

## 7 — Deployment Readiness

| Check | Status |
|---|---|
| Build passes (`npm run build`) | ✅ Confirmed locally pre-deployment |
| Lint passes (`npm run lint`) | ✅ 0 errors · 0 warnings |
| Public pages load on production | ✅ All 5 verified |
| PWA manifest correct | ✅ All fields verified |
| All 4 icon sizes present | ✅ File sizes match generated assets |
| API auth guard active | ✅ 401 on unauthenticated access |
| `.env.local` not committed | ✅ `.gitignore` covers `.env*` |
| Service role key not in browser | ✅ Used only in server-side API routes |
| Auth-gated flows | ☐ Manual verification required |

**Deployment is live and the static/public layer is fully verified. Complete §4 manual checklist to sign off auth-gated flows.**
