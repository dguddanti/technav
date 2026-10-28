import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';

const production = process.argv.includes('--production');
// Only (re)write hallwayNodes, e.g. after adding rooms; leaves photo spots and administrators alone.
const nodesOnly = process.argv.includes('--hallway-nodes-only');
if (!production && !process.argv.includes('--emulator')) throw new Error('Choose --emulator or --production explicitly.');
const project = production ? 'technav-db7a8' : 'demo-technav';
const host = production ? 'https://firestore.googleapis.com' : 'http://127.0.0.1:8080';
const authorization = production ? process.env.GOOGLE_OAUTH_ACCESS_TOKEN ?? execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim() : 'owner';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
const encode = (value) => value === null ? { nullValue: null } : typeof value === 'string' ? { stringValue: value } : typeof value === 'number' ? { doubleValue: value } : { mapValue: { fields: fields(value) } };
const fields = (value) => Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
const administrators = [
  'hongjunho5400@gmail.com',
  'sueuncho2028@u.northwestern.edu',
  'diegoperezaguilar521@gmail.com',
];
try {
  const { photoStations } = await server.ssrLoadModule('/src/data/photoStations.ts');
  const { nodes, floorOf } = await server.ssrLoadModule('/src/building.ts');
  const root = `projects/${project}/databases/(default)/documents`;
  const hallwayNodes = Object.entries(nodes).map(([id, point]) => [`hallwayNodes/${id}`, { floor: floorOf[id], x: point[0], y: point[1], mapVersion: 'tech-v1' }]);
  const entries = nodesOnly ? hallwayNodes : [
    ...photoStations.map(({ id, point, segment: _segment, ...spot }) => [`photoStations/${id}`, { ...spot, x: point[0], y: point[1], mapVersion: 'tech-v1' }]),
    ...hallwayNodes,
    ...administrators.map((email) => [`adminEmails/${email}`, { email, addedBy: 'bootstrap', addedAt: new Date().toISOString() }]),
  ];
  for (let start = 0; start < entries.length; start += 250) {
    const writes = entries.slice(start, start + 250).map(([id, data]) => ({ update: { name: `${root}/${id}`, fields: fields(data) } }));
    const result = await fetch(`${host}/v1/projects/${project}/databases/(default)/documents:commit`, { method: 'POST', headers: { Authorization: `Bearer ${authorization}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }) });
    if (!result.ok) throw new Error(`Registry seed failed (${result.status}): ${await result.text()}`);
  }
  console.log(nodesOnly
    ? `Seeded ${hallwayNodes.length} hallway points in ${project}.`
    : `Seeded ${photoStations.length} fixed photo spots, ${Object.keys(nodes).length} hallway points, and ${administrators.length} initial administrators in ${project}.`);
} finally { await server.close(); }
