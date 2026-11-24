import csv
import json
import re
import unittest
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
G = json.loads((ROOT/'data/graph.json').read_text())
N = {n['id']:n for n in G['nodes']}
E = G['edges']
EXPS = [n for n in G['nodes'] if n['type']=='Experiment']

class EvidenceDataTests(unittest.TestCase):
    def test_integrity(self):
        self.assertEqual(len(N),len(G['nodes']))
        self.assertEqual(len({e['id'] for e in E}),len(E))
        for e in E:
            self.assertIn(e['source'],N);self.assertIn(e['target'],N)
        for n in EXPS:
            incoming=[e for e in E if e['target']==n['id'] and e['type']=='REPORTS_EXPERIMENT']
            self.assertEqual(len(incoming),1)
            self.assertEqual(incoming[0]['source'],n['properties']['workId'])

    def test_sources_and_scope_are_explicit(self):
        expected={'include':60,'related_learning':19,'defer_pretrained':12,'evaluation_only':9,'nonrobotic':5,'unclear':1}
        self.assertEqual(Counter(n['properties']['decision'] for n in EXPS),expected)
        for n in EXPS:
            p=n['properties']
            for key in ['sourceUrl','locator','reviewedAt','scopeReason','setting','objective','policyInitialization']:
                self.assertTrue(p[key],(n['id'],key))
            self.assertRegex(p['sourceUrl'],r'^https?://')
            self.assertTrue(set(p['levels'])<={'Rating','Preference','Action','Goal'})
        # Machine paths from the working evidence ledger must never enter public data.
        self.assertNotRegex(json.dumps(G),r'/home/|/Users/|Zotero/storage')

    def test_known_errata(self):
        for wid in ['work:hiranaka_primitive_2023','work:zhang_dual_2023']:
            forms={e['target'] for e in E if e['source']==wid and e['type']=='HAS_FORM'}
            self.assertEqual(forms,{'form:binary'})
        self.assertIn('Binary',N['experiment:S002-2']['properties']['feedback'])
        self.assertNotIn('ternary',N['row:H10']['properties']['form'].lower())
        self.assertIn('may abstain',N['row:H11']['properties']['form'])
        self.assertNotIn('asynchronous',N['experiment:WEB-SOLE-R1-physical']['properties']['integration'])
        self.assertNotIn('No online learning',N['detail:fm-18']['label'])
        self.assertIn('18 to 14',N['experiment:P021-1']['properties']['result'])
        self.assertEqual(N['experiment:P079-1']['properties']['decision'],'evaluation_only')

    def test_exports_match_canonical_graph(self):
        for filename,items in [('nodes.csv',G['nodes']),('edges.csv',E)]:
            with (ROOT/'data'/filename).open() as f: rows=list(csv.DictReader(f))
            self.assertEqual({r['id'] for r in rows},{r['id'] for r in items})
        tree=ET.parse(ROOT/'data/graph.graphml')
        ns={'g':'http://graphml.graphdrawing.org/xmlns'}
        self.assertEqual(len(tree.findall('.//g:node',ns)),len(N))
        self.assertEqual(len(tree.findall('.//g:edge',ns)),len(E))
        html=(ROOT/'index.html').read_text()
        embedded=json.loads(re.search(r'<script type="application/json" id="graph-data">(.*?)</script>',html,re.S)[1])
        self.assertEqual(sum(n['t']=='Experiment' for n in embedded['nodes']),106)
        self.assertEqual(embedded['meta']['updated'],'2026-11-24')
        for n in embedded['nodes']:
            if n['t']=='Experiment':self.assertEqual(n['p'],N[n['id']]['properties'])
        for url in re.findall(r'(?:src|href)="([^"#]+)"',html):
            if not re.match(r'https?://',url):self.assertTrue((ROOT/url).is_file(),url)

if __name__=='__main__':unittest.main()
