# Reports and administration

`/` remains the mobile directions app. `/admin` is the separate Google sign-in
workspace. Reporters do not see a login screen: Firebase anonymous authentication
provides an owner ID for private submissions and uploads.

## User flows

- Route / map issue: select the problem type, mark a floor-plan location, explain
  the problem, optionally attach a photo. Route and step context are included
  when reporting from navigation.
- Entrance correction: choose a room, mark its actual door, and choose the
  connected hallway. The original mapped entrance remains visible for comparison.
- Location photo: choose a stable capture station and a map-relative direction.
  The map arrow and compass update immediately. Capture with the camera or choose
  a file. Images are resized to 1600 px maximum, re-encoded as JPEG, and stripped
  of original metadata before upload.

A report enters the review queue only when both its data and optional image have
been acknowledged by Firebase. Failed uploads leave the form available to retry;
unfinished uploads are removed on a best-effort basis.

Administrators can filter reports by type/status, inspect private evidence,
adjust proposed entrance positions, approve/reject submissions, add/edit an
entrance directly on the map, and capture/publish location photos directly.
`Access` grants another Google account administrator access. Google authentication
alone does not confer privileges: the email must be verified and present in the
server-owned `adminEmails` collection. The bootstrap administrators are
`hongjunho5400@gmail.com`, `sueuncho2028@u.northwestern.edu`, and
`diegoperezaguilar521@gmail.com`. There is no email-domain restriction; each
address must support verified Google sign-in. Membership cannot be written by
ordinary users.

Approving an entrance and changing its report status is one transaction.
Published entrances update the live search catalog and the actual routing
endpoints, including their connected hallway nodes. The bundled map is retained
when published updates are unavailable. Already-started routes retain their
original step list; plan a new route to use newly published changes.

Approving a photo creates a separate published record atomically with the review.
Pending evidence is private. An approved photo reserves its station/direction
in `photoCoverage`; new reports for that view are rejected before uploading and
by Firestore rules. Photo publication and the unique reservation are atomic,
so competing approvals cannot publish the same view twice. Other directions
remain available. Fully photographed stations are green and excluded from the
photo-spot options. Existing map/entrance issue reports remain available.
Published photo files become readable only when a
matching published record exists. Published photos are a capture dataset for a
future walkthrough; the navigation screen does not yet display a 3D/photo viewer.
Map issues are manually resolved/rejected; marking one resolved does not rewrite
hallway geometry automatically. Each room currently has one canonical entrance.

## Stable capture positions

`src/data/photoStations.ts` stores stable IDs and coordinates in the normalized
1948 × 1904 `tech-v1` coordinate space. Capture stations are discrete positions,
not entire rooms or entire hallways. They include intersections/corners and
additional samples along the connected hallway graph. There are 999 stations
across six floors, including 540 added to fill sparse stretches. The refinement
uses graph distance rather than distance through nearby walls and samples long
edges; its target spacing is 80 normalized map pixels, not calibrated feet.
Original IDs/coordinates are preserved. Interior-edge stations record their
source segment. Never regenerate existing IDs when changing the map.

`create-photo-stations.mjs` refuses to overwrite an existing registry.
`densify-photo-stations.mjs` appends coverage stations without moving existing
ones. Review/commit the resulting snapshot deliberately. Publish the same registry
to Firestore before deploying a client that references new station IDs.

Directions mean up/right/down/left **on the floor plan**. True north is not
calibrated. Four photos at a station do not reconstruct correct 3D geometry or
an actual 360° panorama; smooth, accurate transitions need overlapping captures,
panoramas or additional geometry. No synthetic hallway images are generated.

## Local development and verification

Java 21+ and the Firebase CLI are needed for the Firestore/Storage emulators.
Use three terminals, in this order:

```sh
firebase emulators:start --config firebase.emulators.json --project demo-technav --only auth,firestore,storage
node scripts/seed-report-registry.mjs --emulator
VITE_USE_FIREBASE_EMULATORS=true npm run dev -- --host 127.0.0.1
```

The emulator flag is honored only by Vite development builds. It selects a
separate `demo-technav` Firebase app; production builds always use TechNav's real
project. Development analytics remain disabled. Emulator data is disposable.
Use the emulator's simulated Google login with the bootstrap email to review data.

```sh
npm run build
npm run lint
npx vitest run
node scripts/test-report-rules.mjs
```

The last command requires the running, seeded emulators. It exercises anonymous
submission, private evidence, upload type limits, prevention of self-approval and
self-granted admin access, authorized review, immutable submitted evidence,
publications, and invalid cross-floor entrance rejection. Expected denied writes
can produce Firebase permission-denied log messages while the checks pass.

## Production activation

Implementation and local validation do not activate new Firebase products.
Production Firestore is enabled (Standard edition, `nam5`) and Anonymous/Google
Authentication providers are enabled. The three bootstrap administrators, 999
photo stations, and 1843 hallway nodes have been registered. Existing published
photo slots have been backfilled (there were no published production photos).

Storage is still unavailable: the project has billing disabled and the configured
bucket does not exist. Photo submissions/uploads remain unavailable until the
project owner enables Blaze and initializes Storage. Text-only map reports and
entrance corrections use Firestore and do not require Storage.

1. In project `technav-db7a8`, enable Cloud Firestore and create the `(default)`
   database. Select a region deliberately (e.g. `us-central1`).
2. Enable Firebase Authentication's Anonymous and Google providers. Configure the
   project's support email and authorized domains for `technav-db7a8.web.app`,
   `technav-db7a8.firebaseapp.com`, and any custom app domain.
3. Initialize the existing configured Storage bucket
   `technav-db7a8.firebasestorage.app`. Review any Firebase billing requirement
   before enabling a billing plan; no billing plan is changed by these scripts.
4. With a trusted Google Cloud credential authorized for Firestore writes, run:
   `node scripts/seed-report-registry.mjs --production`. This writes the fixed
   station/node registries and bootstrap administrator; it does not modify
   published entrances, reports, or photos. Repeat only when intentionally
   publishing a registry change. Credentials are never printed by the script. Both registry scripts also accept
   `GOOGLE_OAUTH_ACCESS_TOKEN` from a trusted deployment process instead of gcloud.
5. Before deploying the duplicate-photo rules on an existing database, run
   `node scripts/backfill-photo-coverage.mjs --production` to reserve views from
   previously approved photos. This preserves all original photos. For local
   data, use `--emulator`. Then deploy the default-deny rules: `firebase deploy --only firestore:rules,storage
   --project technav-db7a8`. Confirm cross-service Storage-to-Firestore rule
   permissions when Firebase requests them.
6. Since admin previews use authenticated Storage byte reads rather than public
   download URLs, configure bucket CORS for the app's actual origins and GET
   requests. See `storage.cors.json`; apply with `gcloud storage buckets update
   gs://technav-db7a8.firebasestorage.app --cors-file=storage.cors.json`.
7. Build/deploy Hosting, then verify anonymous submission, sign-in with the
   bootstrap account, private photo access, entrance approval and a new route on
   the public site. Add further administrators in `/admin` → Access.

Official references:
- https://firebase.google.com/docs/auth/web/anonymous-auth
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/storage/web/download-files#cors_configuration
- https://firebase.google.com/docs/firestore/security/rules-conditions

Before collecting public contributions at scale, add server-side abuse/rate
controls and appropriate retention. Anonymous auth distinguishes reporters but
is not by itself a spam/rate limiter. Approved entrance corrections are overlays
on the versioned map; moving/adding hallway geometry requires a reviewed map
migration rather than an unvalidated user submission.
