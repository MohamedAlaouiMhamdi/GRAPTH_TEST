# IRL Survey Graph

Explore papers, feedback categories, methodological connections and robotics experiments from *Interactive Reinforcement Learning: A Unified Survey of Human and Foundation-Model Feedback*.

## Explore the evidence

- **Overview** retains the original method and taxonomy graph. A paper can have several feedback types. Human-feedback methods may include artificial-teacher controls; inspect individual experiments for the actual provider.
- **Robotics evidence** shows each reviewed experimental setting or learning stage separately. The table and graph use the same filters. Select a record for the primary source, section/table locator, learning objective, policy initialization, comparator, result, evaluation, extra support and limitations.
- **Study scope** defaults to **New-policy RL**. Related interactive learning, feedback evaluation, pretrained-policy improvement, unresolved cases and symbolic/nonrobotic tasks have separate filters. Context records are preserved, not counted as retained task-RL evidence.
- **Learning setting** separates simulation, transfer to hardware, offline RL from recorded robot data and policy learning through physical interaction. Qualified physical-teaching cases and other learning objectives remain explicitly labelled.
- **Feedback source** distinguishes people, foundation models, oracle/simulated teachers and uncertain providers. Multiple providers may describe separate conditions within one record; read its detailed description. Recorded human labels retain human origin.
- **Method relationships** distinguishes stated `BUILDS_ON` links from `SHARES_METHOD` and `COMPARED_WITH`. Directed builds-on paths follow the extension toward its predecessor. General connection paths show associations, not influence or superior performance. Paths respect the current view and uncertain-link filter.

The shared-row switch applies to graph edges, derived table facts, details and paths. A dashed edge or `?` marks a property inherited from a grouped survey-table row; it is not confirmed for every paper in that row. Legacy `HARDWARE_REPORTED` links are associations only: the experiment record establishes whether and how learning occurred.

## Scope and provenance

The 24 November 2026 update contains **106 experimental-setting/stage records from 69 sources**. Of these, **60 records from 46 sources** are retained for new-policy RL; the other records document related learning (19), pretrained-policy improvement deferred from the current scope (12), feedback evaluation (9), symbolic/nonrobotic tasks (5), and an unresolved case (1).

These are counts within a targeted reviewed collection. They are not counts of independent studies, seeds, trials, or all relevant papers. Multiple settings from one paper may share data. Thirteen retained records carry **Real-robot training**, and two further retained physical-teaching records explicitly qualify the evaluation setting. Do not combine these into an unqualified hardware-training total.

The scope concerns feedback used to learn a new robotic task policy. A pretrained visual encoder or reward model does not itself mean that the action policy was pretrained. Demonstrations in replay do not establish actor pretraining. Offline training, subsequent adaptation and steering around a pretrained actor are separate records where applicable.

Primary URLs and source locations are attached to each experiment. Numerical outcomes retain their comparators and evaluation caveats; missing initialization or trial details are not invented. The older method graph and challenge text have not all received a new primary-paper audit. Their provenance remains visible. No claim is made that this targeted review is exhaustive.

Corrections applied in this update include SEED's binary good/bad feedback, DREF's positive/negative feedback with abstention, the Nao absolute learning times, and physical new-policy learning from SOLE-R1 rewards. SOLE-R1's pretrained-policy steering branch remains deferred. EMPATHIC's physical trajectory-ranking study remains feedback evaluation, not robot-policy training.

## Run and rebuild

From the repository root:

```sh
python3 I-graph/scripts/build.py
python3 -m http.server 8000 --directory I-graph
```

Open `http://localhost:8000`. A plain static server is sufficient; Cytoscape and fonts are included locally. Keep the `src/`, `vendor/` and `data/` folders with `index.html` when distributing the website. If publishing to a static host, use `I-graph` as the site directory or link to that subdirectory.

`data/graph.json` is the canonical graph. `data/positions.json` stores layout coordinates. `scripts/build.py` regenerates `index.html` and the CSV, GraphML and Cypher exports. The browser uses `src/graph-logic.js` for shared filtering and `src/app.js` for rendering; its page structure and styling come from `src/template.html`.

To add evidence, create an `Experiment` node with a stable evidence ID, exactly one parent `Work`, a scope decision, learning setting, actual feedback provider, objective, initialization evidence, result, limitations, primary URL and locator. Attach `REPORTS_EXPERIMENT`, `LEARNING_SETTING` and appropriate task/platform/category edges. Avoid combining observations from different experimental branches into one asserted relationship. Regenerate all exports after data changes.

## Validate

Python 3 and Node.js (with the built-in test runner) are sufficient:

```sh
python3 I-graph/scripts/build.py
python3 -m unittest discover -s I-graph/tests -p 'test_*.py'
node --test I-graph/tests/graph-logic.test.cjs
```

The checks cover graph integrity, source fields, scope counts, known corrections, export consistency, shared-row filtering, oracle controls, same-experiment filtering and directed paths. Browser checks are still needed after interface changes.

## Download and cite

- `data/graph.json`: full nodes, relationships, metadata and provenance.
- `data/nodes.csv`, `data/edges.csv`: tabular exports with JSON properties.
- `data/graph.graphml`: directed graph export.
- `data/import.cypher`: import into an empty Neo4j database. It uses `CREATE` statements and is not a repeatable upsert.
- `CITATION.cff`: dataset citation metadata; the existing author/coauthor fields are preserved.

This repository currently does not declare a general license for the survey data/application. Bundled libraries and fonts retain their own licenses under `vendor/`.
