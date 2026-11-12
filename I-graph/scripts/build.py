"""Rebuild the site from data/graph.json.

Run from the repository root:  python scripts/build.py
Writes index.html (graph data inlined, so the page also works when opened from disk)
and the downloads in data/: nodes.csv, edges.csv, import.cypher, graph.graphml.
"""
import csv
import json
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
G = json.loads((ROOT / 'data/graph.json').read_text(encoding='utf-8'))
POS = json.loads((ROOT / 'data/positions.json').read_text(encoding='utf-8'))
SECTIONS = G['meta']['sections']

# ---------- index.html ----------
KEEP_NODE_PROPS = {
    'Work': ['key', 'short', 'authorYear', 'year', 'title', 'teacher', 'scope', 'discussedIn', 'teachersNote', 'note'],
    'Challenge': ['teacher', 'order', 'statement', 'openQuestion'],
    'DetailedChallenge': ['teacher', 'stage', 'problem', 'openQuestion'],
}
KEEP_EDGE_PROPS = ['asListed', 'scope', 'use', 'online', 'teachers', 'role', 'adaptation', 'timing', 'how', 'certainty',
                   'evidence', 'where', 'modeling', 'conversion', 'setting', 'citations', 'term', 'relation', 'basis']
nodes = []
for n in G['nodes']:
    if n['type'] == 'TableRow':
        continue
    p = n['properties']
    keep = KEEP_NODE_PROPS.get(n['type'])
    props = {k: p[k] for k in (keep or p.keys()) if k in p}
    if 'discussedIn' in props:
        props['discussedIn'] = [SECTIONS.get(s, {}).get('title', s) for s in props['discussedIn']]
    x, y = POS[n['id']]
    nodes.append({'id': n['id'], 't': n['type'], 'l': n['label'], 'p': props, 'x': x, 'y': y})
ids = {n['id'] for n in nodes}
edges = []
for e in G['edges']:
    if e['source'] in ids and e['target'] in ids:
        p = {k: e['properties'][k] for k in KEEP_EDGE_PROPS if k in e['properties']}
        if isinstance(p.get('basis'), str) and len(p['basis']) > 160:
            p['basis'] = p['basis'][:157] + '...'
        edges.append({'id': e['id'], 's': e['source'], 't': e['target'], 'r': e['type'], 'p': p})
blob = json.dumps({'nodes': nodes, 'edges': edges}, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
tpl = (ROOT / 'src/template.html').read_text(encoding='utf-8')
(ROOT / 'index.html').write_text(tpl.replace('__GRAPH__', blob), encoding='utf-8')


# ---------- downloads ----------
def flat(v):
    return '; '.join(map(str, v)) if isinstance(v, list) else v


with open(ROOT / 'data/nodes.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['id', 'type', 'label', 'properties_json'])
    for n in G['nodes']:
        w.writerow([n['id'], n['type'], n['label'], json.dumps(n['properties'], ensure_ascii=False)])
with open(ROOT / 'data/edges.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['id', 'source', 'target', 'type', 'properties_json'])
    for e in G['edges']:
        w.writerow([e['id'], e['source'], e['target'], e['type'], json.dumps(e['properties'], ensure_ascii=False)])


def cy_val(v):
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return '[' + ', '.join(cy_val(str(x)) for x in v) + ']'
    if isinstance(v, dict):
        v = json.dumps(v, ensure_ascii=False)
    return "'" + str(v).replace('\\', '\\\\').replace("'", "\\'") + "'"


def cy_props(d):
    items = [f'`{k}`: {cy_val(v)}' for k, v in d.items() if v is not None]
    return '{' + ', '.join(items) + '}'


lines = ['// Load the survey graph into Neo4j: paste this file into Neo4j Browser or run it with cypher-shell.',
         'CREATE CONSTRAINT node_id IF NOT EXISTS FOR (n:Node) REQUIRE n.id IS UNIQUE;']
for n in G['nodes']:
    props = {'id': n['id'], 'label': n['label'], **n['properties']}
    lines.append(f"CREATE (:Node:{n['type']} {cy_props(props)});")
for e in G['edges']:
    props = {'id': e['id'], **e['properties']}
    lines.append(f"MATCH (a:Node {{id: {cy_val(e['source'])}}}), (b:Node {{id: {cy_val(e['target'])}}}) "
                 f"CREATE (a)-[:{e['type']} {cy_props(props)}]->(b);")
(ROOT / 'data/import.cypher').write_text('\n'.join(lines) + '\n', encoding='utf-8')

g = ['<?xml version="1.0" encoding="UTF-8"?>',
     '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
     '<key id="type" for="all" attr.name="type" attr.type="string"/>',
     '<key id="label" for="node" attr.name="label" attr.type="string"/>',
     '<key id="props" for="all" attr.name="properties_json" attr.type="string"/>',
     '<graph id="irl-survey" edgedefault="directed">']
for n in G['nodes']:
    g.append(f'<node id="{escape(n["id"])}"><data key="type">{escape(n["type"])}</data><data key="label">{escape(n["label"])}</data>'
             f'<data key="props">{escape(json.dumps(n["properties"], ensure_ascii=False))}</data></node>')
for e in G['edges']:
    g.append(f'<edge id="{escape(e["id"])}" source="{escape(e["source"])}" target="{escape(e["target"])}"><data key="type">{escape(e["type"])}</data>'
             f'<data key="props">{escape(json.dumps(e["properties"], ensure_ascii=False))}</data></edge>')
g += ['</graph>', '</graphml>']
(ROOT / 'data/graph.graphml').write_text('\n'.join(g) + '\n', encoding='utf-8')
print(f'index.html: {len(nodes)} nodes, {len(edges)} links; downloads: {len(G["nodes"])} nodes, {len(G["edges"])} edges')
