/* Shared, DOM-free filtering for the graph, tables and relationship paths. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GraphLogic = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function create(raw) {
    const byId = Object.fromEntries(raw.nodes.map(n => [n.id, n]));
    const adj = {};
    raw.edges.forEach(e => {
      (adj[e.s] = adj[e.s] || []).push(e);
      (adj[e.t] = adj[e.t] || []).push(e);
    });
    const experiments = raw.nodes.filter(n => n.t === 'Experiment');
    const experimentsByWork = {};
    experiments.forEach(n => (experimentsByWork[n.p.workId] = experimentsByWork[n.p.workId] || []).push(n));
    const allowedEdge = (e, state) => !!state.rowscope || e.p.scope !== 'row';
    const out = (id, state) => (adj[id] || []).filter(e => e.s === id && allowedEdge(e, state));
    const uniq = values => [...new Set(values)];
    function experimentPasses(n, state) {
      const p = n.p;
      if (state.decision && state.decision !== 'all' && p.decision !== state.decision) return false;
      if (state.setting && state.setting !== 'all' && p.settingGroup !== state.setting) return false;
      if (state.teacher !== 'all' && !(p.providers || []).includes(state.teacher)) return false;
      if (state.levels.size && !p.levels.some(l => state.levels.has(l))) return false;
      // No cross-experiment join: both constraints must hold on this same record.
      if (state.robot && p.settingGroup === 'Simulation') return false;
      if (state.online && !(p.decision === 'include' && p.setting === 'Real-robot training')) return false;
      return true;
    }
    function facts(id, state) {
      const edges = out(id, state);
      const lab = r => uniq(edges.filter(e => e.r === r).map(e => byId[e.t].l));
      const exps = experimentsByWork[id] || [];
      const active = exps.filter(n => experimentPasses(n, state));
      const legacyRobots = edges.filter(e => ['RAN_ON_ROBOT','HARDWARE_REPORTED'].includes(e.r)).map(e => ({
        name: byId[e.t].l, online: false, use: 'hardware association; inspect experiment', uncertain: e.p.scope === 'row'
      }));
      const robots = exps.length ? active.filter(n => n.p.settingGroup !== 'Simulation').map(n => ({
        name:n.p.platform, online:n.p.decision === 'include' && n.p.setting === 'Real-robot training',
        use:n.p.setting, decision:n.p.scopeLabel
      })) : legacyRobots;
      return {
        edges, experiments:active, hasExperiments:!!exps.length, robots,
        levels:uniq([...lab('USES_LEVEL'),...active.flatMap(n => n.p.levels)]), cls:lab('CHANNEL_CLASS'),
        integ:uniq(edges.filter(e => e.r === 'INTEGRATES_AS').map(e => byId[e.t].p.code || byId[e.t].l)),
        tasks:lab('TESTED_ON'), models:lab('TEACHER_MODEL'), channels:lab('VIA_CHANNEL'),
        shared:edges.some(e => e.p.scope === 'row')
      };
    }
    function workPasses(n, state) {
      const f = facts(n.id,state);
      if (state.evidence) return f.experiments.length > 0 &&
        (!state.cls.size || f.cls.some(c => state.cls.has(c)));
      if (state.teacher !== 'all' && n.p.teacher !== state.teacher && n.p.teacher !== 'mixed') return false;
      if (n.p.scope === 'excluded from scope' && !state.types.has('ExclusionCategory')) return false;
      if (state.levels.size && !f.levels.some(l => state.levels.has(l))) return false;
      if (state.cls.size && !f.cls.some(c => state.cls.has(c))) return false;
      if (state.robot && !f.robots.length) return false;
      if (state.online && !f.robots.some(r => r.online)) return false;
      return true;
    }
    function visible(state) {
      const works = new Set(raw.nodes.filter(n => n.t === 'Work' && workPasses(n,state) &&
        (!state.custom || !state.custom.works || state.custom.works(n))).map(n => n.id));
      const exps = new Set(experiments.filter(n => works.has(n.p.workId) && experimentPasses(n,state)).map(n => n.id));
      const seeds = new Set();
      if (state.types.has('Work')) works.forEach(id => seeds.add(id));
      if (state.types.has('Experiment')) exps.forEach(id => seeds.add(id));
      const show = new Set(seeds);
      const matches = e => allowedEdge(e,state) && (!state.custom || !state.custom.relations || state.custom.relations.includes(e.r));
      // Only add categories directly supported by visible works/experiments.
      seeds.forEach(id => (adj[id] || []).filter(matches).forEach(e => {
        const other = e.s === id ? e.t : e.s, n = byId[other];
        if (n.t === 'Work' || n.t === 'Experiment') return;
        if (state.types.has(n.t)) show.add(other);
      }));
      if (!state.types.has('Work') && !state.types.has('Experiment')) {
        raw.nodes.filter(n => state.types.has(n.t)).forEach(n => show.add(n.id));
      }
      if (state.focus) {
        show.clear(); show.add(state.focus);
        (adj[state.focus] || []).filter(matches).forEach(e => {
          const other=e.s === state.focus ? e.t : e.s, n=byId[other];
          if (n.t === 'Experiment' && !experimentPasses(n,state)) return;
          show.add(other);
        });
      }
      // Search may reveal a work but cannot smuggle disallowed experiments into results.
      (state.extra || new Set()).forEach(id => {
        const n=byId[id];
        if (n && (n.t !== 'Experiment' || experimentPasses(n,state))) show.add(id);
      });
      const edgeIds = new Set(raw.edges.filter(e => show.has(e.s) && show.has(e.t) && matches(e)).map(e => e.id));
      return {nodes:show, edges:edgeIds, works, experiments:exps};
    }
    function relationshipPath(a,b,state,mode) {
      // A lineage path is directed and only follows stated BUILDS_ON relationships.
      const v=visible(state), links=raw.edges.filter(e => v.edges.has(e.id) &&
        (mode !== 'lineage' || e.r === 'BUILDS_ON'));
      const skip=new Set(['TeacherType','TeacherKind','FeedbackType','ChannelClass','FeedbackLevel',
        'FeedbackForm','IntegrationMethod','FeedbackModeling','EnvRewardUse','FMInput','FeedbackRegime',
        'ExclusionCategory','LearningSetting']);
      const todo=[a], previous=new Map([[a,null]]);
      for (let i=0;i<todo.length;i++) {
        const current=todo[i]; if (current===b) break;
        links.forEach(e => {
          const other=e.s===current ? e.t : (mode!=='lineage' && e.t===current ? e.s : null);
          if (!other || previous.has(other) || (mode!=='lineage' && skip.has(byId[other].t))) return;
          previous.set(other,{node:current,edge:e,forward:e.s===current}); todo.push(other);
        });
      }
      if (!previous.has(b)) return null;
      const result={nodes:[b],edges:[],directions:[]};
      for (let curr=b;previous.get(curr);) {
        const step=previous.get(curr); result.edges.unshift(step.edge); result.directions.unshift(step.forward);
        result.nodes.unshift(step.node); curr=step.node;
      }
      return result;
    }
    return {byId,adj,experiments,experimentsByWork,out,facts,allowedEdge,experimentPasses,workPasses,visible,relationshipPath};
  }
  return {create};
});
