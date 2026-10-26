import { buildingData } from './building-data.js';

// This is a schematic product illustration, not a 3D survey or the app renderer.
// Geometry is derived from the existing floor plans; routes use the app's graph.
const svg = document.querySelector('#building-model');
const ns = 'http://www.w3.org/2000/svg';
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const make = (tag, attributes = {}, parent = svg) => {
  const node = document.createElementNS(ns, tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  parent.append(node);
  return node;
};
const project = ([x, y], height = 0) => [
  600 + (x - 974) * 0.22 - (y - 952) * 0.22,
  410 + (x - 974) * 0.083 + (y - 952) * 0.083 - height,
];
const xy = (point) => point.map((value) => value.toFixed(2)).join(',');
const path = (points, closed = false) => points.map((point, i) => `${i ? 'L' : 'M'}${xy(project(point))}`).join('') + (closed ? 'Z' : '');
const floors = buildingData.floors;
const levels = Object.fromEntries(floors.map((floor, i) => [floor.id, i]));
const collapsed = [0, 18, 36, 54, 72, 90];
const expanded = [0, 18, 60, 140, 205, 235];
let heights = [...expanded];
let mode = 'route';
let step = 0;
let layoutFrame;
let markerFrame;
let movingMarker = false;
let markerLocation = { point: buildingData.steps[0].pts[0], floor: buildingData.steps[0].floor };

svg.setAttribute('viewBox', '120 -20 960 640');
const defs = make('defs');
const blur = make('filter', { id: 'model-shadow', x: '-30%', y: '-50%', width: '160%', height: '200%' }, defs);
make('feGaussianBlur', { stdDeviation: '14' }, blur);
make('path', { d: floors[2].outlines.map((loop) => path(loop, true)).join(''), fill: '#a49a8a', opacity: '.12', transform: 'translate(0 24)', filter: 'url(#model-shadow)', 'fill-rule': 'evenodd' });

const routeByFloor = new Map();
buildingData.steps.forEach((instruction) => {
  if (!routeByFloor.has(instruction.floor)) routeByFloor.set(instruction.floor, []);
  routeByFloor.get(instruction.floor).push(...instruction.pts);
});
const routeNodes = [];
const groups = floors.map((floor, index) => {
  const group = make('g', { class: 'model-floor', transform: `translate(0 ${-heights[index]})` });
  const faces = [[], []];
  floor.outlines.forEach((loop) => loop.forEach((a, i) => {
    const b = loop[(i + 1) % loop.length];
    const pa = project(a);
    const pb = project(b);
    const side = [pa, pb, [pb[0], pb[1] + 10], [pa[0], pa[1] + 10]];
    faces[(b[0] - a[0]) > (b[1] - a[1]) ? 0 : 1].push(`M${side.map(xy).join('L')}Z`);
  }));
  faces.forEach((parts, side) => make('path', { d: parts.join(''), fill: side ? '#d0cbc1' : '#e1dcd2', stroke: '#bcb6ac', 'stroke-width': '.6' }, group));
  make('path', { d: floor.outlines.map((loop) => path(loop, true)).join(''), class: 'model-top', 'fill-rule': 'evenodd' }, group);
  make('path', { d: floor.corridors.map((edge) => path(edge)).join(''), class: 'model-corridors', opacity: '.8' }, group);
  if (routeByFloor.has(floor.id)) {
    routeNodes.push(make('path', { d: path(routeByFloor.get(floor.id)), class: 'model-route' }, group));
  }
  const anchor = project([1948, 0]);
  make('path', { d: `M${xy(anchor)}h24`, class: 'model-floor-leader' }, group);
  const label = make('text', { x: anchor[0] + 32, y: anchor[1] + 4, class: 'model-floor-label' }, group);
  label.textContent = floor.id;
  return group;
});

const transfer = buildingData.steps.findIndex((instruction) => instruction.turn === 'up' || instruction.turn === 'down');
const connector = make('path', { class: 'model-connector' });
const start = make('circle', { r: '5', class: 'model-endpoint' });
const finish = make('circle', { r: '5', class: 'model-endpoint' });
const startLabel = make('text', { class: 'model-label', 'text-anchor': 'middle' });
startLabel.textContent = buildingData.from;
const finishLabel = make('text', { class: 'model-label', 'text-anchor': 'middle' });
finishLabel.textContent = buildingData.to;
const marker = make('circle', { r: '8', class: 'model-point' });

const place = (node, point) => {
  node.setAttribute('cx', point[0]);
  node.setAttribute('cy', point[1]);
};
const refreshOverlay = () => {
  const first = buildingData.steps[0];
  const last = buildingData.steps.at(-1);
  const a = project(first.pts[0], heights[levels[first.floor]]);
  const b = project(last.pts.at(-1), heights[levels[last.floor]]);
  place(start, a);
  place(finish, b);
  startLabel.setAttribute('x', a[0]);
  startLabel.setAttribute('y', a[1] + 25);
  finishLabel.setAttribute('x', b[0]);
  finishLabel.setAttribute('y', b[1] - 16);
  if (!movingMarker) place(marker, project(markerLocation.point, heights[levels[markerLocation.floor]]));
  if (transfer > 0) {
    const before = buildingData.steps[transfer - 1];
    const after = buildingData.steps[transfer];
    const from = project(before.pts.at(-1), heights[levels[before.floor]]);
    const to = project(after.pts.at(-1), heights[levels[after.floor]]);
    connector.setAttribute('d', `M${xy(from)}L${xy(to)}`);
  }
};
const applyLayout = () => {
  groups.forEach((group, i) => group.setAttribute('transform', `translate(0 ${-heights[i]})`));
  const cameraY = 50 - (heights[5] - collapsed[5]) / (expanded[5] - collapsed[5]) * 70;
  svg.setAttribute('viewBox', `120 ${cameraY} 960 640`);
  refreshOverlay();
};
const setView = (nextMode) => {
  cancelAnimationFrame(markerFrame);
  movingMarker = false;
  const current = buildingData.steps[step];
  markerLocation = { point: step === buildingData.steps.length - 1 ? current.pts.at(-1) : current.pts[0], floor: current.floor };
  mode = nextMode;
  document.querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === mode)));
  groups.forEach((group, i) => { group.setAttribute('opacity', mode === 'building' ? '1' : i > 3 ? '.24' : i < 2 ? '.58' : '1'); });
  [...routeNodes, connector, start, finish, marker, startLabel, finishLabel].forEach((node) => node.setAttribute('visibility', mode === 'route' ? 'visible' : 'hidden'));
  cancelAnimationFrame(layoutFrame);
  const initial = [...heights];
  const target = mode === 'route' ? expanded : collapsed;
  const duration = motion.matches ? 0 : 550;
  const began = performance.now();
  document.querySelector('#previous-step').disabled = true;
  document.querySelector('#next-step').disabled = true;
  const tick = (now) => {
    const t = duration ? Math.min((now - began) / duration, 1) : 1;
    const eased = 1 - (1 - t) ** 3;
    heights = initial.map((height, i) => height + (target[i] - height) * eased);
    applyLayout();
    if (t < 1) layoutFrame = requestAnimationFrame(tick);
    else updateInstruction();
  };
  layoutFrame = requestAnimationFrame(tick);
};
const updateInstruction = () => {
  const instruction = buildingData.steps[step];
  document.querySelector('#route-step').textContent = mode === 'building' ? 'Schematic building model' : `Example route / Step ${step + 1} of ${buildingData.steps.length} · Floor ${instruction.floor}`;
  document.querySelector('#route-instruction').textContent = mode === 'building' ? 'Select Route to view an example journey.' : instruction.text;
  document.querySelector('#previous-step').disabled = mode !== 'route' || movingMarker || step === 0;
  document.querySelector('#next-step').disabled = mode !== 'route' || movingMarker || step === buildingData.steps.length - 1;
};
const changeStep = (delta) => {
  const next = Math.max(0, Math.min(buildingData.steps.length - 1, step + delta));
  if (next === step) return;
  if (mode !== 'route') return;
  cancelAnimationFrame(markerFrame);
  const startPosition = [Number(marker.getAttribute('cx')), Number(marker.getAttribute('cy'))];
  const previous = step;
  step = next;
  movingMarker = true;
  updateInstruction();
  const instruction = buildingData.steps[step];
  const target = { point: step === buildingData.steps.length - 1 ? instruction.pts.at(-1) : instruction.pts[0], floor: instruction.floor };
  const previousInstruction = buildingData.steps[previous];
  const points = [startPosition];
  if (delta > 0) {
    // Complete the old floor's hallway before moving through the stair shaft.
    points.push(...previousInstruction.pts.map((point) => project(point, heights[levels[previousInstruction.floor]])));
    if (step === buildingData.steps.length - 1) points.push(...instruction.pts.map((point) => project(point, heights[levels[instruction.floor]])));
  } else {
    // Descend to the old endpoint first, then retrace its corridor in reverse.
    points.push(...[...instruction.pts].reverse().map((point) => project(point, heights[levels[instruction.floor]])));
  }
  points.push(project(target.point, heights[levels[target.floor]]));
  const lengths = points.slice(1).map((point, i) => Math.hypot(point[0] - points[i][0], point[1] - points[i][1]));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  const duration = motion.matches ? 0 : 650;
  const began = performance.now();
  const tick = (now) => {
    const t = duration ? Math.min((now - began) / duration, 1) : 1;
    let distance = total * (t * t * (3 - 2 * t));
    let segment = 0;
    while (segment < lengths.length - 1 && distance > lengths[segment]) distance -= lengths[segment++];
    const a = points[segment];
    const b = points[Math.min(segment + 1, points.length - 1)];
    const fraction = lengths[segment] ? distance / lengths[segment] : 1;
    place(marker, [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction]);
    if (t < 1) markerFrame = requestAnimationFrame(tick);
    else { movingMarker = false; markerLocation = target; refreshOverlay(); updateInstruction(); }
  };
  markerFrame = requestAnimationFrame(tick);
};

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelector('#previous-step').addEventListener('click', () => changeStep(-1));
document.querySelector('#next-step').addEventListener('click', () => changeStep(1));
const screenshots = {
  navigation: { src: 'assets/app-navigation.png', alt: 'The working app showing the route to A112, a turn-left instruction, and Back and Next controls.', caption: 'Main Entrance → A112 / Turn-by-turn directions' },
  search: { src: 'assets/app-search.png', alt: 'Searching for A112, with the matching room underneath the destination field.', caption: 'Main Entrance → A112 / Location search' },
};
document.querySelectorAll('[data-screen]').forEach((button) => button.addEventListener('click', () => {
  const selected = screenshots[button.dataset.screen];
  document.querySelectorAll('[data-screen]').forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
  const image = document.querySelector('#app-screenshot');
  image.src = selected.src;
  image.alt = selected.alt;
  document.querySelector('#screen-caption').textContent = selected.caption;
}));
const demo = document.querySelector('.demo-details');
demo.addEventListener('toggle', () => { if (!demo.open) demo.querySelector('video').pause(); });
setView('route');
updateInstruction();
