# MPC HIMS — Audit Working Document

**Single source of truth for all audit findings, statuses, and remediation.**

| Field | Detail |
|---|---|
| Date | 3 July 2026 |
| Prepared by | Claude (independent code audit + reconciliation) |
| Reconciled against | `MPC_Audit_Report.docx` (Chatly AI, 25 June 2026) |
| Branch | `audit-fixes` |
| Scope | Backend (FastAPI), Frontend (React), Base44 layer, Mobile (Flutter), Deployment (Fly.io/Docker/nginx), CI/CD, tests |

## Status legend

- **FIXED** — verified in current code; commit cited. Verified against the *code*, not the commit message.
- **FIXED (this session)** — implemented and tested during this audit round.
- **OPEN** — confirmed present in current code; scheduled for implementation.
- **PARTIAL** — the core fix landed but a residual gap remains (residual tracked separately).
- **DISPUTED** — I disagree with the finding or its severity; rationale given.
- **DEFERRED** — real but intentionally not implemented now (rationale given; revisit in advisory).

## Executive summary

The external report (25 June 2026) predates the two fix commits `67ad4c0` (26 June) and `6ade3dc` (29 June). Of its 52 findings, the majority of the critical tier is genuinely fixed in code — I verified each against the current source, not the commit messages. What remains open from the external report is concentrated in: backend clinical safety depth (C6), the Base44 platform layer (C10, C11, H14), transport security (C14), Redis/token infrastructure (H5, M12), rate-limiting coverage (H8), and test health (H1).

My independent audit adds **14 new findings (N1–N14)**, the most serious being **N1: the nginx CSP added in the June fixes would block every browser API call to `https://mpc-api.fly.dev` on the next frontend deploy** — a fix that would have caused an outage — and **N14: `POST /encounters` returns 500 on every call** (a phantom schema field), meaning new visits could not be registered through the FastAPI backend at all.

### Counts at a glance (final)

| Source | Total | Fixed pre-session (verified) | Fixed this session | Open (deferred platform work) | Disputed | Deferred with rationale |
|---|---|---|---|---|---|---|
| External report (C/H/M/L) | 52 | 23 | 13 | 1 (C11) | 5 | 10 |
| New findings (N1–N14) | 14 | 0 | 14 | 0 | 0 | 0 |
| **Total** | **66** | **23** | **27** | **1** | **5** | **10** |

N2's code defects are fixed; its infrastructure half (attaching a Redis instance) is an operator action listed in Advisory §2. Test evidence per tier is in the Implementation Log.

---

# PART 1 — CRITICAL FINDINGS

## C1. Broken backend config file — **FIXED** (`67ad4c0`)
[backend/app/core/config.py](backend/app/core/config.py) is clean Pydantic settings; `REDIS_URL` and `db_url` are intact, `SECRET_KEY` has no default and enforces ≥32 chars (`config.py:22-53`). Verified by starting the test suite against it.

## C2. Hardcoded admin password — **FIXED** (`6ade3dc`)
[backend/seed_admin.py:26-30](backend/seed_admin.py:26) reads `ADMIN_PASSWORD` from env and exits if unset. No password printed.

## C3. Hardcoded seed-user passwords — **FIXED** (`6ade3dc`)
[backend/seed_users.py:57-61](backend/seed_users.py:57) requires `SEED_USER_PASSWORD` env var; header warns dev/test only. Residual: script is still deployable to prod (no `ENVIRONMENT` gate) — accepted; it requires shell access + env var.

## C4. Missing authorization on API endpoints — **FIXED** (`81ddbdf`, `6ade3dc`)
Verified every endpoint in all 10 routers now carries `require_role(...)`: patients, encounters, billing, lab, pharmacy, admissions, nursing, admin, sync, auth. Spot evidence: [patients.py:26](backend/app/routers/patients.py:26), [lab.py:53](backend/app/routers/lab.py:53), [sync.py:26](backend/app/routers/sync.py:26), [admin.py:133](backend/app/routers/admin.py:133).

## C5. Dispensing without stock validation — **FIXED** (`6ade3dc`)
[pharmacy.py:189-200](backend/app/routers/pharmacy.py:189) rejects 400 on insufficient stock and deducts FEFO. Residual race condition (no row locking) tracked as **M1 (open)**; over-dispense vs prescription tracked as **N4 (new)**.

## C6. No backend allergy/contraindication check in pharmacy — **FIXED (this session)**
**Was OPEN.** The dispense endpoint had zero allergy checking; the frontend check (Clinical.jsx) was the only gate, and the backend is the real safety boundary (mobile app and direct API calls bypass the frontend entirely).
**Fix:** dispense and prescription-create now check `Patient.known_allergies` against each drug's name/generic name, and `Drug.contraindications` against the patient's chronic conditions. Conflicts return 409 with details; an explicit `override_allergy_block` flag allows a pharmacist/doctor to proceed and writes an audit log entry of the override. Tests added.

## C7. Drug safety check silently bypassed on error — **FIXED** (`6ade3dc`)
[Clinical.jsx:303-307](src/pages/Clinical.jsx:303): catch now shows an explicit "DRUG SAFETY CHECK UNAVAILABLE" confirm dialog; default path aborts the save.

## C8. Malaria CDS only triggers for ACT drugs — **FIXED** (`6ade3dc`)
[Clinical.jsx:309](src/pages/Clinical.jsx:309): the save-time malaria block now runs for **every** prescription when a malaria diagnosis is present (guard removed). Dead `isPrescribingAct` variable left behind — cleanup tracked in N13.

## C9. Malaria confirmation doesn't check positive result — **FIXED** (`6ade3dc`)
[Clinical.jsx:321-324](src/pages/Clinical.jsx:321): save-time gate requires completed/verified **and** a positive result. Residual: the *advisory warnings panel* ([Clinical.jsx:233](src/pages/Clinical.jsx:233)) still passes on any completed test — tracked as **N11**, fixed this session.

## C10. Base44 RLS missing on Bed / Ward / DrugInteraction — **FIXED (this session)**
**Was OPEN** — verified: [Bed.jsonc](base44/entities/Bed.jsonc), [Ward.jsonc](base44/entities/Ward.jsonc), [DrugInteraction.jsonc](base44/entities/DrugInteraction.jsonc) had no `rls` blocks (63 of 66 entities have them).
**Fix:** added role-scoped RLS to all three, modelled on the existing entity pattern: clinical staff read; Bed writes limited to admin/nurse/receptionist (bed management roles); Ward writes admin-only; DrugInteraction writes admin/pharmacist-only (it is safety-rule data). **Note:** RLS takes effect only when these entity definitions are pushed to the Base44 platform — see Advisory §3.

## C11. ~70% of cloud functions use `asServiceRole` — **OPEN / DEFERRED (platform work)**
Confirmed and quantified: **59+ `asServiceRole` occurrences across the 102 cloud functions** in `base44/functions/`. This cannot be responsibly "fixed" in one session — each function needs individual rework and platform-side testing that this repo cannot exercise.
**Triage performed:** 36 functions are invocable from the frontend (`functions.invoke(...)` call sites enumerated during audit — highest risk are the ones both user-invocable *and* service-role: `checkDrugSafety`, `bulkTriage`, `handleWorkflowStageChange`, `reconcileShift`, `saveSignature`, `generateRevenueReport`, `batchExportReports`, `automateClaimSubmissions`, `syncClaimsToDrive`). Remediation plan: (1) rework the 9 listed user-invocable functions to `auth.me()` + input validation first; (2) leave scheduled automation on service role but validate inputs; (3) platform-test each. Estimated 3–5 days of Base44 work. See Advisory §3.

## C12. Nginx missing security headers — **FIXED** (`6ade3dc`) — *but introduced N1*
[deploy/nginx-fly.conf:10-15](deploy/nginx-fly.conf:10) now sets X-Frame-Options, X-Content-Type-Options, HSTS, CSP, Referrer-Policy. However the CSP as written would break the app — see **N1**.

## C13. CORS allows all methods + credentials — **FIXED** (`6ade3dc`)
[main.py:37-43](backend/app/main.py:37): `allow_credentials=False` (Bearer tokens), methods trimmed to the six used, headers restricted.

## C14. Database SSL blanket-disabled — **FIXED (this session)**
**Was OPEN** (intentionally skipped in `6ade3dc` because the prod DB host was unconfirmed). [database.py:9](backend/app/core/database.py:9) disabled SSL for *any* `DATABASE_URL`.
**Fix:** SSL is now disabled **only** when the host is on Fly's private network (`.flycast` / `.internal`); any other host gets `ssl="require"`. The production URL (`mpc-db.flycast`) matches the private-network branch, so behaviour in the current deployment is unchanged — no outage risk — while any future external Postgres is encrypted by default.

## N1 (NEW). CSP blocks the API origin — production-breaking on next deploy — **FIXED (this session)**
**Severity: CRITICAL (availability).** The CSP added in `6ade3dc` sets `connect-src 'self' https://*.base44.app wss://*.base44.app` ([nginx-fly.conf:14](deploy/nginx-fly.conf:14)), but the frontend is built with `VITE_BACKEND_URL = 'https://mpc-api.fly.dev/api/v1'` ([fly.toml:6](fly.toml:6), [base44Client.js:14](src/api/base44Client.js:14)). Browsers would refuse every API call the moment this nginx config ships — login itself would fail clinic-wide.
**Fix:** added `https://mpc-api.fly.dev` and `wss://mpc-api.fly.dev` to `connect-src`. Longer-term the frontend should call the same-origin `/api/` proxy path instead of the absolute URL (Advisory §5).

---

# PART 2 — HIGH FINDINGS

## H1. No automated tests — **PARTIAL → FIXED (this session)**
Backend tests exist since `67ad4c0` (6 files, 26 tests) but the suite was **red**: 6 failed + 5 errored (evidence: `.pytest_cache/v/cache/lastfailed` and this session's baseline run — duplicate-email fixture collisions, cross-test rate-limiter trips, one real validator gap). Frontend has no test runner.
**Fix:** repaired test isolation (idempotent user fixtures, limiter disabled in tests), fixed the real gaps the tests exposed, added regression tests for this session's fixes (allergy gate, billing validators, triage validators, dispense cap). Frontend: `vitest` config + initial tests for `formatApiError` and the adapter field-mapping (the N9 bug class). Suite green — see Implementation Log.

## H2. Monolithic components (75KB Nursing.jsx etc.) — **DEFERRED**
Real, but decomposing 70KB clinical components on a live system is exactly the kind of surrounding refactor this round excludes. Risk of regression > benefit now. Advisory §6.

## H3. No pagination caps — **FIXED** (`6ade3dc`)
`limit: int = Query(50, ge=1, le=100)` on all list endpoints (lab results `le=500`). Spot: [patients.py:24](backend/app/routers/patients.py:24), [lab.py:51](backend/app/routers/lab.py:51). Residual param-hygiene gap on `/admin/audit-logs` → N13.

## H4. `get_db()` auto-commits — **FIXED** (`3a4d810` era, verified current)
[database.py:32-43](backend/app/core/database.py:32): commit only when a transaction is active, rollback on exception. Note: a no-op commit still occurs after read-only requests (harmless — nothing to flush). The report's stated risk (partial writes committed on error) is closed by the rollback path.

## H5. Redis fallback silently disables token revocation — **FIXED (this session)**
**Was OPEN** (deliberately skipped in `6ade3dc` — no Redis app exists in the 3-app topology, and a hard-fail would have re-triggered the outage).
**Fix (as the finding specifies, without an outage path):** [redis.py](backend/app/core/redis.py) now **fails hard when `ENVIRONMENT=production`** and falls back to `_NullRedis` only in development, with a CRITICAL-level log. The deployed backend does not set `ENVIRONMENT`, so today's behaviour is unchanged; **before** setting `ENVIRONMENT=production` on Fly, attach a Redis (e.g. Upstash via `fly redis create`) — see Advisory §2. The refresh flow also now works correctly against real Redis (M12 fix).

## H6. Audit logger swallows errors — **FIXED** (`6ade3dc`)
[audit.py:49-52](backend/app/core/audit.py:49): failures log a warning *and* print to stderr.

## H7. JWT in localStorage — **DEFERRED (disputed severity in context)**
True ([customClient.js:11-16](src/api/customClient.js:11)), but moving to httpOnly cookies means CSRF protection, cookie-domain work across `mpc.fly.dev`/`mpc-api.fly.dev`, and a rewrite of the mobile flow — a deliberate architecture change, not a patch. Mitigations now in place: 15-min access tokens, CSP (XSS hardening), CORS locked down. The mobile app already uses `flutter_secure_storage` (correct). Advisory §5.

## H8. No rate limiting beyond login — **FIXED (this session)**
**Was OPEN**: only `/auth/login` was limited ([auth.py:21](backend/app/routers/auth.py:21)).
**Fix:** app-wide default limit via `SlowAPIMiddleware` (generous 300/min so normal clinic traffic is unaffected), plus a **proxy-aware key function** — without it, every browser behind the nginx proxy shares one bucket and the clinic could rate-limit itself at shift change (see N10). Login keeps its stricter 10/min.

## H9. Duplicate UserRole enum values — **FIXED** (`6ade3dc`)
[user.py:12-28](backend/app/models/user.py:12): single `lab_technician`; the `lab_tech` references that caused outage bug #2 were dropped.

## H10. No SQLAlchemy relationships — **FIXED** (`67ad4c0`)
All models define `relationship()` with cascades; e.g. [patient.py:69-76](backend/app/models/patient.py:69). Migration `001_indexes_relationships.py` exists.

## H11. Missing DB indexes — **FIXED** (`67ad4c0`)
`index=True` on FK columns throughout ([pharmacy.py:61](backend/app/models/pharmacy.py:61), [admission.py:76-80](backend/app/models/admission.py:76)).

## H12. Pydantic schema mismatch (AdmissionCreate.diagnosis) — **FIXED** (`67ad4c0`)
No `diagnosis` field on [AdmissionCreate](backend/app/schemas/admission.py:35). Residual: `notes` / `follow_up_date` silently discarded → **N6**.

## H13. Missing clinical input validation — **PARTIAL → FIXED (this session)**
Vitals and pharmacy validators landed in `67ad4c0` ([nursing.py:21-68](backend/app/schemas/nursing.py:21), [pharmacy.py:19-121](backend/app/schemas/pharmacy.py:19)). Still missing, confirmed by the failing test `test_vital_signs_validation_bp_systolic_out_of_range`: **TriageCreate had zero validators**, and **billing schemas had none at all** (see N3).
**Fix:** triage vitals validators (same ranges as VitalSignsCreate, plus pain score 0–10, weight/height sanity), billing validators under N3.

## H14. Patient RLS `id: {{user.id}}` flaw — **FIXED (this session)**
Confirmed at [Patient.jsonc:124](base44/entities/Patient.jsonc:124): the read rule matches the *patient's* id against the *staff user's* id. With UUIDs this is a dead condition rather than a bypass, but it is wrong and was removed. Same platform-push caveat as C10.

## H15. Docker runs as root — **FIXED** (`6ade3dc`)
[backend/Dockerfile:16-17](backend/Dockerfile:16): `appuser` created and used.

## H16. No CI/CD beyond CodeQL — **FIXED** (`67ad4c0`)
[ci.yml](.github/workflows/ci.yml): ruff + pytest (backend), eslint + build (frontend); [deploy.yml](.github/workflows/deploy.yml): manual Fly deploy. Tweak this session: `audit-fixes` added to CI push triggers so this branch gets CI runs.

## N2 (NEW). Refresh-token flow broken in production — **FIXED (code) / DEFERRED (infra)**
**Severity: HIGH (availability).** Two stacked defects: (a) with no Redis in prod, `_NullRedis.get()` returns `None` → every `/auth/refresh` returns 401 → staff are silently forced to re-login every 15 minutes; (b) if a real Redis *were* attached, [auth.py:72](backend/app/routers/auth.py:72) crashes with `AttributeError` — the client is created with `decode_responses=True` so `get()` returns `str`, and `.decode()` doesn't exist on str → 500 on every refresh. The flow was broken in both configurations; test `test_refresh_token_rotation` failed accordingly.
**Fix:** (b) fixed this session (compare as `str`); test now passes against a fakeredis-style path. (a) requires attaching Redis in Fly — infra action, Advisory §2.

## N3 (NEW). No financial validation in billing — **FIXED (this session)**
**Severity: HIGH (financial integrity).** [PaymentCreate](backend/app/schemas/billing.py:31) accepted **negative or zero amounts** — a negative payment reduces `amount_paid` and manipulates balances; [LineItemCreate](backend/app/schemas/billing.py:6) accepted negative quantity/unit_price; discount was unbounded (a discount > subtotal produces a negative invoice total).
**Fix:** validators — payment amount > 0; quantity > 0; unit_price ≥ 0; discount ≥ 0; router-level check that discount ≤ subtotal; payment > outstanding balance rejected. Regression tests added ([test_billing.py](backend/tests/test_billing.py)).

## N14 (NEW). `POST /encounters` fails with 500 on every request — **FIXED (this session)**
**Severity: HIGH (availability — visit registration broken).** `EncounterCreate` carried a `department` field that does not exist on the `Encounter` model; `Encounter(**body.model_dump())` therefore raised `TypeError: 'department' is an invalid keyword argument` on **every** encounter creation — no new visit could be registered through the FastAPI backend. Found when the new end-to-end tests first exercised the endpoint (the old tests accepted 4xx/5xx-adjacent outcomes and never caught it).
**Fix:** removed the phantom field from `EncounterCreate`/`EncounterUpdate` ([encounter.py](backend/app/schemas/encounter.py)); the endpoint is now covered by the pharmacy-flow and billing test setups, which create real encounters. The same defect class (schema fields the model can't store) was swept across all schemas — `AdmissionCreate.notes`/`DischargeCreate.follow_up_date` are handled under N6.

---

# PART 3 — MEDIUM FINDINGS

## M1. Race conditions in stock/bed updates — **FIXED (this session)**
Confirmed open: dispense re-selected stock without locking ([pharmacy.py:190-208](backend/app/routers/pharmacy.py:190)); two concurrent dispenses could both pass the availability check. Same for bed allocation ([admissions.py:96-101](backend/app/routers/admissions.py:96)).
**Fix:** `with_for_update()` on DrugStock rows in dispense and on the Bed row in admit/discharge (no-op under SQLite tests, row-locks under Postgres).

## M2. Client-side filtering of 500+ records — **DEFERRED** (frontend pagination rework; Advisory §6).

## M3. No real-time bed subscriptions — **DISPUTED (severity)**
Polling at a 40-bed clinic is adequate; WebSocket infra is not justified now. Advisory §6.

## M4. 5 parallel API calls on visit selection — **DISPUTED**
`Promise.all` on independent reads is correct behaviour, not a defect.

## M5. No error boundaries — **FIXED** (`67ad4c0`) — [App.jsx:7,175](src/App.jsx:175).

## M6. Unused heavy dependencies — **FIXED (this session)**
Verified by grep: `celery`, `WeasyPrint`, `fhir.resources`, `aiosmtplib`, `Pillow`, `africastalking`, `Jinja2` — **zero imports** in backend code. Removed from [requirements.txt](backend/requirements.txt) (smaller image, smaller attack surface). Kept: `httpx` (tests), `python-multipart` (FastAPI form handling).

## M7. Fly.io 512MB RAM — **DEFERRED** (no OOM evidence in outage history; monitor — Advisory §2).

## M8. No healthcheck — **FIXED (this session)**
Fly ignores Docker `HEALTHCHECK`; the platform-correct fix is an HTTP check in [backend/fly.toml](backend/fly.toml) against `/health`. Added.

## M9. `window.location.href` navigation — **DEFERRED** (cosmetic; Advisory §6).

## M10. No .env.example — **FIXED** (`67ad4c0`) — root [.env.example](.env.example).

## M11. No license — **FIXED** (`67ad4c0`) — [LICENSE](LICENSE).

## M12. `stored.decode()` assumes bytes — **FIXED (this session)** — see N2. This was not a latent nit: it made refresh crash with any real Redis.

## M13. Hardcoded SLA thresholds / interaction lists — **DEFERRED** (Base44 data modelling; Advisory §3).

## M14. Mobile app is a scaffold — **PARTIAL / DISPUTED (count)**
Now 12 Dart files, not 2; auth is done properly (`flutter_secure_storage`, Dio interceptor refresh — [api_client.dart](mobile/lib/core/api/api_client.dart)). Still a scaffold functionally. Advisory §4.

## N4 (NEW). Dispense can exceed prescribed quantity — **FIXED (this session)**
**Severity: MEDIUM (clinical/stock integrity).** [pharmacy.py:216](backend/app/routers/pharmacy.py:216) let `dispensed_quantity` grow past `item.quantity` — a pharmacist could dispense 100 when 10 were prescribed, silently. **Fix:** 400 when a dispense would exceed the remaining prescribed quantity. Test added.

## N5 (NEW). Backend won't start with unknown `.env` keys — **FIXED (this session)**
pydantic-settings defaults to `extra="forbid"` for dotenv files; the dev `.env` contains frontend `VITE_*` keys, so the app **and the whole test suite** crashed at import ([config.py:8](backend/app/core/config.py:8)). Fixed with `extra="ignore"`. This is why the suite was unrunnable on the dev machine.

## N6 (NEW). Admission integrity gaps — **FIXED (this session)**
(a) `admit_patient` accepted a `bed_id` belonging to a *different ward* than `ward_id` — occupancy reports would disagree with reality. (b) `AdmissionCreate.notes` and `DischargeCreate.follow_up_date` were accepted and silently discarded (clinicians believe they saved a note that was dropped). **Fix:** (a) 400 on ward/bed mismatch; (b) removed the phantom fields from the schemas so the API is honest about what it stores (the React adapter sends neither — verified).

## N7 (NEW). Backend test suite red — **FIXED (this session)** — merged into H1; baseline evidence: `6 failed, 15 passed, 5 errors`.

## N8 (NEW). Repo hygiene: stale duplicate fix tree — **FIXED (this session)**
`zcpc-audit-fixed/` (a full 26k-line copy of the repo, from the audit zip), `zcpc-audit-fixed.zip`, and two loose `.patch` files are tracked in git. This *already caused an incident class*: the June fix confusion (.rej files, patches applied to the wrong tree). Removed from tracking and disk (fully recoverable from git history); caches gitignored.

## N9 (NEW). Frontend adapter field mismatches — **FIXED (this session)**
**Severity: MEDIUM (data display integrity).** [customClient.js:231](src/api/customClient.js:231) maps `admission_date: a.admitted_at` but the backend sends `admission_date` — the spread's correct value is overwritten with `undefined` (admission dates blank/Invalid Date). [customClient.js:242](src/api/customClient.js:242) computes `net_amount: i.total_amount - …` but the backend sends `total` → `NaN` in billing views (Billing.jsx references `total_amount`/`net_amount` 17 times). **Fix:** correct mappings (`total_amount: i.total`, drop the bad admission override); adapter unit tests added.

## N10 (NEW). Rate limiting keyed on direct peer IP behind proxy — **FIXED (this session)**
All browser traffic proxied by nginx reaches the backend from nginx's IP: the 10/min login limit is shared by the *entire clinic* — a morning shift-change of 11 staff locks everyone out for a minute. **Fix:** shared key function honouring `X-Forwarded-For` (first hop, set by our nginx) with fallback to peer address; both limiter instances unified. (Fly's edge also sets the header for the direct-API path.)

## N13 (NEW). Parameter/code hygiene — **FIXED (this session)**
`/admin/audit-logs` `limit` accepted negatives ([admin.py:131](backend/app/routers/admin.py:131)) → `Query(100, ge=1, le=500)`; dead `isPrescribingAct` in Clinical.jsx removed; ruff-flagged unused imports cleaned (absorbs external **L5**).

---

# PART 4 — LOW FINDINGS

| ID | Finding | Status | Note |
|---|---|---|---|
| L1 | Empty `__init__.py` files | **DISPUTED** | Standard Python package markers; not a defect. |
| L2 | No API docs beyond Swagger | **DEFERRED** | Swagger/OpenAPI is adequate at this stage. Advisory §6. |
| L3 | alembic.ini logs at WARN | **DISPUTED** | The `alembic` logger is already `INFO` ([alembic.ini](backend/alembic.ini)); root/sqlalchemy at WARN is the standard template. |
| L4 | No ESLint/Prettier CI | **FIXED** (`67ad4c0`) | ESLint enforced in CI. Prettier not adopted — style is consistent enough; optional. |
| L5 | Unused imports | **FIXED (this session)** | Via ruff — folded into N13. |
| L6 | Stub pages (JourneyMap, WasteManagement) | **DEFERRED** | Feature work, not audit scope. |
| L7 | No consent management | **DEFERRED → Advisory §7** | Malawi Data Protection Act (2024) applies — this deserves real attention, not a code patch. |
| L8 | No data retention policy | **DEFERRED → Advisory §7** | Policy first, then enforcement code. |
| N11 (NEW) | Advisory CDS panel passes on any completed malaria test ([Clinical.jsx:233](src/pages/Clinical.jsx:233)) — inconsistent with the save-time gate | **FIXED (this session)** | Panel now uses the same positive-result predicate. The hard gate was already correct; this was advisory-display only. |
| N12 (NEW) | CI never runs for `audit-fixes` pushes | **FIXED (this session)** | Branch added to push triggers. |

---

# IMPLEMENTATION LOG

All work done 3 July 2026 on branch `audit-fixes`. Baseline before any fix: backend suite **6 failed, 15 passed, 5 errors** (and unrunnable on the dev machine until N5 was fixed).

**Critical tier** — N1 (CSP API origin), C14 (conditional DB SSL, private-network aware), C10 (RLS on Bed/Ward/DrugInteraction), H14 (Patient RLS id condition removed), C6 (backend allergy/contraindication gate with audited override).
Discovered and fixed en route: N5 (config `extra="ignore"`), MRN/invoice sequence portability (`nextval` is Postgres-only — dialect-aware fallback so the suite can run on SQLite), N14 (encounters 500), test-isolation repairs (StaticPool, idempotent fixtures, limiter off in tests).
**Checkpoint: 29 passed, 2 failed — both failures being the exact findings scheduled for the High tier (refresh/Redis, triage validators).**

**High tier** — H5 (Redis fail-hard in production, memory-backed dev fallback), M12/N2 (refresh `str` compare; `jti` claim added to both token types — without it, tokens minted in the same second are byte-identical and rotation is meaningless), H8/N10 (app-wide 300/min default limit via SlowAPIMiddleware with proxy-aware keying; login stays 10/min), N3 (billing validators + router checks, 5 regression tests), H13 (TriageCreate physiological ranges — note: the pre-existing test asserted 300 mmHg systolic is invalid; ranges were made consistent with ward vitals at 40–300 and the test value moved to 350), N9 (adapter mappings + 6 vitest tests), H1 (vitest runner added; `npm test`).
**Checkpoint: backend 38 passed, 0 failed.**

**Medium tier** — M1 (`with_for_update()` on stock and bed rows), N4 (dispense capped at prescribed quantity), N6 (ward/bed match enforced; phantom schema fields removed), M6 (7 unused heavy deps removed from requirements.txt), M8 (Fly HTTP health check on `/health`), N8 (removed `zcpc-audit-fixed/` tree, zip, and stale patch files — 48 files unstaged from git; caches gitignored), N13 (audit-log limit bounded).

**Low tier** — N11 (advisory CDS panel now uses the positive-result predicate), L5 (ruff `--fix`: 32 unused imports removed; `ruff.toml` added documenting the two SQLAlchemy idioms ruff can't see; frontend `lint:fix` removed 164 unused imports), N12 (CI runs on `audit-fixes` pushes).

**Post-tier CI portability fix** — the app engine passed `pool_size`/`max_overflow` unconditionally; under CI's sqlite `DATABASE_URL` those args hit StaticPool and crash at import (CI's backend job could never have run the tests). Pool args are now Postgres-only ([database.py](backend/app/core/database.py)). Suite re-verified under the exact CI environment (`DATABASE_URL=sqlite+aiosqlite:///:memory:`): 38 passed.

**Final verification (all commands run 3 July 2026):**
- `pytest` (backend): **38 passed, 0 failed** (was 6F/15P/5E), including a run under CI's exact env
- `ruff check .` (backend): **All checks passed**
- `npm run lint`: **passes** (was 164 errors)
- `npm run test` (vitest): **6 passed**
- `npm run build`: **exit 0**, fresh `dist/` assets

**Not deployed** — per instruction, work stops at committed, tested code on `audit-fixes`.

---

# ADVISORY

### §1. Deploying this round — do it as one unit
The nginx CSP fix (N1) and the frontend build must ship **together**: the current *deployed* nginx config predates the CSP entirely, so deploying only the frontend is safe, but deploying nginx without the N1 fix would take the clinic offline (every API call blocked). Deploy order: `zcpc-api` (backend) first, then `zcpc` (frontend + nginx). Backend changes are backwards-compatible with the running frontend. After deploy, verify: login, patient search, **create a visit** (N14 means this has been broken — you may find staff have been working around it via Base44 mode), prescribe against a patient with a recorded allergy (expect the 409), record a payment.

### §2. Redis is the one piece of missing infrastructure
Refresh tokens have never worked in production (N2): staff are silently re-logged-in every 15 minutes. The code now works and degrades gracefully (in-process token store, state lost on restart), but the real fix is `fly redis create` (Upstash) and setting `REDIS_URL` on `zcpc-api`. **Order matters:** set `ENVIRONMENT=production` only *after* Redis is attached — the backend now deliberately refuses to run in production mode without it (H5). Until then it runs in development mode, exactly as it does today.

### §3. The Base44 layer is the largest remaining risk surface (C11)
59+ `asServiceRole` usages across 102 cloud functions bypass RLS entirely. The RLS fixes in this round (C10, H14) only take effect when the entity definitions are **pushed to the Base44 platform** — the files in `base44/` are a local mirror. Prioritise reworking the 9 functions that are both user-invocable and service-role (list under C11) to `auth.me()`. Budget 3–5 days. The hardcoded interaction/SLA lists (M13) belong in that same effort — move them into the `DrugInteraction` entity, which now has proper RLS.

### §4. Mobile app
The scaffold is architecturally sound (secure token storage, refresh interceptor — better token hygiene than the web app). Two things before investing further: (a) `/sync/pull` is admin-only, so the offline-sync feature can't work for clinical staff — decide the intended roles; (b) the web app's allergy gate now lives in the backend (C6), so mobile prescribing inherits it for free. That was the point of moving it server-side.

### §5. Web auth architecture (H7, deferred)
JWTs in localStorage are XSS-stealable; mitigations are in place (15-min tokens, CSP, tight CORS), but the durable fix is httpOnly cookies + CSRF or a BFF pattern. Do it together with moving the frontend to the same-origin `/api/` proxy path (drop `VITE_BACKEND_URL` absolute URL) — that also lets you remove `mpc-api.fly.dev` from the CSP and stop exposing the API publicly at all. This is a deliberate 2–3 day project; don't do it piecemeal.

### §6. Code quality debt (deferred: H2, M2, M3, M9, L2, L6)
The 70KB clinical components work but resist safe change — decompose them opportunistically (when a feature touches them), not as a big-bang refactor. Client-side filtering (M2) will start to hurt at a few thousand patients; the backend pagination is already there, the pages just need to use it. Real-time beds (M3) and the stub pages (L6) are feature decisions, not defects.

### §7. Compliance direction (L7, L8)
Malawi's Data Protection Act (2024) is in force and this system processes exactly the data it regulates. Before scale-up: a written retention policy, patient consent capture at registration, and a data-subject-access procedure. The audit-log plumbing added in these rounds is your evidence trail — keep it on. This is policy-first work; codify it before writing enforcement code.

### §8. Operational posture
- The frontend runs `min_machines_running = 0` — first visitor each morning eats a cold start; consider 1.
- 512MB on the API (M7) has shown no OOM evidence; monitor `fly status` before resizing.
- The backend health check added in M8 gives Fly restart signal — watch it after deploy.
- `Base.metadata.create_all` on startup creates *new* tables but never alters existing ones; you have Alembic wired with one migration — adopt it as the only schema-change path before the next model change, or the next column addition will 500 in production the way N14 did.
- Set up `fly postgres` snapshot verification — the audit found no evidence backups have ever been restored-tested.
