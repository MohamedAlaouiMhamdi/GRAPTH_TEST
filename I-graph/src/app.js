(function () {
  'use strict';
  const RAW = JSON.parse(document.getElementById('graph-data').textContent);
  const logic = GraphLogic.create(RAW), {byId, adj} = logic;
  const TYPES = [
    ['Work','Work','--c-human'], ['Experiment','Experiment / stage','--c-experiment'],
    ['LearningSetting','Learning setting','--c-setting'], ['TeacherType','Teacher type','--c-teacher'],
    ['FeedbackLevel','Feedback level','--c-level'], ['FeedbackType','Feedback type','--c-type'],
    ['FeedbackForm','Feedback form','--c-form'], ['ChannelClass','Explicit / implicit','--c-chclass'],
    ['Channel','Human channel','--c-channel'], ['TeacherKind','Who teaches','--c-kind'],
    ['FoundationModel','Foundation model','--c-model'], ['FMInput','Model input','--c-input'],
    ['FeedbackRegime','Online / offline labels','--c-regime'], ['IntegrationMethod','Integration method','--c-integ'],
    ['FeedbackModeling','Feedback modeling (legacy)','--c-modeling'], ['EnvRewardUse','Environment reward','--c-env'],
    ['Task','Task or benchmark','--c-task'], ['Robot','Robot / platform','--c-robot'],
    ['Challenge','Open problem','--c-challenge'], ['DetailedChallenge','Detailed problem','--c-detail'],
    ['Survey','Survey','--c-survey'], ['ResearchLine','Research line','--c-line'], ['ExclusionCategory','Excluded category','--c-excl']
  ];
  const TYPE_NAME = Object.fromEntries(TYPES.map(t => [t[0],t[1]]));
  const DEFAULT_TYPES = ['Work','FeedbackLevel','IntegrationMethod','Robot','Challenge'];
  const LEVELS = ['Rating','Preference','Action','Goal'];
  const PROVIDER = {human:'Human',fm:'Foundation model',oracle:'Oracle / simulated teacher',unreported:'Not established'};
  const RELATIONS = {REPORTS_EXPERIMENT:'reports experiment',LEARNING_SETTING:'learning setting',USES_PLATFORM:'uses platform',
    TESTED_ON:'tested on',USES_LEVEL:'feedback level',BUILDS_ON:'builds on',SHARES_METHOD:'shares a method',
    COMPARED_WITH:'compared with',HARDWARE_REPORTED:'hardware association',SUPPORTS:'supports discussion',SUPPORTS_DETAIL:'supports discussion'};
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const relation = r => RELATIONS[r] || r.toLowerCase().replaceAll('_',' ');
  const safeUrl = url => /^https?:\/\//i.test(String(url || '')) ? esc(url) : '';
  const sourceLink = (url,label='Open paper') => safeUrl(url) ? `<a href="${safeUrl(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>` : '';
  const workTeacher = n => n.p.teacher === 'mixed' ? 'Human and model' : n.p.teacher === 'fm' ? 'Foundation model' : 'Human-feedback methods';
  const nodeColor = n => n.t === 'Work' ? css(n.p.teacher === 'fm' ? '--c-fm' : n.p.teacher === 'mixed' ? '--c-mixed' : '--c-human') : css((TYPES.find(t=>t[0]===n.t)||[0,0,'--c-survey'])[2]);
  const state = {types:new Set(DEFAULT_TYPES), teacher:'all', levels:new Set(), cls:new Set(),
    robot:false, online:false, rowscope:true, elabels:false, extra:new Set(), focus:null, custom:null,
    evidence:false, decision:'all', setting:'all'};
  let visible, selected=null;

  function styles() {
    return [
      {selector:'node',style:{label:'data(label)',width:42,height:42,'font-family':'IBM Plex Sans, system-ui, sans-serif','font-size':9,
        color:css('--node-text'),'text-valign':'center','text-halign':'center','text-wrap':'ellipsis','text-max-width':40,
        'border-width':1.5,'border-color':'rgba(0,0,0,.18)','min-zoomed-font-size':5}},
      ...TYPES.map(([t,,v])=>({selector:`node[type = "${t}"]`,style:{'background-color':css(v)}})),
      {selector:'node[type = "Work"][teacher = "fm"]',style:{'background-color':css('--c-fm')}},
      {selector:'node[type = "Work"][teacher = "mixed"]',style:{'background-color':css('--c-mixed')}},
      {selector:'node[type = "Experiment"]',style:{shape:'round-rectangle',width:94,height:42,'text-max-width':88,'font-size':9}},
      {selector:'node[type = "LearningSetting"], node[type = "FeedbackLevel"]',style:{width:75,height:55,'text-max-width':69,'font-weight':600}},
      {selector:'node[type = "Challenge"], node[type = "DetailedChallenge"]',style:{shape:'round-rectangle',width:65,height:50,'text-max-width':59}},
      {selector:'node[type = "Challenge"]',style:{color:'#fff'}},
      {selector:'node[type = "Robot"]',style:{shape:'round-hexagon',width:60,height:50,'text-max-width':54}},
      {selector:'edge',style:{width:1.1,'line-color':css('--edge'),'target-arrow-color':css('--edge'),'target-arrow-shape':'triangle',
        'arrow-scale':.7,'curve-style':'bezier','font-size':8,'font-family':'IBM Plex Mono, monospace',color:css('--muted'),
        'text-rotation':'autorotate','text-background-color':css('--canvas'),'text-background-opacity':1,'text-background-padding':2,opacity:.75}},
      {selector:'edge[scope = "row"]',style:{'line-style':'dashed'}},
      {selector:'edge[rel = "HARDWARE_REPORTED"]',style:{'line-style':'dotted'}},
      {selector:'edge[rel = "SHARES_METHOD"]',style:{'line-color':css('--c-line'),'target-arrow-shape':'none'}},
      {selector:'edge[rel = "BUILDS_ON"]',style:{width:2,'line-color':css('--edge-strong')}},
      {selector:'.elabel',style:{label:'data(relationLabel)'}},
      {selector:'node:selected',style:{'border-width':4,'border-color':css('--accent')}},
      {selector:'.faded',style:{opacity:.12}},
      {selector:'edge.hl',style:{width:3,opacity:1,'line-color':css('--accent'),'target-arrow-color':css('--accent'),label:'data(relationLabel)'}},
      {selector:'node.hl',style:{'border-width':4,'border-color':css('--accent')}}
    ];
  }
  const cy = cytoscape({container:$('cy'), elements:[
    ...RAW.nodes.map(n=>({group:'nodes',data:{id:n.id,label:n.l,type:n.t,teacher:n.p.teacher||''},position:{x:n.x,y:n.y}})),
    ...RAW.edges.map(e=>({group:'edges',data:{id:e.id,source:e.s,target:e.t,rel:e.r,relationLabel:relation(e.r),scope:e.p.scope||''}}))
  ],layout:{name:'preset'},style:styles(),minZoom:.1,maxZoom:3.5,boxSelectionEnabled:false});
  new MutationObserver(()=>cy.style(styles())).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>cy.style(styles()));

  function apply() {
    visible=logic.visible(state);
    cy.batch(()=>{
      cy.nodes().forEach(n=>n.style('display',visible.nodes.has(n.id())?'element':'none'));
      cy.edges().forEach(e=>e.style('display',visible.edges.has(e.id())?'element':'none'));
      cy.edges().toggleClass('elabel',state.elabels);
    });
    renderControls(); renderCounts(); renderTable();
    if (selected && byId[selected]) showNode(selected);
  }
  function filterChanged() {
    state.focus=null; state.extra.clear(); cy.elements().removeClass('hl faded'); selected=null;
    apply(); welcome();
  }
  function renderControls() {
    const counts={};RAW.nodes.forEach(n=>counts[n.t]=(counts[n.t]||0)+1);
    $('types').innerHTML=TYPES.filter(t=>counts[t[0]]).map(([t,name,v])=>`<button type="button" class="tchip" data-type="${t}" aria-pressed="${state.types.has(t)}"><span class="dot" style="background:var(${v})"></span><span>${esc(name)}</span><span class="n">${counts[t]}</span></button>`).join('');
    $('f-level').innerHTML=LEVELS.map(l=>`<button type="button" class="chip" data-level="${l}" aria-pressed="${state.levels.has(l)}">${l}</button>`).join('');
    $('f-class').innerHTML=['Explicit','Implicit'].map(c=>`<button type="button" class="chip" data-cls="${c}" aria-pressed="${state.cls.has(c)}">${c}</button>`).join('');
    for (const [id,key] of [['f-robot','robot'],['f-online','online'],['f-rowscope','rowscope'],['f-elabels','elabels']]) $(id).checked=state[key];
    $('evidence-controls').hidden=!state.evidence;
    $('f-class').closest('section').hidden=state.evidence;
    $('f-decision').value=state.decision; $('f-setting').value=state.setting; $('f-provider').value=state.teacher;
    document.querySelectorAll('[data-teacher]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.teacher===state.teacher));
    $('tab-table').textContent=state.evidence?'Table of experiments':'Table of visible works';
    $('view-note').textContent=state.evidence ?
      'Each row is an experimental setting or learning stage. Read the result together with its comparator, evaluation and limitations. Counts are not independent trials or exhaustive literature totals.' :
      'Overview of the survey. Shared-row facts are uncertain; switch to Robotics evidence for experiment-level learning settings and results.';
  }
  function renderCounts() {
    const nodes=[...visible.nodes].map(id=>byId[id]), works=nodes.filter(n=>n.t==='Work').length, exps=nodes.filter(n=>n.t==='Experiment').length;
    $('counts').innerHTML=`<b>${works}</b> works · <b>${exps}</b> experiments shown<br><b>${visible.nodes.size}</b> nodes · <b>${visible.edges.size}</b> links`;
  }
  function sourceBlock(p) {
    return `<p class="sub">${sourceLink(p.sourceUrl)}${p.locator ? '<br>'+esc(p.locator):''}${p.reviewedAt ? '<br>Reviewed '+esc(p.reviewedAt):''}</p>`;
  }
  const PROP_LABEL={authorYear:'Author, year',discussedIn:'Survey section',teachersNote:'Teachers',feedbackType:'Feedback type',channelClass:'Channel class',
    sourceId:'Review source ID',sourceUrl:'Paper',reviewStatus:'Evidence status',definedBy:'Defined by',nameAsPrinted:'As printed',
    asListed:'As listed',scope:'Scope',basis:'Basis',locator:'Source location',reviewedAt:'Reviewed',rows:'Table rows',module:'Module',
    certainty:'Certainty',evidenceStatus:'Evidence status',legacyUse:'Earlier hardware description'};
  function propertyList(props) {
    return `<dl class="props">${Object.entries(props).filter(([,v])=>v!=='' && v!=null && !(Array.isArray(v)&&!v.length)).map(([k,v])=>`<dt>${esc(PROP_LABEL[k]||k)}</dt><dd>${k==='sourceUrl'?sourceLink(v):esc(Array.isArray(v)?v.join('; '):typeof v==='object'?JSON.stringify(v):v===true?'yes':v===false?'no':v)}</dd>`).join('')}</dl>`;
  }
  function showNode(id) {
    const n=byId[id];if(!n)return;selected=id;
    let h=`<div><span class="ptype" style="background:${nodeColor(n)}">${esc(TYPE_NAME[n.t]||n.t)}</span></div><h3>${esc(n.l)}</h3>`;
    if(n.t==='Experiment') {
      const p=n.p, w=byId[p.workId];
      h+=`<p class="sub"><button class="node-select" data-go="${esc(w.id)}">${esc(w.l)}</button> · ${esc(w.p.authorYear||w.p.year||'')}</p><p><span class="badge">${esc(p.scopeLabel)}</span><br>${esc(p.setting)}</p>`+sourceBlock(p);
      const blocks=[['Task',p.task],['Robot / platform',p.platform],['Feedback',`${(p.providers||[]).map(v=>PROVIDER[v]).join('; ')}\n${p.feedbackSource}\n${p.feedback}`],
        ['Learner and objective',`${p.algorithm}\n${p.objective}`],['How feedback is used',p.integration],['Policy initialization',p.policyInitialization],
        ['Reported result',p.result],['Comparator',p.comparison],['Evaluation',p.evaluation],['Participants',p.participants],
        ['Additional support',p.extraSupport],['Limitations',p.limitations],['Scope decision',p.scopeReason],['Unresolved details',(p.uncertainties||[]).join('\n')],['Correction',p.correction]];
      h+=blocks.filter(([,v])=>v).map(([label,v])=>`<section class="evidence-block"><h4>${label}</h4><p>${esc(v)}</p></section>`).join('');
    } else {
      if(n.t==='Work') {
        h+=`<p class="sub">${esc(workTeacher(n))} · ${esc(n.p.authorYear||'')}<br>${esc(n.p.title||'')}</p>`;
        h+=n.p.sourceUrl?sourceBlock(n.p):n.p.title?`<p class="sub">${sourceLink('https://scholar.google.com/scholar?q='+encodeURIComponent(n.p.title),'Search for paper (no direct link recorded)')}</p>`:'';
      }
      if(n.p.openQuestion)h+=`<p class="open">${esc(n.p.openQuestion)}</p>`;
      const skip=new Set(['title','short','teacher','openQuestion','sourceUrl']);
      h+=propertyList(Object.fromEntries(Object.entries(n.p).filter(([k])=>!skip.has(k))));
      if(n.t!=='Work'&&n.p.sourceUrl)h+=sourceBlock(n.p);
    }
    h+=`<div class="actions"><button type="button" class="btn primary" data-act="focus">Show only its links</button><button type="button" class="btn" data-act="expand">Add its neighbours</button><button type="button" class="btn" data-act="clearfocus">Back to filters</button></div>`;
    const groups={};
    (adj[id]||[]).filter(e=>logic.allowedEdge(e,state)).forEach(e=>{
      const outgoing=e.s===id, other=outgoing?e.t:e.s, on=byId[other];
      if(on.t==='Experiment'&&!logic.experimentPasses(on,state))return;
      const key=(outgoing?'→ ':'← ')+relation(e.r);(groups[key]=groups[key]||[]).push({other,e});
    });
    h+='<div class="nbrs">'+Object.entries(groups).sort().map(([name,items])=>`<div><h4>${esc(name)} (${items.length})</h4>${items.map(({other,e})=>`<button type="button" class="nbr ${e.p.scope==='row'?'shared':''}" data-go="${esc(other)}" title="${esc(e.p.evidenceStatus||e.p.evidence||e.p.asListed||'')}"><span class="dot" style="background:${nodeColor(byId[other])}"></span>${esc(byId[other].l)}${e.p.scope==='row'?' · shared row':''}</button>`).join('')}</div>`).join('')+'</div>';
    $('panel').innerHTML=h;
  }
  function showEdge(id) {
    selected=null;const e=RAW.edges.find(e=>e.id===id);if(!e)return;
    $('panel').innerHTML=`<span class="ptype" style="background:var(--rule)">Relationship</span><h3>${esc(relation(e.r))}</h3><p><button class="node-select" data-go="${esc(e.s)}">${esc(byId[e.s].l)}</button> → <button class="node-select" data-go="${esc(e.t)}">${esc(byId[e.t].l)}</button></p>`+propertyList(e.p);
  }
  function welcome() {
    $('panel').innerHTML=`<div class="empty"><b>Select a work, experiment or relationship.</b><p>Use Robotics evidence to compare feedback used in robot learning. Select an experiment to see its source, result, comparator and limitations.</p><p>The overview also retains methodological context. A shared task or robot connects works without proving that one builds on the other.</p></div>`;
  }
  function renderTable() {
    if(state.evidence) {
      const exps=logic.experiments.filter(n=>visible.nodes.has(n.id)).sort((a,b)=>byId[a.p.workId].l.localeCompare(byId[b.p.workId].l)||a.p.setting.localeCompare(b.p.setting));
      $('tablepane').innerHTML=`<table class="works"><thead><tr><th>Work / experiment</th><th>Feedback</th><th>Learner</th><th>Robot / task</th><th>Learning setting</th><th>Reported finding</th></tr></thead><tbody>${exps.map(n=>{
        const p=n.p,w=byId[p.workId];return `<tr data-experiment="${esc(p.evidenceId)}"><td><button type="button" class="node-select" data-go="${esc(n.id)}">${esc(w.l)}</button><br>${esc(w.p.authorYear||w.p.year)}<br><span class="badge">${esc(p.scopeLabel)}</span><br>${sourceLink(p.sourceUrl,'Paper')}</td><td>${esc(p.providers.map(v=>PROVIDER[v]).join('; '))}<br>${esc(p.feedback)}</td><td>${esc(p.algorithm)}</td><td>${esc(p.platform)}<br>${esc(p.task)}</td><td>${esc(p.setting)}</td><td>${esc(p.finding)}<br><button type="button" class="node-select" data-go="${esc(n.id)}">Evidence and limitations</button></td></tr>`;
      }).join('')||'<tr><td colspan="6">No experiment matches these filters.</td></tr>'}</tbody></table>`;
      return;
    }
    const works=RAW.nodes.filter(n=>n.t==='Work'&&visible.nodes.has(n.id)).sort((a,b)=>a.l.localeCompare(b.l));
    const cell=(f,r)=>f.edges.filter(e=>e.r===r).map(e=>`<span${e.p.scope==='row'?' class="shared" title="Shared table row; not confirmed for this work"':''}>${esc(byId[e.t].p.code||byId[e.t].l)}${e.p.scope==='row'?' ?':''}</span>`).join('; ');
    $('tablepane').innerHTML=`<table class="works"><thead><tr><th>Work</th><th>Method family</th><th>Level</th><th>Channel or model</th><th>Integration</th><th>Tasks</th><th>Robot evidence</th></tr></thead><tbody>${works.map(n=>{
      const f=logic.facts(n.id,state);return `<tr data-work="${esc(n.id)}"><td><button type="button" class="node-select" data-go="${esc(n.id)}">${esc(n.l)}</button><br>${esc(n.p.authorYear||'')}</td><td>${esc(workTeacher(n))}</td><td>${esc(f.levels.join(', '))}</td><td>${cell(f,n.p.teacher==='fm'?'TEACHER_MODEL':'VIA_CHANNEL')}</td><td>${cell(f,'INTEGRATES_AS')}</td><td>${cell(f,'TESTED_ON')}</td><td>${f.hasExperiments?`${f.experiments.length} reviewed experiment/stage records; select the work for details.`:f.robots.map(r=>esc(r.name)+' (association only)').join('; ')||'—'}</td></tr>`;
    }).join('')||'<tr><td colspan="7">No work matches these filters.</td></tr>'}</tbody></table>`;
  }

  const VIEWS={
    overview:{}, robotics:{evidence:true,types:['Work','Experiment','LearningSetting']},
    implicit:{types:['Work','FeedbackLevel','ChannelClass','Channel'],teacher:'human',cls:['Implicit']},
    robots:{evidence:true,types:['Work','Experiment','Robot','LearningSetting'],robot:true},
    'fm-robots':{evidence:true,types:['Work','Experiment','Robot','LearningSetting'],teacher:'fm',robot:true},
    integration:{types:['Work','IntegrationMethod','TeacherType']},
    lineage:{types:['Work'],custom:{relations:['BUILDS_ON','SHARES_METHOD','COMPARED_WITH'],works:n=>(adj[n.id]||[]).some(e=>['BUILDS_ON','SHARES_METHOD','COMPARED_WITH'].includes(e.r))},elabels:true},
    'human-problems':{types:['Work','Challenge'],teacher:'human'}, 'fm-problems':{types:['Work','Challenge'],teacher:'fm'},
    models:{types:['Work','Experiment','FoundationModel','FMInput'],teacher:'fm'}, tasks:{types:['Work','Experiment','Task','TeacherType']}
  };
  function setView(name,relayout=true) {
    const v=VIEWS[name]||VIEWS.overview;
    Object.assign(state,{types:new Set(v.types||DEFAULT_TYPES),teacher:v.teacher||'all',levels:new Set(),cls:new Set(v.cls||[]),
      robot:!!v.robot,online:false,rowscope:true,elabels:!!v.elabels,extra:new Set(),focus:null,custom:v.custom||null,
      evidence:!!v.evidence,decision:v.evidence?'include':'all',setting:'all'});
    selected=null;cy.elements().removeClass('hl faded');$('view').value=VIEWS[name]?name:'overview';apply();welcome();
    if(relayout&&name!=='overview'&&location.hash!=='#table')arrange();else cy.fit(cy.elements(':visible'),30);
  }
  function arrange() {
    if($('graphpane').hidden)return;
    const vis=cy.elements().filter(el=>el.style('display')!=='none');
    vis.layout({name:'cose',animate:false,randomize:false,nodeRepulsion:()=>10000,idealEdgeLength:()=>95,gravity:.5,numIter:650,fit:true,padding:35}).run();
  }
  function goTo(id) {
    const n=byId[id];if(!n)return;
    if(n.t==='Experiment'&&!logic.experimentPasses(n,state))return;
    state.extra.add(id);apply();showNode(id);
    const el=cy.getElementById(id);cy.elements().unselect();el.select();
    if(!$('graphpane').hidden)cy.animate({center:{eles:el},zoom:Math.max(cy.zoom(),1.1)},{duration:200});
  }
  cy.on('tap','node',e=>showNode(e.target.id()));cy.on('tap','edge',e=>showEdge(e.target.id()));
  cy.on('tap',e=>{if(e.target===cy){selected=null;cy.elements().removeClass('hl faded');welcome();}});
  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-type]');if(t){state.types.has(t.dataset.type)?state.types.delete(t.dataset.type):state.types.add(t.dataset.type);filterChanged();return;}
    for(const [attr,key] of [['level','levels'],['cls','cls']]){const b=e.target.closest(`[data-${attr}]`);if(b){const val=b.dataset[attr];state[key].has(val)?state[key].delete(val):state[key].add(val);filterChanged();return;}}
    const teacher=e.target.closest('[data-teacher]');if(teacher){state.teacher=teacher.dataset.teacher;filterChanged();return;}
    const go=e.target.closest('[data-go]');if(go){goTo(go.dataset.go);return;}
    const action=e.target.closest('[data-act]');if(!action||!selected)return;
    const id=selected;
    if(action.dataset.act==='focus'){state.focus=id;apply();arrange();}
    if(action.dataset.act==='expand'){(adj[id]||[]).filter(e=>logic.allowedEdge(e,state)).forEach(e=>{state.extra.add(e.s);state.extra.add(e.t);});apply();}
    if(action.dataset.act==='clearfocus'){state.focus=null;state.extra.clear();apply();cy.fit(cy.elements(':visible'),30);}
    showNode(id);
  });
  for(const [id,key] of [['f-robot','robot'],['f-online','online'],['f-rowscope','rowscope'],['f-elabels','elabels']])$(id).addEventListener('change',e=>{state[key]=e.target.checked;filterChanged();});
  for(const [id,key] of [['f-decision','decision'],['f-setting','setting'],['f-provider','teacher']])$(id).addEventListener('change',e=>{state[key]=e.target.value;filterChanged();});
  $('f-setting').innerHTML='<option value="all">All settings</option>'+[...new Set(logic.experiments.map(n=>n.p.settingGroup))].sort().map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  $('reset').addEventListener('click',()=>{setView('overview');$('q').value='';$('pa').value='';$('pb').value='';});
  $('fit').addEventListener('click',()=>cy.fit(cy.elements(':visible'),30));$('relayout').addEventListener('click',arrange);
  $('view').addEventListener('change',e=>setView(e.target.value));

  const labelOf=n=>n.t==='Work'?`${n.l} — ${n.p.authorYear||n.p.year||''}`:`${n.l} (${TYPE_NAME[n.t]||n.t})`;
  const lookup=Object.fromEntries(RAW.nodes.map(n=>[labelOf(n),n.id]));
  $('qlist').innerHTML=RAW.nodes.map(n=>`<option value="${esc(labelOf(n))}"></option>`).join('');
  $('wlist').innerHTML=RAW.nodes.filter(n=>n.t==='Work').map(n=>`<option value="${esc(labelOf(n))}"></option>`).join('');
  function findNode(text,worksOnly=false){
    const q=text.trim().toLowerCase();if(!q)return null;
    const eligible=n=>!worksOnly||n.t==='Work';
    if(lookup[text]&&eligible(byId[lookup[text]]))return lookup[text];
    const hits=RAW.nodes.filter(eligible);
    const n=hits.find(n=>n.l.toLowerCase()===q)||hits.find(n=>labelOf(n).toLowerCase().includes(q)||(n.p.title||'').toLowerCase().includes(q));return n?n.id:null;
  }
  function search(){const id=findNode($('q').value);if(id)goTo(id);else{$('panel').innerHTML='<p class="empty">No matching record. Try a method name or paper title.</p>';}}
  $('q').addEventListener('change',search);$('q').addEventListener('keydown',e=>{if(e.key==='Enter')search();});
  $('findpath').addEventListener('click',()=>{
    const a=findNode($('pa').value,true),b=findNode($('pb').value,true),mode=$('path-mode').value;
    selected=null;cy.elements().removeClass('hl faded');
    if(!a||!b){$('panel').innerHTML='<p class="empty">Choose two works from the suggestions.</p>';return;}
    const result=logic.relationshipPath(a,b,state,mode);
    if(!result){$('panel').innerHTML='<p class="empty">No path in the current view and filters. Enable the relevant node types or choose Method relationships. Directed paths follow “builds on” from the newer method to its predecessor.</p>';return;}
    cy.elements().addClass('faded');
    const ids=[...result.nodes,...result.edges.map(e=>e.id)],els=cy.collection(ids.map(id=>cy.getElementById(id)));
    els.removeClass('faded').addClass('hl');cy.fit(els,50);
    $('panel').innerHTML=`<span class="ptype" style="background:var(--accent-soft)">${mode==='lineage'?'Directed builds-on path':'Connection path'}</span><p class="note">${mode==='lineage'?'Stated extensions in the survey; inspect each link’s evidence.':'A connection shows an association, not historical inheritance or superior performance.'}</p>`+result.nodes.map((id,i)=>`<button type="button" class="nbr" data-go="${esc(id)}">${esc(byId[id].l)}</button>${i<result.edges.length?`<p class="note">${result.directions[i]?'→':'←'} ${esc(relation(result.edges[i].r))}${result.edges[i].p.scope==='row'?' (shared row; uncertain)':''}</p>`:''}`).join('');
  });
  function route(){
    const h=location.hash.slice(1),table=h==='table';
    $('graphpane').hidden=table;$('tablepane').hidden=!table;
    for(const [id,on]of[['tab-graph',!table],['tab-table',table]]){if(on)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current');}
    if(VIEWS[h])setView(h);if(table)renderTable();else{cy.resize();cy.fit(cy.elements(':visible'),30);}
  }
  window.addEventListener('hashchange',route);setView('overview',false);route();
})();
