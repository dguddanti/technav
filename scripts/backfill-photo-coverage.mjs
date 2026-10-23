// Backfill the unique station/direction registry before deploying the new rules.
// Keeps all existing photos; the first existing record reserves each view.
import { execFileSync } from 'node:child_process';
const production = process.argv.includes('--production');
if (!production && !process.argv.includes('--emulator')) throw new Error('Choose --production or --emulator explicitly.');
const project = production ? 'technav-db7a8' : 'demo-technav';
const host = production ? 'https://firestore.googleapis.com' : 'http://127.0.0.1:8080';
const token = production ? process.env.GOOGLE_OAUTH_ACCESS_TOKEN ?? execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim() : 'owner';
const root = `projects/${project}/databases/(default)/documents`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const slots = new Map();
let pageToken = '';
do {
  const response = await fetch(`${host}/v1/${root}/publishedPhotos?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers });
  if (!response.ok) throw new Error(`Could not read existing photos (${response.status}).`);
  const page = await response.json();
  for (const photo of page.documents ?? []) {
    const fields = photo.fields; const station = fields?.photoStationId?.stringValue;
    const heading = Number(fields?.mapHeading?.integerValue ?? fields?.mapHeading?.doubleValue);
    if (!station || ![0, 90, 180, 270].includes(heading) || fields?.mapVersion?.stringValue !== 'tech-v1') continue;
    const key = `${station}_${heading}`;
    if (!slots.has(key)) slots.set(key, { photoStationId: { stringValue: station }, mapHeading: { integerValue: String(heading) }, floor: fields.floor, mapVersion: fields.mapVersion, reportId: { stringValue: photo.name.split('/').at(-1) } });
  }
  pageToken = page.nextPageToken ?? '';
} while (pageToken);
let added = 0;
for (const [key, fields] of slots) {
  const response = await fetch(`${host}/v1/${root}/photoCoverage/${key}`, { headers });
  if (response.ok) continue;
  if (response.status !== 404) throw new Error(`Could not check photo slot (${response.status}).`);
  const created = await fetch(`${host}/v1/${root}:commit`, { method: 'POST', headers, body: JSON.stringify({ writes: [{ update: { name: `${root}/photoCoverage/${key}`, fields }, currentDocument: { exists: false } }] }) });
  if (!created.ok) throw new Error(`Could not backfill photo slot (${created.status}).`);
  added += 1;
}
console.log(`Reserved ${added} existing photo views in ${project}; ${slots.size} unique views found.`);
