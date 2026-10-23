// One-time snapshot. Keep station IDs/coordinates stable; append or migrate future changes.
import { createServer } from 'vite';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const output = 'src/data/photoStations.ts';
if (existsSync(output)) throw new Error('Station registry exists. Preserve IDs and edit it explicitly instead of regenerating.');
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { nodes, edges, floorOf, FLOORS, places, placeFloor, links } = await server.ssrLoadModule('/src/building.ts');
  const adjacent = {};
  for (const [a, b] of edges) { (adjacent[a] ??= new Set()).add(b); (adjacent[b] ??= new Set()).add(a); }
  const vertical = new Set(links.flatMap(link => [link.a, link.b]));
  const stations = [];
  for (const floor of FLOORS) {
    const candidates = Object.keys(nodes).filter(id => floorOf[id] === floor.id).sort();
    const selected = [];
    const add = id => { if (!selected.includes(id)) selected.push(id); };
    for (const id of candidates) {
      const near = [...(adjacent[id] ?? [])];
      if (near.length !== 2 || vertical.has(id)) { add(id); continue; }
      const a = nodes[near[0]], b = nodes[near[1]], p = nodes[id];
      const cross = (a[0]-p[0])*(b[1]-p[1])-(a[1]-p[1])*(b[0]-p[0]);
      const lengths = Math.hypot(a[0]-p[0],a[1]-p[1])*Math.hypot(b[0]-p[0],b[1]-p[1]);
      if (lengths && Math.abs(cross)/lengths > .5) add(id);
    }
    // Fill long stretches of hallway without requiring photos at every routing vertex.
    for (const id of candidates) if (!selected.some(other => Math.hypot(nodes[id][0]-nodes[other][0],nodes[id][1]-nodes[other][1]) < 220)) add(id);
    for (const id of selected) {
      const near = Object.keys(places).filter(name => placeFloor[name] === floor.id).sort((a,b) => Math.hypot(nodes[id][0]-places[a][1][0],nodes[id][1]-places[a][1][1])-Math.hypot(nodes[id][0]-places[b][1][0],nodes[id][1]-places[b][1][1]))[0];
      stations.push({id:`tech-v1-${id.replace(':','-')}`,floor:floor.id,point:nodes[id],hallwayNodeId:id,label:near?`Near ${near}`:`${floor.name} hallway`});
    }
  }
  mkdirSync('src/data', { recursive: true });
  writeFileSync(output, "// Stable photo spots in the tech-v1 map coordinate system. Do not regenerate existing IDs.\nimport type { PhotoStation } from '../types/reports';\n\nexport const photoStations: PhotoStation[] = "+JSON.stringify(stations,null,2)+';\n');
  console.log(`Created ${stations.length} fixed photo spots.`);
} finally { await server.close(); }
