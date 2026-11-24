const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {create} = require('../src/graph-logic.js');
const html = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const raw = JSON.parse(html.match(/<script type="application\/json" id="graph-data">([\s\S]*?)<\/script>/)[1]);
const logic=create(raw);
function state(overrides={}) {
  return {types:new Set(['Work','Experiment','LearningSetting','Task','Channel','IntegrationMethod']),teacher:'all',
    levels:new Set(),cls:new Set(),robot:false,online:false,rowscope:true,extra:new Set(),focus:null,custom:null,
    evidence:true,decision:'include',setting:'all',...overrides};
}
function ids(s) { return [...logic.visible(s).experiments].sort(); }
test('default robotics review retains 60 settings from 46 sources, not all 106 records',()=>{
  const v=logic.visible(state()); assert.equal(v.experiments.size,60);assert.equal(v.works.size,46);
  assert.equal(logic.experiments.length,106);
  assert.ok(!v.experiments.has('experiment:WEB-SOLE-R1-steering'));
});
test('physical FM training separates a new actor from steering pretrained policies',()=>{
  assert.deepEqual(ids(state({teacher:'fm',setting:'Real-robot training'})),['experiment:WEB-SOLE-R1-physical']);
  const deferred=ids(state({decision:'defer_pretrained',teacher:'fm'}));
  assert.ok(deferred.includes('experiment:WEB-SOLE-R1-steering'));
  assert.ok(deferred.includes('experiment:P094-1'));
});
test('offline physical-data RL and sim-to-real remain distinct',()=>{
  assert.equal(ids(state({setting:'Offline RL from robot data'})).length,5);
  assert.deepEqual(ids(state({setting:'Sim-to-real transfer'})),['experiment:P013-2','experiment:P026-2']);
});
test('oracle controls in a model-feedback paper do not pass the model filter',()=>{
  assert.ok(ids(state({teacher:'oracle'})).includes('experiment:WEB-VARP-oracle-controls'));
  assert.ok(!ids(state({teacher:'fm'})).includes('experiment:WEB-VARP-oracle-controls'));
  assert.ok(ids(state({teacher:'fm'})).includes('experiment:WEB-VARP-vlm-sim'));
});
test('robot training toggle does not include evaluation-only or related objectives',()=>{
  const s=state({online:true,decision:'all'}), got=ids(s);
  assert.equal(got.length,13);
  for(const id of ['experiment:P079-1','experiment:S002-2','experiment:P046-1','experiment:P094-1'])assert.ok(!got.includes(id));
});
test('same-experiment filtering avoids combining one setting with another feedback source',()=>{
  const s=state({teacher:'oracle',setting:'Real-robot training'});
  assert.equal(ids(s).length,0);
});
test('shared-row toggle changes facts used by the table and removes isolated categories',()=>{
  const id='work:thomaz_reinforcement_2006';
  const on=state({evidence:false,decision:'all',rowscope:true}),off=state({evidence:false,decision:'all',rowscope:false});
  assert.ok(logic.facts(id,on).edges.some(e=>e.p.scope==='row'));
  assert.ok(!logic.facts(id,off).edges.some(e=>e.p.scope==='row'));
  assert.ok(logic.facts(id,on).channels.length>logic.facts(id,off).channels.length);
  const v=logic.visible(off);
  assert.ok([...v.edges].every(id=>raw.edges.find(e=>e.id===id).p.scope!=='row'));
});
test('focused details obey scope and row uncertainty filters',()=>{
  const s=state({focus:'work:sole_r1_2026'}),v=logic.visible(s);
  assert.ok(v.nodes.has('experiment:WEB-SOLE-R1-physical'));
  assert.ok(!v.nodes.has('experiment:WEB-SOLE-R1-steering'));
  const off=state({evidence:false,decision:'all',rowscope:false,focus:'work:thomaz_reinforcement_2006'});
  const edges=logic.visible(off).edges;
  assert.ok([...edges].every(id=>raw.edges.find(e=>e.id===id).p.scope!=='row'));
});
test('directed builds-on paths reject reverse direction and methodological similarity',()=>{
  const s=state({evidence:false,decision:'all',types:new Set(['Work']),custom:{relations:['BUILDS_ON','SHARES_METHOD','COMPARED_WITH']}});
  const deep='work:warnell_deep_2018', tamer='work:bradley_knox_tamer_2008';
  assert.ok(logic.relationshipPath(deep,tamer,s,'lineage'));
  assert.equal(logic.relationshipPath(tamer,deep,s,'lineage'),null);
  assert.equal(logic.relationshipPath('work:klissarov_motif_2023','work:christiano_deep_2023',s,'lineage'),null);
  assert.ok(logic.relationshipPath('work:klissarov_motif_2023','work:christiano_deep_2023',s,'connections'));
});
test('paths never traverse hidden row-derived links',()=>{
  const fixture={nodes:[{id:'a',t:'Work',p:{},l:'A'},{id:'b',t:'Work',p:{},l:'B'},{id:'t',t:'Task',p:{},l:'Task'}],
    edges:[{id:'1',s:'a',t:'t',r:'TESTED_ON',p:{scope:'row'}},{id:'2',s:'b',t:'t',r:'TESTED_ON',p:{scope:'work'}}]};
  const l=create(fixture),s=state({evidence:false,decision:'all',types:new Set(['Work','Task'])});
  assert.ok(l.relationshipPath('a','b',s,'connections'));
  assert.equal(l.relationshipPath('a','b',{...s,rowscope:false},'connections'),null);
});
