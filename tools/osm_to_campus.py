"""
Convert an OpenStreetMap (Overpass) export of a campus into:
  1. GeoJSON of building footprints   (backend/geodata/<name>_buildings.geojson)
  2. SQL to load them into Supabase    (backend/supabase/seed_<name>_buildings.sql)

Usage (from the project root):
  python3 tools/osm_to_campus.py <overpass.json> <slug> ["Full name" SHORT "Area"]
  e.g.
  python3 tools/osm_to_campus.py backend/geodata/raw/unilag_campus_osm.json unilag \
      "University of Lagos" UNILAG "Akoka, Yaba"

With the campus name, the SQL also creates/updates the row in public.campuses
(outline and centre from the campus way in the export) and links every
building to it. Fetch the export with an Overpass query like:
  way(<campus way id>)->.campus; .campus out geom;
  .campus map_to_area->.c; (way[building](area.c); relation[building](area.c);); out geom;

Data source: © OpenStreetMap contributors, available under the Open Database
License (ODbL). Keep that attribution wherever the data is shown.
"""
import json
import math
import sys

src, slug = sys.argv[1], sys.argv[2]
campus_meta = sys.argv[3:6] if len(sys.argv) >= 6 else None  # name, short name, area
data = json.load(open(src))
elements = data['elements']


def closed(ring):
    return len(ring) >= 4 and ring[0] == ring[-1]


def join_rings(segments):
    """Join way segments (lists of [lon, lat]) into closed rings."""
    segs = [s[:] for s in segments if len(s) >= 2]
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while not closed(ring) and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += list(reversed(s))[1:]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = list(reversed(s))[:-1] + ring
                else:
                    continue
                segs.pop(i)
                changed = True
                break
        if closed(ring):
            rings.append(ring)
    return rings


def area_m2(ring):
    lat0 = math.radians(ring[0][1])
    r = 6371000
    xs = [math.radians(p[0]) * r * math.cos(lat0) for p in ring]
    ys = [math.radians(p[1]) * r for p in ring]
    return abs(sum(xs[i] * ys[i + 1] - xs[i + 1] * ys[i] for i in range(len(ring) - 1))) / 2


def category(tags):
    name = (tags.get('name') or '').lower()
    b = tags.get('building', '')
    if b == 'construction':
        return 'Under construction'
    if any(w in name for w in ('hostel', 'house', 'hall', 'pod', 'living')):
        return 'Residential'
    if 'museum' in name:
        return 'Culture'
    if "students' centre" in name or 'student centre' in name:
        return 'Student services'
    if 'study' in name or b in ('school', 'university', 'college'):
        return 'Academic'
    if 'cooperative' in name:
        return 'Shops and food'
    return 'Building'


# The campus outline: the university/college way in the export.
campus_ring = None
for e in elements:
    t = e.get('tags', {})
    if e['type'] == 'way' and t.get('amenity') in ('university', 'college') and e.get('geometry'):
        ring = [[round(p['lon'], 7), round(p['lat'], 7)] for p in e['geometry']]
        if closed(ring):
            campus_ring, campus_osm = ring, f'way/{e["id"]}'
            break

features = []
for e in elements:
    tags = e.get('tags', {})
    if 'building' not in tags:
        continue
    if e['type'] == 'way':
        ring = [[p['lon'], p['lat']] for p in e.get('geometry', [])]
        rings = [ring] if closed(ring) else []
    elif e['type'] == 'relation':
        outers = [[[p['lon'], p['lat']] for p in m.get('geometry', [])]
                  for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
        rings = join_rings(outers)
    else:
        continue
    if not rings:
        print(f'skip {e["type"]}/{e["id"]}: no closed outline', file=sys.stderr)
        continue
    outer = max(rings, key=area_m2)  # largest outer ring is the footprint
    levels = tags.get('building:levels')
    features.append({
        'type': 'Feature',
        'properties': {
            'osm_id': f'{e["type"]}/{e["id"]}',
            'name': tags.get('name'),
            'category': category(tags),
            # OSM sometimes says 0 floors; treat anything below 1 as unknown.
            'levels': int(levels) if levels and levels.isdigit() and int(levels) >= 1 else None,
            'area_m2': round(area_m2(outer)),
        },
        'geometry': {'type': 'Polygon', 'coordinates': [[[round(x, 7), round(y, 7)] for x, y in outer]]},
    })

features.sort(key=lambda f: (f['properties']['name'] is None, f['properties']['name'] or '', f['properties']['osm_id']))
geojson = {
    'type': 'FeatureCollection',
    'attribution': '© OpenStreetMap contributors (ODbL)',
    'features': features,
}
gj_path = f'backend/geodata/{slug}_buildings.geojson'
json.dump(geojson, open(gj_path, 'w'), indent=1)


def q(s):
    return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"


campus_sql = ''
campus_col, campus_val = '', ''
if campus_meta:
    name, short, area = campus_meta
    if campus_ring:
        pts = campus_ring[:-1]
        lon = sum(p[0] for p in pts) / len(pts)
        lat = sum(p[1] for p in pts) / len(pts)
        boundary = q(json.dumps({'type': 'Polygon', 'coordinates': [campus_ring]}, separators=(',', ':'))) + '::jsonb'
        osm = q(campus_osm)
    else:  # no outline: centre of the buildings
        cs = [c for f in features for c in f['geometry']['coordinates'][0]]
        lon = sum(c[0] for c in cs) / len(cs)
        lat = sum(c[1] for c in cs) / len(cs)
        boundary, osm = 'null', 'null'
    campus_sql = (
        'insert into public.campuses (slug, name, short_name, area, osm_id, centre_lat, centre_lon, boundary)\n'
        f'values ({q(slug)}, {q(name)}, {q(short)}, {q(area)}, {osm}, {lat:.6f}, {lon:.6f}, {boundary})\n'
        'on conflict (slug) do update set name = excluded.name, short_name = excluded.short_name, area = excluded.area,\n'
        '  osm_id = excluded.osm_id, centre_lat = excluded.centre_lat, centre_lon = excluded.centre_lon, boundary = excluded.boundary;\n\n'
    )
    campus_col = ', campus_id'
    campus_val = f", (select id from public.campuses where slug = {q(slug)})"

rows = []
for f in features:
    pr = f['properties']
    rows.append(
        f"  ({q(pr['osm_id'])}, {q(pr['name'])}, {q(pr['category'])}, "
        f"{pr['levels'] if pr['levels'] is not None else 'null'}, "
        f"{q(json.dumps(f['geometry'], separators=(',', ':')))}::jsonb{campus_val})"
    )
header = (
    f'-- Building footprints for {slug.upper()} from OpenStreetMap.\n'
    '-- © OpenStreetMap contributors, Open Database License (ODbL).\n'
    '-- Generated by tools/osm_to_campus.py. Safe to re-run: existing rows are updated by osm_id.\n'
    + campus_sql
    + f'insert into public.campus_buildings (osm_id, name, category, levels, footprint{campus_col}) values\n'
)
sql = header + ',\n'.join(rows) + f"""
on conflict (osm_id) do update set{' campus_id = excluded.campus_id,' if campus_meta else ''}
  name = coalesce(public.campus_buildings.name, excluded.name),
  category = excluded.category,
  levels = coalesce(public.campus_buildings.levels, excluded.levels),
  footprint = excluded.footprint,
  updated_at = now();

notify pgrst, 'reload schema';
"""
sql_path = f'backend/supabase/seed_{slug}_buildings.sql'
open(sql_path, 'w').write(sql)

named = sum(1 for f in features if f['properties']['name'])
print(f'{len(features)} buildings ({named} named) -> {gj_path}, {sql_path}')
