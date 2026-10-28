"""Add the rooms that scripts/gen_floors.py misses, without touching the existing hallway graphs.

gen_floors.py drops a room when no hallway touches its outline (rooms inside suites, and restrooms,
whose blue fill it reads as wall), and OCR never reads labels hidden under the department names and
wing letters. Hallway node ids are referenced by src/data/photoStations.ts and Firestore, so instead
of regenerating the floors this script hangs each room below off the existing graph with new nodes
and writes src/floors/extra-rooms.ts.

  pip install numpy pillow scipy scikit-image
  python scripts/add_rooms.py
"""

import re
import sys
from pathlib import Path

import numpy as np
from skimage.draw import line
from skimage.graph import MCP_Geometric

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_floors as gf  # noqa: E402

ROOT = gf.ROOT
# Room label centres in the 1948 x 1904 map space, checked by eye against the floor plans.
ROOMS = {
    'B': {
        'EB11': (446, 434), 'EB16': (608, 315), 'EB40': (587, 55), 'FB12': (1521, 1292),
        'FB33': (1298, 1756), 'FB34': (1633, 1814), 'FB35': (1330, 1825), 'FB38': (1506, 1824),
        'KB24': (1310, 217), 'LB13': (1290, 970), 'LB15': (1290, 925),
    },
    'G': {
        'AG25': (406, 1644), 'AG27': (479, 1684), 'AG29': (445, 1684), 'AG31': (641, 1675),
        'AG62': (162, 1811), 'AG64': (126, 1811), 'AG73': (361, 1551), 'AG74': (267, 1505),
        'AG75': (309, 1551), 'AG78': (223, 1551), 'AG81': (290, 1377), 'BG66': (317, 1053),
        'BG76': (160, 1058), 'CG20': (293, 682), 'CG24': (280, 770), 'DG37': (348, 301),
        'EG26A': (599, 268), 'EG31': (481, 209), 'EG35': (665, 220), 'EG47': (432, 207),
        'EG51': (370, 226), 'EG74': (153, 63), 'EG78': (122, 63), 'EG80': (59, 63),
        'FG21': (1304, 1691), 'FG45': (1590, 1804), 'FG47': (1622, 1804), 'FG49': (1653, 1804),
        'FG53': (1589, 1872), 'FG54': (1704, 1749), 'FG56': (1740, 1749), 'FG87': (1652, 1383),
        'FG88': (1684, 1396), 'FG89': (1713, 1383), 'FG90': (1758, 1383), 'FG91': (1805, 1383),
        'FG95': (1913, 1414), 'GG37': (1878, 1311), 'HG10': (1678, 630), 'HG20': (1779, 762),
        'HG24': (1868, 762), 'HG28': (1868, 631), 'JG29': (1562, 310), 'JG90': (1880, 519),
        'JG92': (1866, 468), 'KG25': (1470, 209), 'KG33': (1298, 223), 'KG38': (1444, 52),
        'KG39': (1515, 209), 'KG40': (1483, 52), 'KG44': (1631, 71), 'KG50': (1709, 41),
        'KG60': (1786, 44), 'KG62': (1825, 44), 'KG65': (1914, 227), 'KG66': (1864, 44),
        'LG54': (1293, 1330), 'LG67': (956, 1148), 'LG71': (812, 1119), 'LG78': (644, 1327),
        'LG79': (630, 1189), 'LG85': (682, 1142), 'MG31': (603, 752), 'MG47': (890, 976),
        'MG49': (984, 1010), 'MG69': (1212, 758), 'MG72': (959, 629), 'MG85': (1349, 754),
        'MG89': (1367, 832), 'NG17': (733, 448), 'NG19': (766, 448), 'NG21': (800, 448),
        'NG57': (1068, 34), 'NG64': (1210, 360), 'NG66': (1248, 360), 'NG75': (1108, 448),
        'NG77': (1069, 448), 'NG79': (1030, 448), 'NG86': (1067, 330), 'NG87': (962, 332),
        'NG89': (962, 264),
    },
    '1': {
        'K125': (1471, 202),
        'A141': (443, 1707), 'A177': (254, 1463), 'A181': (293, 1390), 'A182': (261, 1390),
        'E131': (477, 201), 'E134': (680, 40), 'E147': (433, 201), 'F128': (1466, 1703),
        'F169': (1832, 1837), 'G115': (1473, 1164), 'H114': (1478, 753), 'K137': (1495, 163),
        'K139': (1517, 218), 'L155': (1282, 1138), 'L157': (1186, 1171), 'L159': (1095, 1161),
        'L163': (974, 1111), 'L165': (974, 923), 'L165A': (848, 816), 'L165B': (1097, 813),
        'L167': (851, 1161), 'L169': (768, 1174), 'L171': (657, 1022), 'L175': (659, 1139),
        'L185': (549, 1140), 'M115': (554, 856), 'M115A': (555, 825), 'M120': (464, 755),
        'M129': (584, 706), 'M131': (600, 757), 'M135': (721, 760), 'M136': (768, 617),
        'M138': (713, 681), 'M140': (769, 680), 'M142': (879, 678), 'M161': (1221, 761),
        'M173': (1348, 751), 'M186': (1453, 753), 'M193': (1286, 840), 'M195': (1388, 851),
    },
    '2': {
        'A236': (546, 1835), 'A271': (389, 1539), 'A274': (280, 1478), 'A275': (298, 1585),
        'A277': (207, 1584), 'A279': (127, 1585), 'A280': (130, 1478), 'A288': (112, 1375),
        'A290': (44, 1393), 'A292': (44, 1440), 'A293': (44, 1482), 'A294': (44, 1525),
        'A296': (44, 1583), 'B213': (466, 1198), 'B219': (413, 1198), 'B220': (413, 1260),
        'B224A': (357, 1325), 'B226': (280, 1310), 'B228': (269, 1263), 'B229': (269, 1203),
        'B231': (240, 1213), 'B233': (245, 1148), 'B240': (46, 1239), 'B241': (56, 1195),
        'B242': (69, 1292), 'B244': (69, 1259), 'B245': (75, 1214), 'B270': (266, 1031),
        'B276': (169, 1074), 'B277': (168, 1038), 'C210': (464, 734), 'C216': (382, 776),
        'C218': (414, 736), 'C224': (282, 715), 'C226': (319, 759), 'C228': (281, 774),
        'D211': (266, 334), 'E247': (439, 204), 'E278': (122, 65), 'E284': (46, 65),
        'F281A': (1678, 1637), 'F290': (1908, 1607), 'F292': (1902, 1562), 'F294': (1902, 1521),
        'F296': (1902, 1478), 'F297A': (1902, 1367), 'F298': (1902, 1435), 'F299': (1902, 1395),
        'G225': (1604, 1269), 'G237': (1766, 1268), 'G239': (1884, 1313), 'H232': (1747, 647),
        'H240': (1887, 631), 'J216A': (1734, 540), 'J216B': (1762, 540), 'K232': (1271, 42),
        'K239': (1520, 207), 'K260': (1887, 41), 'K265': (1914, 228), 'L211': (1225, 1019),
        'L217': (1145, 931), 'L257': (1033, 1146), 'L263': (970, 1131), 'L265': (967, 933),
        'L266': (880, 1279), 'L268': (820, 1279), 'L269': (721, 1173), 'L270': (783, 1304),
        'L272': (763, 1267), 'L274': (711, 1279), 'L275': (801, 1146), 'L277': (641, 1146),
        'L281': (599, 1168), 'L283': (562, 1152), 'L289': (599, 1087), 'M248': (955, 624),
        'M250': (993, 625), 'M275': (1351, 752), 'M286': (1453, 752),
    },
    '3': {
        'M373': (1347, 751),
        'K325': (1471, 201),
        'A332': (588, 1805), 'A333': (460, 1795), 'A335': (521, 1808), 'A382': (261, 1390),
        'B376': (162, 1052), 'E312': (617, 436), 'E316': (617, 391), 'E318': (617, 343),
        'E321': (425, 341), 'E334': (696, 44), 'E336': (655, 44), 'E347': (438, 200),
        'E349': (477, 200), 'E352': (465, 44), 'E354': (426, 44), 'E382': (75, 44),
        'E384': (37, 44), 'F331': (1363, 1799), 'F332': (1493, 1799), 'F333': (1351, 1742),
        'F335': (1351, 1692), 'F373': (1562, 1397), 'F375': (1627, 1567), 'F385': (1673, 1388),
        'F393': (1907, 1609), 'F397A': (1907, 1368), 'F399': (1900, 1400), 'J317': (1721, 319),
        'K339': (1519, 201), 'K350': (1598, 53), 'K351': (1597, 199), 'K353': (1622, 199),
        'K365': (1911, 227), 'L319': (1369, 1136), 'L320': (1528, 1139), 'L322': (1454, 1165),
        'L325': (1475, 1165), 'L326': (1508, 1171), 'L330': (1539, 1173), 'L340': (1531, 1342),
        'L362': (1023, 1317), 'L366': (957, 1317), 'L368': (890, 1317), 'L369': (793, 1155),
        'L374': (710, 1317), 'L377': (624, 1141), 'L383': (581, 1135), 'M331': (598, 748),
        'M336': (691, 609), 'M344': (928, 628), 'M347': (1049, 966), 'M352': (980, 592),
        'M360': (1135, 609), 'M362': (1052, 608),
    },
    '4': {
        'A476': (239, 1566), 'A478': (236, 1473), 'A481': (294, 1390), 'A490A': (35, 1359), 'A499': (199, 1589),
        'B475': (196, 844), 'B476': (165, 1052), 'B477': (165, 1012), 'F476A': (1667, 1346),
        'F493': (1898, 1594), 'F495': (1891, 1551), 'F499': (1889, 1382), 'J416': (1684, 274),
        'J419': (1754, 357), 'L451': (1256, 1148), 'L479': (661, 1148), 'L482': (465, 1213),
        'M422': (542, 656), 'M423': (578, 609), 'M428': (447, 609), 'M430': (655, 609),
        'M432': (614, 667), 'M439': (746, 756),
    },}


def read_floor(floor):
    files = ['src/map-data.ts', 'src/floors/floor-1.ts'] if floor == '1' else [f'src/floors/floor-{floor}.ts']
    nodes, edges, places, shafts = {}, [], set(), set()
    for f in files:
        src = (ROOT / f).read_text()
        nodes.update({k: (int(x), int(y)) for k, x, y in re.findall(r"^\s+(\w+): \[(-?\d+), (-?\d+)\],$", src, re.M)})
        edges += re.findall(r"\['(\w+)', '(\w+)'\]", src)
        shafts |= set(re.findall(r"node: '(\w+)'", src))
        if f != 'src/floors/floor-1.ts':  # the first floor's places live in map-data.ts
            places |= set(re.findall(r"^\s+'?([\w-]+)'?: \['\w+', \[", src, re.M))
    return nodes, edges, places, shafts


def routable(edges, shafts):
    """Edges of the pieces of this floor's graph that lead somewhere: the largest piece, and any
    piece with stairs or an elevator. Small stubs such as exits are left out."""
    parent = {}

    def find(n):
        while parent.setdefault(n, n) != n:
            n = parent[n]
        return n
    for a, b in edges:
        parent[find(a)] = find(b)
    roots = [find(a) for a, _ in edges]
    keep = {max(set(roots), key=roots.count)} | {find(n) for n in shafts if n in parent}
    return [e for e, r in zip(edges, roots) if r in keep]


def nearest_edge(nodes, edges, p):
    best = None
    for a, b in edges:
        A, B = np.array(nodes[a], float), np.array(nodes[b], float)
        d = B - A
        t = float(np.clip(np.dot(np.array(p) - A, d) / (np.dot(d, d) or 1), 0, 1))
        q = A + t * d
        dist = float(np.hypot(*(q - np.array(p))))
        if best is None or dist < best[0]:
            best = (dist, a, b, q)
    return best[1:]


def walkable(rgb, nodes, edges):
    """Cost grid for walking inside the building, and the graph's pixels as targets.
    Room dividers are open; walls, courtyards and outside are not."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    wall = (r < 110) & (g < 80) & (b - r > 40)
    outside = (rgb.min(axis=2) >= 236) & (rgb.max(axis=2) <= 248)
    cost = np.where(wall | outside, np.inf, 1.0)
    target = np.zeros(cost.shape, bool)
    for a, b2 in edges:
        (x0, y0), (x1, y1) = nodes[a], nodes[b2]
        rr, cc = line(y0, x0, y1, x1)
        ok = (rr >= 0) & (rr < cost.shape[0]) & (cc >= 0) & (cc < cost.shape[1])
        target[rr[ok], cc[ok]] = True
    cost[target] = 1.0
    return cost, target


def walk_to_graph(cost, target, hall, start):
    """Shortest in-building walk from a room label to the graph: (door, point on the graph)."""
    x, y = start
    cost = cost.copy()
    cost[y, x] = 1.0
    mcp = MCP_Geometric(cost)
    costs, _ = mcp.find_costs([(y, x)], ends=list(zip(*np.nonzero(target))), find_all_ends=False)
    ys, xs = np.nonzero(target & np.isfinite(costs))
    i = int(np.argmin(costs[ys, xs]))
    path = mcp.traceback((ys[i], xs[i]))
    door = next(((px, py) for py, px in path if hall[py, px]), (xs[i], ys[i]))
    return (int(door[0]), int(door[1])), (int(xs[i]), int(ys[i]))


def main():
    out = ['// Generated by scripts/add_rooms.py. Do not edit by hand.',
           "import type { FloorData } from './types';", '',
           "export const extraRooms: Record<string, Pick<FloorData, 'nodes' | 'edges' | 'places'>> = {"]
    for floor, rooms in ROOMS.items():
        nodes, edges, existing, shafts = read_floor(floor)
        edges = routable(edges, shafts)
        rgb, _ = gf.load(floor)
        hall = gf.hallway_mask(rgb)
        cost, target = walkable(rgb, nodes, edges)
        new_nodes, new_edges, places = {}, [], {}
        for name, (x, y) in sorted(rooms.items()):
            if name in existing:
                print(f'{floor} {name}: already on the map, skipped')
                continue
            door, hit = walk_to_graph(cost, target, hall, (x, y))
            a, b, q = nearest_edge(nodes, edges, hit)
            q = (round(q[0]), round(q[1]))
            near = min((a, b), key=lambda n: np.hypot(nodes[n][0] - q[0], nodes[n][1] - q[1]))
            if np.hypot(nodes[near][0] - q[0], nodes[near][1] - q[1]) < 4:
                node = near
            else:
                node = f'r_{name}'  # named after the room so ids stay put when rooms are added
                new_nodes[node] = q
                new_edges += [(a, node), (node, b)]
            places[name] = (node, door)
        out.append(f"  '{floor}': {{")
        out.append('    nodes: {')
        out += [f'      {k}: [{x}, {y}],' for k, (x, y) in new_nodes.items()]
        out.append('    },')
        out.append('    edges: [')
        out += [f"      ['{a}', '{b}']," for a, b in new_edges]
        out.append('    ],')
        out.append('    places: {')
        out += [f"      '{k}': ['{n}', [{x}, {y}]]," for k, (n, (x, y)) in places.items()]
        out.append('    },')
        out.append('  },')
        print(floor, 'rooms', len(places), 'new nodes', len(new_nodes))
    out.append('};')
    (ROOT / 'src/floors/extra-rooms.ts').write_text('\n'.join(out) + '\n')


if __name__ == '__main__':
    main()
