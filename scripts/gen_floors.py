"""Generate hallway graphs for the Tech floor maps.

Reads the floor plan PNGs in public/maps plus OCR output from scripts/ocr.swift and writes
src/floors/*.ts. The first floor graph in src/map-data.ts is hand-tuned and left alone; this
script only adds its stairs and elevators so the other floors can connect to it.

  swiftc -O scripts/ocr.swift -o /tmp/ocr          # macOS only (Vision framework)
  /tmp/ocr public/maps/floor-2.png > /tmp/floor-2.ocr.json   # repeat per floor
  pip install numpy pillow scipy scikit-image
  python scripts/gen_floors.py /tmp                 # directory holding the *.ocr.json files

All coordinates are in the 1948 x 1904 map space used by the app.
"""

import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import disk, skeletonize

ROOT = Path(__file__).resolve().parent.parent
W, H = 1948, 1904
FLOORS = {
    # floor id: (image, room-number pattern)
    'B': ('public/maps/floor-B.png', r'([A-M])B(\d\d)([A-Z]?)'),
    '1': ('public/map.png', r'([A-M])1(\d\d)([A-Z]?)'),
    '2': ('public/maps/floor-2.png', r'([A-M])2(\d\d)([A-Z]?)'),
    '3': ('public/maps/floor-3.png', r'([A-M])3(\d\d)([A-Z]?)'),
    '4': ('public/maps/floor-4.png', r'([A-M])4(\d\d)([A-Z]?)'),
}
# The fourth-floor plan has two inset drawings of floor 5; ignore everything inside them.
IGNORE = {'4': [(1040, 2900, 1630, 3520), (3255, 1940, 3850, 2565)]}  # source pixels x0, y0, x1, y1


def load(floor):
    im = Image.open(ROOT / FLOORS[floor][0]).convert('RGBA')
    sx, sy = W / im.width, H / im.height
    # Transparent areas are outside the building; paint them like the light-gray outside.
    bg = Image.new('RGBA', im.size, (240, 240, 240, 255))
    im = Image.alpha_composite(bg, im)
    a = np.array(im)
    for x0, y0, x1, y1 in IGNORE.get(floor, []):
        a[y0:y1, x0:x1, :3] = (72, 40, 128)
    small = np.array(Image.fromarray(a).convert('RGB').resize((W, H), Image.BOX)).astype(int)
    return small, (sx, sy)


def hallway_mask(rgb):
    white = rgb.min(axis=2) >= 246
    # Some plans draw a thin light line where one hallway meets another.
    light = (rgb.min(axis=2) >= 210) & (np.ptp(rgb, axis=2) < 20)
    for se in (np.ones((1, 7), bool), np.ones((7, 1), bool)):
        white |= ndi.binary_closing(white, se) & light
    white = _hallways(white)
    # The big wing letters (A, B, ... M) are drawn over hallways and can block them, and
    # hallway names (E200D, J204...) are gray text inside them, often touching the edge.
    # Where either sits between hallway on both sides, count it as hallway.
    letter = _letters(rgb)
    # Anything that is not room, wall, stairs or restroom: text and its anti-aliasing.
    near = lambda c, t: (np.abs(rgb - np.array(c)).max(axis=2) <= t)
    room = near((200, 192, 216), 10) | near((176, 168, 208), 10) | near((192, 176, 208), 6)
    wall = (rgb[..., 0] < 110) & (rgb[..., 2] - rgb[..., 0] > 40)
    yellow = (rgb[..., 0] > 200) & (rgb[..., 2] < 120)
    blue = rgb[..., 0] < 60
    text = ~(room | wall | yellow | blue)
    extra = np.zeros_like(white)
    for mark, size in ((letter, 90), (text, 30)):
        for se in (np.ones((1, size), bool), np.ones((size, 1), bool)):
            extra |= ndi.binary_closing(white, se) & mark
    return _hallways(white | extra, opened=True)


def _letters(rgb):
    """Pixels of the big wing letters: purple-gray fill with a darker outline, letter sized."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    fill = (r - g >= 12) & (r >= 130) & (r <= 195) & (b - r >= 15) & (b - r <= 45)
    outline = (abs(r - 144) <= 8) & (abs(g - 128) <= 8) & (abs(b - 176) <= 8)
    lab, n = ndi.label(ndi.binary_dilation(fill, iterations=2))
    counts = np.bincount(lab[outline], minlength=n + 1)
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        keep[i] = counts[i] >= 15 and 25 <= max(h, w) <= 170
    # The letter's whole box, so the gaps between its strokes count too.
    out = np.zeros(lab.shape, bool)
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        if keep[i]:
            out[sl] = True
    return out


def _hallways(white, opened=False):
    if not opened:
        white = ndi.binary_opening(white, disk(3))  # drop the thin lines between rooms
    white = white | _small_holes(white, 600)  # hallway labels
    lab, n = ndi.label(white)
    dist = ndi.distance_transform_edt(white)
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        part = lab[sl] == i
        # Courtyards are too wide; white text on the map is too thin.
        keep[i] = part.sum() >= 500 and 7 <= dist[sl][part].max() < 60
    return keep[lab]


def _small_holes(mask, size):
    lab, _ = ndi.label(~mask)
    sizes = np.bincount(lab.ravel())
    return (sizes < size)[lab] & ~mask


def trace(skel):
    """Turn a one-pixel skeleton into nodes and pixel paths between them."""
    ys, xs = np.nonzero(skel)
    pix = set(zip(ys.tolist(), xs.tolist()))
    nbrs = lambda p: [(p[0] + dy, p[1] + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1)
                      if (dy or dx) and (p[0] + dy, p[1] + dx) in pix]
    special = {p for p in pix if len(nbrs(p)) != 2}
    # Junction pixels that touch each other are one junction.
    cluster, pts = {}, []
    for p in special:
        if p in cluster:
            continue
        stack, group = [p], []
        cluster[p] = len(pts)
        while stack:
            q = stack.pop()
            group.append(q)
            for r in nbrs(q):
                if r in special and r not in cluster:
                    cluster[r] = len(pts)
                    stack.append(r)
        pts.append(tuple(np.mean(group, axis=0)[::-1]))  # x, y
    paths, seen = [], set()
    for p in special:
        for q in nbrs(p):
            if q in special or (p, q) in seen:
                continue
            path, prev, cur = [p], p, q
            while cur not in special:
                path.append(cur)
                nxt = [r for r in nbrs(cur) if r != prev and r not in path[-3:]]
                if not nxt:
                    break
                prev, cur = cur, nxt[0]
            seen.add((cur, path[-1]))
            seen.add((p, q))
            if cur in special:
                path.append(cur)
                paths.append((cluster[p], cluster[cur], [(x, y) for y, x in path]))
    # Closed loops with no junction: start one anywhere.
    return pts, paths


def rdp(points, eps):
    if len(points) < 3:
        return points
    a, b = np.array(points[0], float), np.array(points[-1], float)
    d = b - a
    norm = np.hypot(*d) or 1.0
    errs = [abs(d[0] * (p[1] - a[1]) - d[1] * (p[0] - a[0])) / norm for p in points[1:-1]]
    i = int(np.argmax(errs)) + 1
    if errs[i - 1] <= eps:
        return [points[0], points[-1]]
    return rdp(points[:i + 1], eps)[:-1] + rdp(points[i:], eps)


class Graph:
    def __init__(self):
        self.pts, self.edges = [], set()

    def add(self, p):
        self.pts.append([float(p[0]), float(p[1])])
        return len(self.pts) - 1

    def link(self, a, b):
        if a != b:
            self.edges.add((min(a, b), max(a, b)))

    def degree(self):
        deg = [0] * len(self.pts)
        for a, b in self.edges:
            deg[a] += 1
            deg[b] += 1
        return deg

    def seg_len(self, a, b):
        return np.hypot(self.pts[a][0] - self.pts[b][0], self.pts[a][1] - self.pts[b][1])


def build_graph(mask):
    pts, paths = trace(skeletonize(mask))
    g = Graph()
    ids = [g.add(p) for p in pts]
    for a, b, path in paths:
        simple = rdp(path, 3.0)
        prev = ids[a]
        for p in simple[1:-1]:
            cur = g.add(p)
            g.link(prev, cur)
            prev = cur
        g.link(prev, ids[b])
    prune_spurs(g)
    collapse_loops(g)
    prune_spurs(g)
    straighten(g)
    smooth_chains(g)
    straighten(g)
    merge_close(g, 6)
    return g


def smooth_chains(g, eps=11.0):
    """Drop little kinks: simplify each run of pass-through nodes between junctions."""
    adj = {}
    for a, b in g.edges:
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)
    ends = {n for n, m in adj.items() if len(m) != 2}
    seen, edges, visited = set(), set(), set()
    for start in ends:
        for nxt in adj[start]:
            if (start, nxt) in seen:
                continue
            chain = [start, nxt]
            while chain[-1] not in ends and chain[-1] != start:
                chain.append(next(m for m in adj[chain[-1]] if m != chain[-2]))
            seen.add((chain[-1], chain[-2]))
            seen.add((start, nxt))
            visited.update(chain)
            pos = {tuple(g.pts[i]): i for i in chain}
            kept = [pos[tuple(p)] for p in rdp([tuple(g.pts[i]) for i in chain], eps)]
            for x, y in zip(kept, kept[1:]):
                edges.add((min(x, y), max(x, y)))
    # Loops with no junction at all are left as they are.
    g.edges = {(a, b) for a, b in edges if a != b} | {e for e in g.edges if e[0] not in visited}


def collapse_loops(g, limit=220):
    """The big wing letters sit on top of hallways, so the skeleton splits around them.
    Any cycle shorter than `limit` is one of those; squash it to a single point."""
    adj = {}
    for a, b in g.edges:
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    parent = list(range(len(g.pts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for a, b in g.edges:
        # Shortest a->b path without this edge.
        best, prev, todo = {a: 0.0}, {}, {a}
        while todo:
            n = min(todo, key=best.get)
            todo.discard(n)
            if n == b or best[n] > limit:
                break
            for m in adj[n]:
                if {n, m} == {a, b}:
                    continue
                d = best[n] + g.seg_len(n, m)
                if d < best.get(m, 1e9):
                    best[m], prev[m] = d, n
                    todo.add(m)
        if b in best and best[b] + g.seg_len(a, b) <= limit:
            n = b
            while n != a:
                parent[find(n)] = find(a)
                n = prev[n]
    groups = {}
    for i in range(len(g.pts)):
        groups.setdefault(find(i), []).append(i)
    for root, members in groups.items():
        if len(members) < 2:
            continue
        c = np.mean([g.pts[i] for i in members], axis=0)
        g.pts[root] = [float(c[0]), float(c[1])]
    g.edges = {(min(find(a), find(b)), max(find(a), find(b))) for a, b in g.edges if find(a) != find(b)}


def prune_spurs(g, short=30):
    for _ in range(3):
        deg = g.degree()
        drop = {(a, b) for a, b in g.edges
                if (deg[a] == 1 and deg[b] > 2 or deg[b] == 1 and deg[a] > 2) and g.seg_len(a, b) < short}
        g.edges -= drop


def straighten(g):
    """Give near-horizontal runs one y and near-vertical runs one x."""
    for axis, other in ((1, 0), (0, 1)):  # axis to share, axis the run goes along
        parent = list(range(len(g.pts)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i
        for a, b in g.edges:
            d_axis = abs(g.pts[a][axis] - g.pts[b][axis])
            d_other = abs(g.pts[a][other] - g.pts[b][other])
            if d_axis <= max(4, 0.12 * d_other):
                parent[find(a)] = find(b)
        groups = {}
        for i in range(len(g.pts)):
            groups.setdefault(find(i), []).append(i)
        for members in groups.values():
            if len(members) > 1:
                v = round(float(np.median([g.pts[i][axis] for i in members])))
                for i in members:
                    g.pts[i][axis] = v


def merge_close(g, tol):
    changed = True
    while changed:
        changed = False
        for a, b in sorted(g.edges):
            if g.seg_len(a, b) < tol:
                # Keep a; reattach b's edges.
                g.edges = {(min(x if x != b else a, y if y != b else a), max(x if x != b else a, y if y != b else a))
                           for x, y in g.edges if {x, y} != {a, b}}
                g.edges = {(x, y) for x, y in g.edges if x != y}
                changed = True
                break


def project(g, p):
    """Nearest point on any edge: (edge, t, point)."""
    best = None
    for a, b in g.edges:
        A, B = np.array(g.pts[a]), np.array(g.pts[b])
        d = B - A
        t = np.clip(np.dot(np.array(p) - A, d) / (np.dot(d, d) or 1), 0, 1)
        q = A + t * d
        dist = np.hypot(*(q - np.array(p)))
        if best is None or dist < best[0]:
            best = (dist, (a, b), t, q)
    return best


def attach(g, items):
    """items: [(key, door point)] -> {key: node}. Splits edges at the door's projection."""
    on_edge = {}
    for key, door in items:
        _, edge, t, q = project(g, door)
        on_edge.setdefault(edge, []).append((t, key, q))
    out = {}
    for (a, b), hits in on_edge.items():
        g.edges.discard((a, b))
        chain = [a]
        for t, key, q in sorted(hits, key=lambda h: h[0]):
            if t <= 0.001:
                out[key] = a
                continue
            if t >= 0.999:
                out[key] = b
                continue
            q = [round(q[0]), round(q[1])]
            last = chain[-1]
            if g.pts[last] == q:
                out[key] = last
                continue
            n = g.add(q)
            chain.append(n)
            out[key] = n
        chain.append(b)
        for x, y in zip(chain, chain[1:]):
            g.link(x, y)
    return out


def room_mask(rgb):
    wall = (rgb[..., 0] < 110) & (rgb[..., 2] - rgb[..., 0] > 40)
    return (rgb.min(axis=2) < 222) & ~wall


def door_for(region, hall, center, reach=6):
    """Hallway pixel next to the region, closest to the label."""
    ys, xs = np.nonzero(region)
    y0, x0 = max(0, ys.min() - reach), max(0, xs.min() - reach)
    y1, x1 = min(H, ys.max() + reach + 1), min(W, xs.max() + reach + 1)
    near = ndi.binary_dilation(region[y0:y1, x0:x1], disk(reach)) & hall[y0:y1, x0:x1]
    ys, xs = np.nonzero(near)
    if not len(xs):
        return None
    xs, ys = xs + x0, ys + y0
    i = int(np.argmin((xs - center[0]) ** 2 + (ys - center[1]) ** 2))
    return (int(xs[i]), int(ys[i]))


def region_at(mask, labels, boxes, center):
    x, y = int(center[0]), int(center[1])
    if not mask[y, x]:
        ys, xs = np.nonzero(mask[max(0, y - 8):y + 9, max(0, x - 8):x + 9])
        if not len(xs):
            return None
        y, x = max(0, y - 8) + ys[0], max(0, x - 8) + xs[0]
    i = labels[y, x]
    region = np.zeros_like(mask)
    region[boxes[i - 1]] = labels[boxes[i - 1]] == i
    return region


def clean_text(t):
    return t.replace('|', '').replace(' ', '').strip('.:;,-_')


def fix_digits(s):
    return s.replace('O', '0').replace('o', '0').replace('I', '1').replace('l', '1').replace('S', '5')


def read_rooms(floor, ocr, scale):
    pattern = re.compile('^' + FLOORS[floor][1] + '$')
    rooms, found = {}, []
    for o in ocr:
        t = clean_text(o['text'])
        if len(t) < 4:
            continue
        t = t[0] + t[1] + fix_digits(t[2:4]) + t[4:] if floor == 'B' else t[0] + fix_digits(t[1:4]) + t[4:]
        m = pattern.match(t)
        if not m or m.group(2) == '00' and floor != 'B':
            continue
        if floor == 'B' and m.group(2) == '03':  # basement hallways are XB03A, XB03B...
            continue
        c = ((o['x'] + o['w'] / 2) * scale[0], (o['y'] + o['h'] / 2) * scale[1])
        if any(x0 <= o['x'] <= x1 and y0 <= o['y'] <= y1 for x0, y0, x1, y1 in IGNORE.get(floor, [])):
            continue
        found.append((o.get('conf', 0), t, c))
    # Tiles overlap, so a label can be read twice, sometimes differently. Keep the best read
    # at each spot, then the first spot for each name.
    found.sort(key=lambda f: -f[0])
    kept = []
    for conf, t, c in found:
        if all(np.hypot(c[0] - k[2][0], c[1] - k[2][1]) > 8 for k in kept):
            kept.append((conf, t, c))
    for conf, t, c in kept:
        rooms.setdefault(t, c)
    return rooms


def read_shafts(floor, rgb, ocr, scale):
    yellow = (rgb[..., 0] > 225) & (rgb[..., 1] > 150) & (rgb[..., 1] < 215) & (rgb[..., 2] < 100)
    yellow = ndi.binary_closing(yellow, disk(4))
    lab, n = ndi.label(yellow)
    labels = []
    for o in ocr:
        m = re.match(r'^(ST|EL)\s*([0-9IlO]+)', o['text'].replace(' ', ''))
        if m:
            labels.append((m.group(1), int(fix_digits(m.group(2))),
                           ((o['x'] + o['w'] / 2) * scale[0], (o['y'] + o['h'] / 2) * scale[1]), o['text']))
    shafts = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        part = lab == i
        area = part[sl].sum()
        if area < 150:
            continue
        ys, xs = np.nonzero(part)
        box = (xs.min(), ys.min(), xs.max(), ys.max())
        inside = [l for l in labels if box[0] - 4 <= l[2][0] <= box[2] + 4 and box[1] - 4 <= l[2][1] <= box[3] + 4]
        if any(re.search(r'-0?5\b', l[3]) for l in inside):
            continue  # floor 5 inset
        # Elevators carry a big white "E" glyph.
        bright = (rgb[sl].min(axis=2) > 235).sum() / max(1, (box[2] - box[0] + 1) * (box[3] - box[1] + 1))
        kind = inside[0][0] if inside else ('EL' if bright > 0.12 else 'ST')
        num = inside[0][1] if inside and inside[0][0] == kind else None
        shafts.append({'kind': kind, 'num': num, 'box': box, 'region': part,
                       'center': (float(xs.mean()), float(ys.mean()))})
    return shafts


def iou(a, b):
    x0, y0, x1, y1 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x1 - x0) * max(0, y1 - y0)
    area = lambda r: (r[2] - r[0]) * (r[3] - r[1])
    return inter / (area(a) + area(b) - inter or 1)


def floor1_graph():
    src = (ROOT / 'src/map-data.ts').read_text()
    nodes = {k: [int(x), int(y)] for k, x, y in re.findall(r"^\s+(n\d+): \[(\d+), (\d+)\]", src, re.M)}
    edges = re.findall(r"\['(n\d+)', '(n\d+)'\]", src)
    g = Graph()
    names = list(nodes)
    index = {k: i for i, k in enumerate(names)}
    for k in names:
        g.add(nodes[k])
    for a, b in edges:
        g.link(index[a], index[b])
    return g, names


def main(ocr_dir):
    ocr_dir = Path(ocr_dir)
    data = {}
    for floor in FLOORS:
        rgb, scale = load(floor)
        ocr = json.loads((ocr_dir / f'floor-{floor}.ocr.json').read_text())
        hall = hallway_mask(rgb)
        shafts = read_shafts(floor, rgb, ocr, scale)
        if floor == '1':
            g, base_names = floor1_graph()
            rooms = {}
        else:
            g = build_graph(hall)
            base_names = None
            rooms = read_rooms(floor, ocr, scale)
        rmask = room_mask(rgb)
        rlab, _ = ndi.label(rmask)
        rboxes = ndi.find_objects(rlab)
        doors = []
        for name, c in rooms.items():
            region = region_at(rmask, rlab, rboxes, c)
            door = None
            if region is not None and region.sum() < 40000:
                door = door_for(region, hall, c)
            if door is None:
                door = door_for(_point_mask(c), hall, c, reach=60)  # room inside a suite
            if door is not None:
                doors.append((('room', name), door))
        for i, s in enumerate(shafts):
            door = door_for(s['region'], hall, s['center'], reach=8)
            if door is None and floor == '1':
                # The first-floor hallway graph is hand drawn; use the shaft itself.
                door = (round(s['center'][0]), round(s['center'][1]))
            s['door'] = door
            if door is not None:
                doors.append((('shaft', i), door))
        attached = attach(g, doors)
        data[floor] = dict(g=g, rooms=rooms, shafts=shafts, doors=dict(doors), attached=attached,
                           base_names=base_names, hall=hall)
        print(floor, 'nodes', len(g.pts), 'edges', len(g.edges), 'rooms', len(rooms),
              'placed', sum(1 for k in attached if k[0] == 'room'), 'shafts', len(shafts),
              'attached shafts', sum(1 for k in attached if k[0] == 'shaft'))
    link_shafts(data)
    write(data)
    return data


def _point_mask(c):
    m = np.zeros((H, W), bool)
    m[int(c[1]), int(c[0])] = True
    return m


ORDER = ['B', '1', '2', '3', '4']


def link_shafts(data):
    """Same stairwell or elevator on neighbouring floors: same kind, overlapping or very close,
    and no conflicting number. Each connected run of floors becomes one shaft id."""
    shafts = [(f, s) for f in ORDER for s in data[f]['shafts'] if s['door'] is not None]
    parent = list(range(len(shafts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for lo, hi in zip(ORDER, ORDER[1:]):
        # The basement plan is drawn at a slightly different scale, so allow more slack.
        reach = 50 if lo == 'B' else 30
        pairs = []
        for i, (fa, a) in enumerate(shafts):
            for j, (fb, b) in enumerate(shafts):
                if fa != lo or fb != hi or a['kind'] != b['kind']:
                    continue
                if a['num'] and b['num'] and a['num'] != b['num']:
                    continue
                d = np.hypot(a['center'][0] - b['center'][0], a['center'][1] - b['center'][1])
                if d <= reach or iou(a['box'], b['box']) >= 0.25:
                    pairs.append((d, i, j))
        used = set()
        for d, i, j in sorted(pairs):
            if i in used or j in used:
                continue
            used |= {i, j}
            parent[find(i)] = find(j)
    groups = {}
    for i in range(len(shafts)):
        groups.setdefault(find(i), []).append(i)
    taken = set()
    for members in groups.values():
        if len(members) < 2:
            continue
        kind = shafts[members[0]][1]['kind']
        nums = [shafts[i][1]['num'] for i in members if shafts[i][1]['num'] and shafts[i][1]['num'] < 100]
        name = f'{kind}{max(set(nums), key=nums.count)}' if nums else f'{kind}x'
        base, n = name, 2
        while name in taken:
            name, n = f'{base}_{n}', n + 1
        taken.add(name)
        for i in members:
            shafts[i][1]['id'] = name


def node_name(d, i):
    return d['base_names'][i] if d['base_names'] and i < len(d['base_names']) else f'n{i}'


def write(data):
    out = ROOT / 'src/floors'
    out.mkdir(exist_ok=True)
    for f in ORDER:
        d = data[f]
        g = d['g']
        used = {i for e in g.edges for i in e} | set(d['attached'].values())
        lines = ['// Generated by scripts/gen_floors.py. Do not edit by hand.',
                 "import type { FloorData } from './types';", '']
        if f == '1':
            # Only the additions to the hand-drawn first floor graph.
            new = [i for i in sorted(used) if i >= len(d['base_names'])]
            base_edges = set()
            src = (ROOT / 'src/map-data.ts').read_text()
            idx = {k: i for i, k in enumerate(d['base_names'])}
            for a, b in re.findall(r"\['(n\d+)', '(n\d+)'\]", src):
                base_edges.add((min(idx[a], idx[b]), max(idx[a], idx[b])))
            edges = sorted(e for e in g.edges if e not in base_edges)
            name = lambda i: node_name(d, i) if i < len(d['base_names']) else f'x{i}'
        else:
            new = sorted(used)
            edges = sorted(g.edges)
            name = lambda i: f'n{i}'
        lines.append('export const floor: FloorData = {')
        lines.append('  nodes: {')
        for i in new:
            x, y = g.pts[i]
            lines.append(f'    {name(i)}: [{round(x)}, {round(y)}],')
        lines.append('  },')
        lines.append('  edges: [')
        for a, b in edges:
            lines.append(f"    ['{name(a)}', '{name(b)}'],")
        lines.append('  ],')
        lines.append('  places: {')
        for room in sorted(d['rooms']):
            key = ('room', room)
            if key in d['attached']:
                x, y = d['doors'][key]
                lines.append(f"    '{room}': ['{name(d['attached'][key])}', [{x}, {y}]],")
        lines.append('  },')
        lines.append('  shafts: {')
        for i, s in enumerate(d['shafts']):
            key = ('shaft', i)
            if s.get('id') and key in d['attached']:  # shafts on one floor only are skipped
                kind = 'stairs' if s['kind'] == 'ST' else 'elevator'
                lines.append(f"    {s['id']}: {{ kind: '{kind}', node: '{name(d['attached'][key])}' }},")
        lines.append('  },')
        lines.append('};')
        (out / f'floor-{f}.ts').write_text('\n'.join(lines) + '\n')


if __name__ == '__main__':
    main(sys.argv[1])
