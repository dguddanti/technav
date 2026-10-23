// Append coverage spots; never move or rename existing photo stations.
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
try {
  const { nodes, edges, floorOf, places, placeFloor } = await server.ssrLoadModule('/src/building.ts');
  const { photoStations } = await server.ssrLoadModule('/src/data/photoStations.ts');
  const points = { ...nodes }; const floors = { ...floorOf }; const segments = {};
  const graph = {}; const link = (a, b) => { const length = Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]); (graph[a] ??= []).push([b, length]); (graph[b] ??= []).push([a, length]); };
  const maxGap = 80; // Normalized map pixels, not a calibrated real-world distance.
  for (const pair of edges) {
    const [a, b] = [...pair].sort();
    const count = Math.ceil(Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]) / (maxGap / 2));
    let previous = a;
    for (let part = 1; part < count; part++) {
      const id = `${a}~${b}~${part}of${count}`;
      points[id] = [+(nodes[a][0] + (nodes[b][0] - nodes[a][0]) * part / count).toFixed(3), +(nodes[a][1] + (nodes[b][1] - nodes[a][1]) * part / count).toFixed(3)];
      floors[id] = floorOf[a]; segments[id] = [a, b]; link(previous, id); previous = id;
    }
    link(previous, b);
  }
  const distance = Object.fromEntries(Object.keys(points).map((id) => [id, Infinity]));
  const cover = (source) => {
    const queue = [[source, 0]];
    while (queue.length) {
      queue.sort((a, b) => b[1] - a[1]); const [id, cost] = queue.pop();
      if (cost >= distance[id]) continue;
      distance[id] = cost;
      for (const [next, length] of graph[id] ?? []) if (cost + length < distance[next]) queue.push([next, cost + length]);
    }
  };
  for (const spot of photoStations) {
    const source = Object.keys(points).find((id) => floors[id] === spot.floor && points[id][0] === spot.point[0] && points[id][1] === spot.point[1]);
    if (source) cover(source);
  }
  const stationIds = new Set(photoStations.map((spot) => spot.id)); const added = [];
  const ordered = Object.keys(points).sort();
  while (true) {
    const id = ordered.reduce((best, key) => distance[key] > distance[best] ? key : best, ordered[0]);
    if (distance[id] <= maxGap / 2) break;
    cover(id);
    const stationId = `tech-v1-${id.replaceAll(':', '-').replaceAll('~', '-')}`;
    if (stationIds.has(stationId)) continue;
    const floor = floors[id]; const point = points[id]; const segment = segments[id];
    const hallwayNodeId = segment ? segment.reduce((best, key) => Math.hypot(nodes[key][0] - point[0], nodes[key][1] - point[1]) < Math.hypot(nodes[best][0] - point[0], nodes[best][1] - point[1]) ? key : best, segment[0]) : id;
    const near = Object.keys(places).filter((name) => placeFloor[name] === floor).sort((a, b) => Math.hypot(places[a][1][0] - point[0], places[a][1][1] - point[1]) - Math.hypot(places[b][1][0] - point[0], places[b][1][1] - point[1]))[0];
    added.push({ id: stationId, floor, point, hallwayNodeId, ...(segment ? { segment } : {}), label: near ? `Near ${near}` : 'Hallway' }); stationIds.add(stationId);
  }
  const all = [...photoStations, ...added];
  writeFileSync('src/data/photoStations.ts', `// Stable photo spots in tech-v1 coordinates. Existing IDs and points must not move.\n// Coverage expanded along hallway graph segments; target gap <=80 normalized map pixels.\nimport type { PhotoStation } from '../types/reports';\n\nexport const photoStations: PhotoStation[] = [\n${all.map((spot) => `  ${JSON.stringify(spot)},`).join('\n')}\n];\n`);
  console.log(`Preserved ${photoStations.length} stations; appended ${added.length}. Total ${all.length}.`);
} finally { await server.close(); }
