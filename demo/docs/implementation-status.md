# Implementation status — 2026-10-09

Source of product requirements: `instruction/PRD_v3.docx`, internal **Version 4.1**, including tables and UC-01–UC-21. Initial agent prompt also read. [Requirement index](requirements-traceability.md) maps all 188 FR/NFR/US/UC IDs to screens, rules and verification scope.

## Takeover baseline

Branch `master`, **no commits and no remote**, all supplied source untracked. No AGENTS.md or prior audit found. React/TypeScript web, .NET 9 API, SQLite database and Python lifecycle script existed. API baseline built; Vite initially hit sandbox child-process EPERM. Native app, README, migrations and delivery pipeline were absent. Existing files and database were preserved; no reset, clean, stash, commit or push performed.

Confirmed baseline defects included anonymous staff fallbacks, missing ownership/scope checks, guest conversion changing identity, mutable published content, consultation-only pharmacy gaps and settlement validity not reconsidered after work changes. Original tests did not reliably assert every denied/failed response.

## Delivered implementation

| Area | Implemented behavior / principal files | Evidence |
| --- | --- | --- |
| Access and sessions | `AccessPolicy.cs`, `AuthService.cs`: role + resource ownership + department/responsibility checks, patient-only registration, DB validation of active guest/current staff role, private JWT secret, no returned password hashes | API positive/negative ownership and staff guard tests |
| Reception / three QR purposes | `VisitService.cs`, `ReceptionPrep`, `ReceptionWorkspace`, native prepare/ticket: public entry creates nothing; request QR retrieves preparation; ticket QR activates existing records. Atomic confirmation, unique indexes, concurrent retry, same-ticket reprint, verified booking at desk and verified reissue | Concurrent **first** confirmation with 12 submissions / 8 workers; purpose/owner/recovery/reload tests |
| Orders / progress | Valid active mapping and prerequisite graph, linked steps, stable retry key, assigned staff completion, consultation/service/review prerequisites; unstarted cancellation preserves recorded facts | API mapping/self-cycle/missing mapping, order retry conflict, cancel, service and review tests |
| Visit vs Journey | Intermediate/final/no-payment outcomes, early settlement, invalidation when work changes, pending activation retained at closure, separate pharmacy guidance completion, automatic no-pharmacy completion | API lifecycle tests; full browser flow |
| Doctor content | Private drafts; doctor-only publish; immutable correction version; approved EN/source fallback; immediate access independent of payment; exact current section/version narration; old audio denied | API publication/fallback/correction/audio tests; browser reads before settlement |
| Guest continuity | Server records before registration, protected return claim, authenticate both identities, same patient/Visit/Journey IDs, replay denial, failed conflict preserves guest access; reissue can replace expired access after desk verification | API continuation/conversion/conflict/recovery/restart |
| Appointment/profile | Unique verified external identity fixture, appointment lookup/selection, optional desk reference verification, permitted profile updates and reuse | API linking/conflict/desk preparation; native/web forms and builds |
| Guidance / assistance / history | Current state/action/destination/wait-proceed and queue timestamps, configured textual directions, two separate playback controls, in-app notifications, scoped assistance acknowledge/resolve/escalate, owned history and separate follow-up/handoff | API assistance before/after reception and scope tests; Chromium; conditional handoff unavailable test |
| Administration | Form-based departments, locations, services, published templates, validated mapping/prerequisite configuration and existing staff role/scope edits | API mapping validation and route guard; UI type/build checks. Individual CRUD forms still need human acceptance |
| Web | Real session-gated workspaces for all roles, QR scanner/manual fallback, timeout/error/retry, polling/reconnect and memory-only clinical state, responsive layout | Production build; desktop Chromium full workflow and 390×844 touch viewport/keyboard entry |
| Native | Expo 57 / RN 0.86.3 actual native UI; camera/manual entry, custom deep links, secure session/context, safe area, Back/resume, polling, history, follow-up, guest conversion and device speech | Clean `npm ci`, TypeScript, Android Hermes bundle and Expo Android prebuild. No APK/device claim |
| Localization | Existing VI/EN dictionary plus 266 shared interface resources in `packages/i18n/src/ui.ts`; authorized medical text separate | Web/native type checks, Chromium language switch, API approved fallback |
| Persistence / delivery | Initial schema + external identity migrations, validated legacy adoption/backup; locked dependencies; Docker/Compose, startup/stop/smoke/release scripts and SHA-pinned workflows | Local runtime and Release publish; workflow/Compose YAML parse. Actual Docker/CI/deploy not executed |

## Actual verification

Environment: Windows 11 `10.0.26300`, Intel Family 6 Model 154, 16 logical CPUs; Node 22.19.0/npm 10.9, Python 3.13.9, .NET SDK **9.0.102** selected by `global.json`. SDK 10 is also installed but not used by final gates. Chromium installed by Playwright.

| Command / gate | Actual result |
| --- | --- |
| `dotnet restore services/api --locked-mode` and `dotnet build services/api --no-restore` | Passed; final Debug build 0 warnings/errors |
| `dotnet publish services/api --no-restore -c Release -o .artifacts/api-publish` | Passed; runnable Release output exists |
| `python scripts/test_backend_e2e.py` with `API_DLL` set to Release output | **16/16 passed**, 15.947 s; isolated DB/log `.artifacts/api-tests-98e1dfdb` |
| `npm run build` in `apps/web` | Passed TypeScript + Vite production build; output `apps/web/dist` |
| `npm run test:e2e` in `apps/web` | **3/3 passed**, 31.7 s; five independent role sessions, publication before payment, closure/pharmacy, reload, EN, wrong code/role guard and mobile viewport/keyboard |
| `npm ci`, `npm run typecheck`, `npm run bundle` in `apps/mobile` | Passed locked install/type check; final Android bundle in `apps/mobile/dist` (about 2.3 MB, 922 modules). Shared resource import required explicit Metro watch configuration because repository has independent npm roots |
| `npm run prebuild` in `apps/mobile` | Passed; Android project generated; generated files ignored. This is **not** Gradle/APK compilation |
| `python scripts/benchmark.py` against final Release output | **Passed:** 20 concurrent patients, 10,000 persisted steps (500/Journey), 600 warmed normal GETs; p95 **117.44 ms**, max 191.55 ms, threshold 2,000 ms. Simulated in-process appointment request separately **6.58 ms**; no real external-network latency claim |
| `./scripts/start-demo.ps1`, `./scripts/stop-demo.ps1` | Both exercised; full startup builds and checks readiness. Only recorded process IDs with matching start times are stopped |
| `python scripts/smoke.py http://127.0.0.1:5173` | Passed web HTML, proxied API health, guest auth and owned empty history |
| Migration of supplied DB | Passed, both migration history entries present; backup `services/api/hospital_visit.db.before-migrations-20261009093724.db`. Original counts retained: 10 users, 7 patients, 2 Visits, 2 Journeys, 2 diagnosis records |
| Workflow/Compose syntax | Three workflow files and Compose parsed as YAML; GitHub execution and container startup remain unverified |

Artifacts: `.artifacts/playwright-report/index.html`, `patient-completed.png`, `patient-mobile-web.png`, `performance.json`, API test logs, Release API output, web dist and native bundle. Artifacts are ignored/generated and not represented as committed releases. The local demo is running at **http://127.0.0.1:5173**, health at **http://127.0.0.1:5047/health** at handoff. See README for restart and accounts.

## Simulation and acceptance limits

* External identity/appointment is the explicit deterministic adapter, not a real hospital identity provider. Queue numbers and authorized staff service/settlement events are demo sources; no payment processor, HIS or external push is connected.
* TTS uses device/browser voices and exact authorized API text. Text fallback and obsolete-version denial are verified; audible voices, permission prompts and physical camera scans require device acceptance. No synthesized diagnoses or advice.
* Navigation provides configured department/floor/room fallback. There is no indoor map/positioning provider. Booking handoff is conditional on an authorized HTTPS `Booking__HandoffUrl`; absent configuration sends the patient to reception. No appointment is fabricated by a recommendation.
* Docker is not installed. Compose/Dockerfiles and Linux deployment/rollback scripts are supplied, but container builds, Linux execution and deployment smoke are not locally verified.
* No Git remote/commit, GitHub runner execution, SSH target or deployment secret has been provided. CI/CD configuration exists; **no CI-green commit or deployed external URL exists**. Deployment uses only a successful trusted push artifact; Android requires CI for the same commit.
* No JDK, Android SDK/adb/emulator are installed. APK generation and installation await a configured runner/SDK. iOS requires an appropriate macOS/Xcode runner and has no build or device evidence. Domain association for app links awaits an authorized host; custom-scheme/web fallback is implemented.
* Native locked install reports **22 transitive npm audit findings (7 moderate, 15 high)** in Expo/build tooling. Compatible automatic remediation was attempted; npm's remaining force path changes SDK incompatibly. No force downgrade was applied. Review compatible upstream/tool patches before release beyond the internal demo.
* Local transport is HTTP loopback. External hosting needs HTTPS termination, host-specific access controls and approved retention rules. Nginx disables URL logs for opaque access references. Demo retention/secret/cache rules are documented in README; this is not hospital production acceptance.
* Automated browser matrix: Chromium desktop and a 390×844 mobile touch viewport; no Safari/Firefox/real Android/iOS evidence. Keyboard entry/basic focus and readable fallback are exercised; formal screen-reader, 200% scaling, offline and device narration review remain acceptance tasks, not claims of compliance.

## Design and continuation notes

Web uses the existing blue/cyan hospital theme, shared cards/forms/status badges, 16px readable controls, visible keyboard focus, responsive single-column forms and a scrolling patient tab bar. Native uses platform Text scaling, minimum 48px inputs, safe-area wrapping and accessible button labels. Patient progression is entry/profile → preparation → ticket → Journey/tools → history/content; staff workspaces use scoped Visit selection and server-confirmed actions. Screenshots above serve as rendered layout references.

The API uses one deployable service and one SQLite instance; transactions, unique constraints and a single-process write gate prevent duplicate demo mutations. Do not scale it to multiple replicas. Five-second polling and refresh on mutation/resume are intentional. No clinical payload is persisted in browser storage; native context/session uses SecureStore. Changing language/context stops obsolete speech; authorization errors remove visible clinical state.

Next external acceptance steps: configure remote/branch protection and run CI on an authorized commit; provide the demo host/environment secrets and TLS then smoke the tested artifact; execute the gated Android workflow and test the APK camera/deep links/Back/TTS/restart on device; approve a browser/device/retention matrix and resolve tooling audit findings. No commit/push/store publication was performed.
