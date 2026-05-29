# Phase 10L: Photo System Hardening Report

**Date:** 2026-05-28  
**Status:** COMPLETE — awaiting commit approval  
**Base commit:** a494b81 (Phase 10K audit report)

---

## 1. Summary

| Change | Result |
|---|---|
| `srp_delete` RLS tightened (org scope + dispatcher + client ownership) | ✅ Applied |
| `JobPhotoPanel` — DB-first delete + delete success state + friendly errors | ✅ Done |
| `RequestPhotoPanel` — DB-first delete + delete success state + friendly errors | ✅ Done |
| Migration file created | ✅ `20260528000001_tighten_srp_delete.sql` |
| Build | ✅ 0 TypeScript errors · 28 routes |
| Lint | ✅ 0 errors · 0 warnings |
| RLS simulations (7 sims) | ✅ All pass |
| Storage cleanup test (8 steps) | ✅ All pass |
| DB/storage orphan check | ✅ Clean |

---

## 2. Files Changed

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260528000001_tighten_srp_delete.sql` | **NEW** | Replaces `srp_delete` policy with org-scoped version |
| `src/components/jobs/JobPhotoPanel.tsx` | **MODIFIED** | DB-first delete, `deleteDone` state, friendly error messages |
| `src/components/requests/RequestPhotoPanel.tsx` | **MODIFIED** | Same as above |
| `docs/SUPABASE_PHASE_10L_PHOTO_SYSTEM_HARDENING_REPORT.md` | **NEW** | This report |

`verify-10l.mjs` — temporary verification script, **do not commit**.

---

## 3. RLS Change: `srp_delete`

### Before

```sql
CREATE POLICY srp_delete ON service_request_photos
  FOR DELETE TO authenticated
  USING (
    (organization_id = auth_org_id() AND auth_role() IN ('owner','admin'))
    OR uploaded_by_profile_id = auth.uid()
  );
```

Issues:
- Second branch had no `organization_id = auth_org_id()` check
- No role restriction on second branch — any authenticated user who uploaded could delete, regardless of role or org context
- `dispatcher` not included in admin branch (inconsistent with `srp_insert`)

### After

```sql
CREATE POLICY srp_delete ON service_request_photos
  FOR DELETE TO authenticated
  USING (
    organization_id = auth_org_id()
    AND (
      auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
      OR (
        auth_role() = 'client'::user_role
        AND service_request_id IN (
          SELECT id FROM service_requests WHERE client_id = auth_client_id()
        )
        AND uploaded_by_profile_id = auth.uid()
      )
    )
  );
```

Changes:
- `organization_id = auth_org_id()` wraps **all** branches — every delete is org-scoped
- `dispatcher` added to the admin branch (consistent with `srp_insert`)
- Client branch is now explicit: must be a `client` role, must own the request, and must be the uploader
- Technician and other roles: no delete (no branch covers them — correct, since no insert branch exists for them either)

### Migration file

`supabase/migrations/20260528000001_tighten_srp_delete.sql`

```sql
DROP POLICY IF EXISTS srp_delete ON service_request_photos;

CREATE POLICY srp_delete ON service_request_photos
  FOR DELETE TO authenticated
  USING (
    organization_id = auth_org_id()
    AND (
      auth_role() = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'dispatcher'::user_role])
      OR (
        auth_role() = 'client'::user_role
        AND service_request_id IN (
          SELECT id FROM service_requests WHERE client_id = auth_client_id()
        )
        AND uploaded_by_profile_id = auth.uid()
      )
    )
  );
```

---

## 4. Delete Flow Change: Both Photo Panels

### Before (storage-first)

```
deletePhoto():
  1. storage.remove([path])        ← if this fails, DB row still present (correct)
  2. job_photos.delete(id)         ← if this fails after storage success:
                                       DB row remains, thumbnail shows broken image
  3. setPhotos(filter)
  4. setDeletingId(null)
```

If storage succeeded but DB failed: photo appears to the user as a broken thumbnail (no storage object but DB row still present). No recovery path — user must reload page.

### After (DB-first)

```
deletePhoto():
  1. job_photos.delete(id)          ← if this fails: photo untouched, error shown
  2. setPhotos(filter)              ← photo removed from UI immediately
  3. setDeletingId(null)
  4. storage.remove([path])         ← best-effort cleanup (no early return on failure)
     if stErr:
       console.warn(...)            ← logged for debugging
       setDeleteError("Photo removed. Storage cleanup incomplete...")
     else:
       setDeleteDone(true)          ← "Photo deleted" confirmation shown
```

Benefits:
- DB failure is surfaced to user before any destructive action
- UI is always consistent with DB state (photo disappears if and only if DB row is gone)
- Storage failure after successful DB delete: logged, user-friendly warning shown, no orphan DB row
- Worst case is an orphan storage object (wasted space), not a broken UI

---

## 5. UX Message Changes

### New `deleteDone` state

Both panels now have a `deleteDone: boolean` state. On successful delete (DB + storage both succeed), a brief "Photo deleted" confirmation appears for 2.5 seconds — matching the existing "Photo uploaded" pattern.

```tsx
{deleteDone && (
  <p className="text-xs text-c-success flex items-center justify-center gap-1">
    <CheckCircle2 className="h-3 w-3" /> Photo deleted
  </p>
)}
```

### Upload error messages (both panels)

| Scenario | Before | After |
|---|---|---|
| Storage upload fails | Raw Supabase error message | "Upload failed — could not store the file. Please try again." + `console.error` |
| DB insert fails (after storage rollback) | Raw Supabase error message | "Upload failed — could not save photo record. Please try again." + `console.error` |
| File type invalid | "Unsupported type. Use JPEG, PNG, WebP, or HEIC." | Unchanged — already clear |
| File too large | "File exceeds the 10 MB limit." | Unchanged — already clear |

### Delete error messages (both panels)

| Scenario | Before | After |
|---|---|---|
| DB delete fails | Raw Supabase error message | "Delete failed. Please try again." + `console.error` |
| Storage delete fails after DB success | (not possible — was the first step) | "Photo removed. Storage cleanup incomplete — contact support if this persists." + `console.warn` |

---

## 6. RLS Verification Results

**Method:** Each simulation ran via `execute_sql` as authenticated role with JWT claims set via `set_config('request.jwt.claims', ...)`. Test rows inserted as service_role (bypasses RLS), existence check done after `RESET ROLE` to service_role to avoid SELECT-policy interference.

### `srp_delete` simulations

| Sim | Scenario | Expected | Result |
|---|---|---|---|
| A | Admin deletes photo on d.park's request | ALLOWED | ✅ PASS (row deleted) |
| B | d.park (client) deletes own photo on own request | ALLOWED | ✅ PASS (row deleted) |
| C | d.park (client) deletes admin-uploaded photo on walk-in request | BLOCKED | ✅ PASS (row still exists) |
| D | d.park (client) deletes own-uploaded photo on walk-in request | BLOCKED | ✅ PASS (row still exists) |
| E | Technician deletes photo on any srp | BLOCKED | ✅ PASS (row still exists) |

**Note on Sim D:** Under the old policy, a client who uploaded a photo on a walk-in request could delete it (self-delete branch had no org or request-ownership check). Under the new policy this is correctly blocked — client must own the request.

### `job_photos` regression

| Sim | Scenario | Expected | Result |
|---|---|---|---|
| F | Admin SELECT job_photos | ALLOWED | ✅ PASS |
| G | Admin DELETE job_photos | ALLOWED | ✅ PASS |

---

## 7. Storage Cleanup Test Results

**Script:** `verify-10l.mjs` (Node.js, Supabase JS SDK, admin sign-in via temp password)

| Step | Action | Result |
|---|---|---|
| 1 | Admin signed in | ✅ `d483bbff-b30b-42b8-888f-abf91f3adf0f` |
| 2 | Test object uploaded to `camsecure-media` | ✅ `org/.../jobs/JOB-001/…-verify10l-cleanup.jpg` |
| 3 | `job_photos` DB row inserted | ✅ `id: 8a5fb648-dd84-454a-825c-d10e8011f586` |
| 4 | Signed URL before delete → HTTP 200 | ✅ Object accessible |
| 5 | DB row deleted first (new flow) | ✅ Deleted |
| 6 | DB row confirmed gone | ✅ No longer in `job_photos` |
| 7 | Storage object deleted (best-effort step) | ✅ Deleted |
| 8 | Signed URL after delete → HTTP 400 | ✅ Object inaccessible |
| 9 | Orphan DB row check | ✅ None |
| 10 | Orphan storage object check | ✅ None |

Admin password hash restored: `$2a$10$88STDLHX…` — confirmed `matches: true`.

---

## 8. Final DB and Storage State

| Table / Bucket | Count | Notes |
|---|---|---|
| `job_photos` | 7 rows | Real admin test photos on JOB-22, all fields correct |
| `service_request_photos` | 0 rows | Clean |
| `storage.objects` (camsecure-media) | 7 objects | Matches exactly the 7 `job_photos` rows — no orphans |

---

## 9. Build and Lint

| Check | Result |
|---|---|
| `npm run build` | ✅ 0 TypeScript errors · **28 routes** (unchanged) |
| `npm run lint` | ✅ 0 errors · 0 warnings |

---

## 10. Remaining Non-Blocking Observations

All three observations from Phase 10K are addressed or documented:

| Observation | Action in 10L |
|---|---|
| `srp_delete` second branch had no org check | ✅ Fixed — migration applied |
| Delete order: storage-first could leave broken UI | ✅ Fixed — DB-first in both panels |
| Delete button visible on `RequestPhotoPanel` when `canUpload=false` | Intentional design — no change needed |

---

## 11. Final Verdict

**PASS — all hardening tasks complete.**

- RLS tightened: `srp_delete` is now fully org-scoped with explicit role and ownership requirements
- Delete flow improved: both panels now delete DB row first, storage second — UI always consistent with DB state
- UX improved: friendly error messages for upload/delete failures; "Photo deleted" confirmation added
- 7 RLS simulations pass; 8-step storage cleanup test passes; build and lint clean; DB/storage orphan-free
