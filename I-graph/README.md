# IRL Survey Graph

Interactive graph of the works, feedback taxonomy, robots and open problems reviewed in the survey
*Interactive Reinforcement Learning: A Unified Survey of Human and Foundation-Model Feedback*.

**Live site:** https://USERNAME.github.io/irl-survey-graph/ (replace `USERNAME` once Pages is on)

## What is in the graph

| Node type | What it is |
|---|---|
| Work | a reviewed paper (human or foundation-model teacher) |
| Feedback level | rating, preference (evaluative); action, goal (informative) |
| Feedback form, Human channel, Explicit / implicit | how the feedback is given |
| Foundation model, Model input, Online / offline labels | the model that gives the feedback |
| Integration method | how the learner uses the feedback |
| Task or benchmark, Physical robot | where the method was tested |
| Open problem, Detailed problem | the challenges of Section IX |

Links copied from a table row shared by several works are dashed: the fact may hold for only some of them.

## Use the data

Everything is in `data/`:

- `graph.json`: nodes and edges with all properties (the source of truth)
- `nodes.csv`, `edges.csv`: one row per node / edge, properties as JSON
- `import.cypher`: load into Neo4j (Neo4j Browser, Aura Free or `cypher-shell -f data/import.cypher`)
- `graph.graphml`: open in Gephi, yEd or NetworkX

Example Neo4j query, works that learned online on a physical robot:

```cypher
MATCH (w:Work)-[r:RAN_ON_ROBOT]->(rb:Robot)
WHERE r.online = true
RETURN w.label, rb.label;
```

## Update the site

1. Edit `data/graph.json` (and `data/positions.json` for new nodes).
2. Run `python scripts/build.py` (Python 3, no packages needed).
3. Commit and push; GitHub Pages republishes in about a minute.

The page has no third-party requests: Cytoscape.js and the IBM Plex fonts are in `vendor/`,
and the graph data is inlined in `index.html`, so the page also opens from disk.

## Cite

See `CITATION.cff` (GitHub shows a "Cite this repository" button).

## Licenses

- Code and data: to be chosen by the author (suggested: MIT for code, CC BY 4.0 for data).
- Cytoscape.js: MIT (`vendor/LICENSE-cytoscape.txt`).
- IBM Plex: SIL Open Font License 1.1 (`vendor/fonts/LICENSE-IBM-Plex.txt`).
