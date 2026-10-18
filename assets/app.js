import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';
import { initLegalView } from './legal-ui.js';
import { makeIcon } from './icons.js';

const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
  auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:false}
});
const $=id=>document.getElementById(id);
const statuses={pending:'Pendente',in_progress:'Em andamento',waiting:'Aguardando',review:'Em revisão',completed:'Concluída'};
const priorities={low:'Baixa',normal:'Normal',high:'Alta',urgent:'Urgente'};
const roleNames={admin:'Administrador',manager:'Gestor',operator:'Operador',auditor:'Auditor'};
const views={dashboard:'Visão geral',tarefas:'Pendências',processos:'Processos',
  kanban:'Kanban',equipe:'Equipe',relatorios:'Relatórios',historico:'Histórico',
  legal:'Base legal e responsabilidades'};
let currentUser=null,organization=null,role=null,organizations=[],members=[],processes=[],tasks=[],invitations=[],events=[];
let activeView='dashboard',selectedTask=null,loading=false,initDone=false,toastTimer=null;

const make=(tag,cls,text)=>{
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text!==undefined)el.textContent=String(text);
  return el;
};
const empty=(message)=>make('div','empty',message);
const humanDate=value=>value?new Date(value.includes('T')?value:value+'T12:00:00').toLocaleDateString('pt-BR'):'—';
const admin=()=>role==='admin';
const manage=()=>role==='admin'||role==='manager';
const writable=()=>role!=='auditor'&&!!organization;
const memberLabel=member=>member?.display_name?.trim()||('Usuário '+(member?.user_id||'').slice(0,8));
const memberName=id=>memberLabel(members.find(m=>m.user_id===id));
const clean=(s)=>String(s??'').trim();

function notify(message,isError=false){
  const box=$('globalMessage');
  box.textContent=message;box.hidden=false;
  box.style.background=isError?'#872e3e':'#0d395c';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>box.hidden=true,4800);
}
function check(result){
  if(result.error)throw result.error;
  return result.data;
}
async function run(action,success){
  if(loading)return;
  loading=true;
  try{const result=await action();if(success&&result!==false)notify(success)}
  catch(err){notify('Operação não concluída: '+(err?.message||'falha de conexão'),true);console.warn('RAF: operação recusada')}
  finally{loading=false}
}
function setSelect(id,options,placeholder){
  const select=$(id);const old=select.value;
  select.replaceChildren();
  if(placeholder!==null){
    const o=make('option',null,placeholder||'Todos');o.value='';select.append(o);
  }
  for(const item of options){
    const o=make('option',null,item.label);o.value=item.value;select.append(o);
  }
  select.value=[...select.options].some(o=>o.value===old)?old:'';
}
function show(view){
  if(!views[view])view='dashboard';
  if(!organization&&view!=='legal')view='dashboard';
  activeView=view;
  for(const item of document.querySelectorAll('.view')){
    item.hidden=item.id!==view+'View'||(!organization&&view!=='legal');
    item.style.display='';
  }
  for(const link of document.querySelectorAll('.nav')){
    link.classList.toggle('active',link.dataset.view===view);
  }
  $('breadcrumb').textContent=views[view];
  document.querySelector('.sidebar').classList.remove('open');
  $('navScrim').hidden=true;
  $('menuBtn').setAttribute('aria-expanded','false');
  if(view==='historico'&&organization)loadHistory();
}
function renderInvitations(){
  const box=$('incomingInvitations');
  const incoming=invitations.filter(x=>x.status==='pending'&&!organizations.some(o=>o.id===x.organization_id));
  box.hidden=!incoming.length;
  box.replaceChildren();
  if(!incoming.length)return;
  box.append(make('h2',null,'Convites recebidos'));
  box.append(make('p','panel-note','Aceitar um convite concede acesso apenas ao ambiente informado. É necessário ter e-mail confirmado.'));
  for(const invite of incoming){
    const row=make('div','invite-item');
    const message=make('div');
    message.append(make('strong',null,'Convite para equipe · '+roleNames[invite.role]));
    message.append(make('small',null,'Ambiente: '+invite.organization_id.slice(0,8)+'…'));
    const button=make('button','primary','Aceitar convite');
    button.type='button';
    button.addEventListener('click',()=>run(async()=>{
      check(await db.from('raf_invitations').update({status:'accepted'}).eq('id',invite.id).eq('status','pending'));
      await loadAll();
    },'Convite aceito.'));
    row.append(message,button);box.append(row);
  }
}
function renderOrganizations(){
  setSelect('organizationSelect',organizations.map(o=>({value:o.id,label:o.name})),null);
  $('organizationSelect').value=organization?.id||'';
  $('organizationSelect').hidden=organizations.length<=1;
  $('emptyOrganization').hidden=!!organization;
  $('incomingInvitations').hidden=!invitations.some(i=>i.status==='pending');
}
async function enter(session){
  currentUser=session?.user||null;
  $('loginView').hidden=!!currentUser;
  $('appView').hidden=!currentUser;
  if(!currentUser){
    organization=null;organizations=[];tasks=[];processes=[];members=[];invitations=[];
    $('loginForm').reset();
    return;
  }
  await loadAll();
}
async function loadAll(){
  if(!currentUser)return;
  const [orgResult,inviteResult]=await Promise.all([
    db.from('raf_organizations').select('id,name,owner_id,created_at').order('created_at'),
    db.from('raf_invitations').select('id,organization_id,email,role,status,invited_by,accepted_by,created_at').order('created_at',{ascending:false}).limit(150)
  ]);
  organizations=check(orgResult)||[];
  invitations=check(inviteResult)||[];
  const desired=sessionStorage.getItem('raf:activeOrg');
  organization=organizations.find(o=>o.id===desired)||organizations[0]||null;
  renderOrganizations();
  if(!organization){
    tasks=[];processes=[];members=[];role=null;
    show(activeView==='legal'?'legal':'dashboard');
    renderInvitations();
    return;
  }
  sessionStorage.setItem('raf:activeOrg',organization.id);
  const org=organization.id;
  const results=await Promise.all([
    db.from('raf_memberships').select('organization_id,user_id,display_name,role,created_at').eq('organization_id',org).limit(200),
    db.from('raf_processes').select('id,organization_id,cnj_number,label,created_by,created_at,archived_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(500),
    db.from('raf_tasks').select('id,organization_id,process_id,title,description,status,priority,follow_up_date,assignee_id,created_by,created_at,updated_at,completed_at,archived_at').eq('organization_id',org).order('created_at',{ascending:false}).limit(1000)
  ]);
  [members,processes,tasks]=results.map(check);
  role=members.find(m=>m.user_id===currentUser.id)?.role||null;
  if(!role){notify('Seu perfil ainda não possui permissão neste ambiente.',true);organization=null;return}
  renderAll();
  show(activeView);
}
function renderAll(){
  renderOrganizations();renderInvitations();
  renderSummary();renderTasks();renderProcesses();renderKanban();
  renderTeam();renderReports();renderTaskOptions();
  for(const button of document.querySelectorAll('.newTaskBtn,#newProcessBtn'))button.disabled=!writable();
}

function activeTasks(){return tasks.filter(t=>!t.archived_at)}
function activeProcesses(){return processes.filter(p=>!p.archived_at)}
function canEditStatus(task){return writable()&&(manage()||task.assignee_id===currentUser.id||task.created_by===currentUser.id)}
function renderSummary(){
  const available=activeTasks();
  $('metricPending').textContent=available.filter(t=>t.status==='pending').length;
  $('metricProgress').textContent=available.filter(t=>t.status==='in_progress').length;
  $('metricUrgent').textContent=available.filter(t=>['urgent','high'].includes(t.priority)&&t.status!=='completed').length;
  $('metricCompleted').textContent=available.filter(t=>t.status==='completed').length;
  const rank={urgent:0,high:1,normal:2,low:3};
  const top=available.filter(t=>t.status!=='completed').sort((a,b)=>
    rank[a.priority]-rank[b.priority]||(a.follow_up_date||'9999').localeCompare(b.follow_up_date||'9999')).slice(0,6);
  renderTaskCards('priorityTasks',top);
}
function buildStatusSelect(task){
  const select=make('select');
  select.setAttribute('aria-label','Alterar situação da tarefa: '+task.title);
  for(const [key,label] of Object.entries(statuses)){
    const opt=make('option',null,label);
    opt.value=key;select.append(opt);
  }
  select.value=task.status;
  select.disabled=!canEditStatus(task);
  select.addEventListener('change',async()=>{
    const next=select.value;select.disabled=true;
    await changeStatus(task,next);
  });
  return select;
}
async function changeStatus(task,next){
  const before=task.status;
  if(!statuses[next]||before===next){renderAll();return}
  try{
    check(await db.from('raf_tasks').update({status:next}).eq('id',task.id).eq('organization_id',organization.id));
    await loadAll();
    notify('Situação alterada para '+statuses[next]);
  }catch(e){task.status=before;renderAll();notify('Não foi possível alterar a situação: '+e.message,true)}
}
function taskCard(task){
  const article=make('article','task-card task-priority-'+task.priority);
  const left=make('div');
  left.append(make('span','pill '+task.priority,priorities[task.priority]));
  left.append(make('h3',null,task.title));
  left.append(make('p',null,task.description||'Sem observações'));
  if(task.process_id){
    const process=processes.find(x=>x.id===task.process_id);
    left.append(make('p','task-date','Processo: '+(process?.cnj_number||'Referência restrita')));
  }
  const date=make('p','task-date'+(task.follow_up_date&&task.follow_up_date<new Date().toISOString().slice(0,10)&&task.status!=='completed'?' overdue':''),
    task.follow_up_date?'Acompanhar em '+humanDate(task.follow_up_date):'Sem data de acompanhamento');
  left.append(date);
  left.append(make('p','task-assignee','Responsável: '+(task.assignee_id?memberName(task.assignee_id):'Não atribuído')));
  const right=make('div','right');
  const group=make('div','action-row');
  group.append(buildStatusSelect(task));
  const details=make('button','card-action','Detalhes');
  details.type='button';details.addEventListener('click',()=>openTaskDetail(task));
  details.prepend(makeIcon('eye','raf-icon-sm'));
  group.append(details);
  if(manage()){
    const edit=make('button','card-action','Editar');edit.type='button';
    edit.addEventListener('click',()=>openTaskForm(task));edit.prepend(makeIcon('pencil','raf-icon-sm'));group.append(edit);
    const archive=make('button','card-action danger','Arquivar');
    archive.type='button';archive.addEventListener('click',()=>archiveTask(task));archive.prepend(makeIcon('archive','raf-icon-sm'));group.append(archive);
  }
  right.append(make('span','pill '+task.status,statuses[task.status]||task.status),group);
  article.append(left,right);
  return article;
}
function renderTaskCards(id,arr){
  const host=$(id);
  host.replaceChildren();
  if(!arr.length){host.append(empty('Nenhuma pendência encontrada.'));return}
  for(const task of arr)host.append(taskCard(task));
}
function renderTasks(){
  if(!organization)return;
  const q=clean($('taskSearch').value).toLocaleLowerCase('pt-BR');
  const s=$('taskStatus').value,priority=$('taskPriorityFilter').value;
  const assignee=$('taskAssigneeFilter').value,process=$('taskProcessFilter').value;
  renderTaskCards('allTasks',activeTasks().filter(t=>{
    const linked=processes.find(p=>p.id===t.process_id);
    const matchesText=!q||(t.title+' '+t.description+' '+(linked?.cnj_number||'')).toLocaleLowerCase('pt-BR').includes(q);
    return matchesText&&(!s||t.status===s)&&(!priority||t.priority===priority)
      &&(!assignee||t.assignee_id===assignee)&&(!process||t.process_id===process);
  }));
}
function renderProcesses(){
  if(!organization)return;
  const container=$('processList');container.replaceChildren();
  const q=clean($('processSearch').value).toLocaleLowerCase('pt-BR');
  const filtered=activeProcesses().filter(p=>(p.cnj_number+' '+p.label).toLocaleLowerCase('pt-BR').includes(q));
  if(!filtered.length){container.append(empty('Nenhum processo encontrado.'));return}
  for(const process of filtered){
    const row=make('article','process-card');
    const left=make('div','process-info');
    left.append(makeIcon('file-text','raf-icon-sm'),make('strong',null,process.cnj_number));
    left.append(make('span',null,process.label||'Sem identificação adicional'));
    left.append(make('small',null,activeTasks().filter(t=>t.process_id===process.id).length+' atividades vinculadas'));
    const actions=make('div','process-actions');
    if(manage()||process.created_by===currentUser.id){
      const edit=make('button','card-action','Editar');edit.type='button';
      edit.addEventListener('click',()=>openProcessForm(process));actions.append(edit);
      const archive=make('button','card-action danger','Arquivar');archive.type='button';
      archive.addEventListener('click',()=>archiveProcess(process));actions.append(archive);
    }
    row.append(left,actions);container.append(row);
  }
}
function renderKanban(){
  if(!organization)return;
  const host=$('kanbanBoard');host.replaceChildren();
  for(const [state,label] of Object.entries(statuses)){
    const col=make('section','kanban-column');
    col.dataset.status=state;
    const matching=activeTasks().filter(t=>t.status===state);
    const head=make('div','kanban-column-head');
    const columnTitle=make('h2');
    const columnIcons={pending:'clipboard-list',in_progress:'clock',waiting:'history',review:'eye',completed:'circle-check'};
    columnTitle.append(makeIcon(columnIcons[state]),document.createTextNode(label));
    head.append(columnTitle,make('span',null,matching.length));
    col.append(head);
    col.addEventListener('dragover',e=>{if(writable()){e.preventDefault();col.classList.add('drag-over')}});
    col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
    col.addEventListener('drop',e=>{
      col.classList.remove('drag-over');e.preventDefault();
      const id=e.dataTransfer.getData('text/plain');
      const task=tasks.find(t=>t.id===id);
      if(task&&canEditStatus(task))changeStatus(task,state);
    });
    for(const task of matching){
      const card=make('article','kanban-card');
      card.draggable=canEditStatus(task);
      card.tabIndex=0;
      card.setAttribute('aria-disabled',String(!canEditStatus(task)));
      card.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',task.id));
      card.append(make('span','pill '+task.priority,priorities[task.priority]));
      card.append(make('h3',null,task.title));
      card.append(make('p',null,task.assignee_id?memberName(task.assignee_id):'Não atribuído'));
      if(task.follow_up_date)card.append(make('p',null,'Acompanhar: '+humanDate(task.follow_up_date)));
      const open=make('button','card-action','Abrir detalhes');
      open.addEventListener('click',()=>openTaskDetail(task));
      open.prepend(makeIcon('eye','raf-icon-sm'));
      card.append(open);
      card.append(buildStatusSelect(task));
      col.append(card);
    }
    host.append(col);
  }
}
function renderTaskOptions(){
  const orgMembers=members.map(m=>({value:m.user_id,label:memberLabel(m)+' · '+roleNames[m.role]}));
  const availableProcesses=activeProcesses().map(p=>({value:p.id,label:p.cnj_number}));
  for(const id of ['taskAssignee','taskAssigneeFilter'])
    setSelect(id,orgMembers,id==='taskAssignee'?'Não atribuído':'Todos os responsáveis');
  for(const id of ['taskProcess','taskProcessFilter'])
    setSelect(id,availableProcesses,id==='taskProcess'?'Sem processo vinculado':'Todos os processos');
}

function renderTeam(){
  if(!organization)return;
  const list=$('memberList');list.replaceChildren();
  for(const member of members){
    const row=make('div','member-card');
    const info=make('div','member-identity');
    const avatar=make('span','member-avatar',memberLabel(member).charAt(0).toLocaleUpperCase('pt-BR'));
    const identity=make('div');
    identity.append(make('strong',null,memberLabel(member)));
    identity.append(make('small',null,member.user_id===currentUser.id?'Você':member.user_id.slice(0,8)+'…'));
    info.append(avatar,identity);
    const actions=make('div','member-actions');
    if(admin()&&member.user_id!==currentUser.id&&member.user_id!==organization.owner_id){
      const sel=make('select');
      sel.setAttribute('aria-label','Alterar papel de '+memberLabel(member));
      for(const [value,label] of Object.entries(roleNames)){
        const opt=make('option',null,label);opt.value=value;sel.append(opt);
      }
      sel.value=member.role;
      sel.addEventListener('change',()=>run(async()=>{
        if(!confirm('Confirmar alteração de permissão?')){sel.value=member.role;return false}
        check(await db.from('raf_memberships').update({role:sel.value})
          .eq('organization_id',organization.id).eq('user_id',member.user_id));
        await loadAll();
      },'Permissão atualizada'));
      actions.append(sel);
      const remove=make('button','card-action danger','Remover');
      remove.type='button';remove.addEventListener('click',()=>run(async()=>{
        if(!confirm('Remover acesso deste integrante ao ambiente?'))return false;
        check(await db.from('raf_memberships').delete().eq('organization_id',organization.id).eq('user_id',member.user_id));
        await loadAll();
      },'Acesso revogado'));
      actions.append(remove);
    }else actions.append(make('span','pill',roleNames[member.role]||member.role));
    row.append(info,actions);list.append(row);
  }
  const invitationList=$('inviteList');invitationList.replaceChildren();
  const own=invitations.filter(i=>i.organization_id===organization.id);
  for(const inv of own){
    const item=make('div','team-invite');
    item.append(make('strong',null,inv.email));
    item.append(make('small',null,(roleNames[inv.role]||inv.role)+' · '+({pending:'Aguardando aceite',accepted:'Aceito',revoked:'Revogado'}[inv.status]||inv.status)));
    if(admin()&&inv.status==='pending'){
      const revoke=make('button','card-action danger','Revogar convite');
      revoke.type='button';revoke.addEventListener('click',()=>run(async()=>{
        check(await db.from('raf_invitations').update({status:'revoked'}).eq('id',inv.id).eq('status','pending'));
        await loadAll();
      },'Convite revogado'));
      item.append(revoke);
    }
    invitationList.append(item);
  }
  if(!own.length)invitationList.append(empty('Nenhum convite registrado.'));
  $('inviteForm').hidden=!admin();
  const me=members.find(m=>m.user_id===currentUser.id);
  $('myDisplayName').value=me?.display_name||'';
}
function reportMetric(label,value,note){
  const tones={
    'Total de tarefas':['pending','clipboard-list'],
    'Em acompanhamento':['progress','clock'],
    'Data ultrapassada':['urgent','alert-triangle'],
    'Atribuídas a mim':['completed','user-round']
  };
  const [tone,icon]=tones[label]||['pending','chart-column'];
  const el=make('article','metric metric-'+tone);
  const top=make('div','metric-top');
  const badge=make('span','metric-symbol');
  badge.append(makeIcon(icon));
  top.append(make('span',null,label),badge);
  el.append(top,make('strong',null,value),make('small',null,note));
  return el;
}
function reportBars(items){
  const list=make('div','report-breakdown');
  const max=Math.max(1,...items.map(x=>x.value));
  for(const item of items){
    const row=make('div','report-bar-row');
    const track=make('div','report-track');
    const bar=make('span');bar.style.width=Math.max(0,item.value/max*100)+'%';
    track.append(bar);
    row.append(make('span',null,item.label),track,make('span','report-count',item.value));
    list.append(row);
  }
  return list;
}
function renderReports(){
  if(!organization)return;
  const all=activeTasks();
  const overdue=all.filter(t=>t.follow_up_date&&t.follow_up_date<new Date().toISOString().slice(0,10)&&t.status!=='completed').length;
  const own=all.filter(t=>t.assignee_id===currentUser.id).length;
  const host=$('reportStats');
  host.replaceChildren(
    reportMetric('Total de tarefas',all.length,'Registros visíveis'),
    reportMetric('Em acompanhamento',all.filter(x=>x.status!=='completed').length,'Não concluídas'),
    reportMetric('Data ultrapassada',overdue,'Acompanhamento administrativo'),
    reportMetric('Atribuídas a mim',own,'Sua carga visível')
  );
  const body=$('reportSummary');body.replaceChildren();
  body.append(make('h3',null,'Por situação'),reportBars(Object.entries(statuses).map(([key,label])=>({label,value:all.filter(x=>x.status===key).length}))));
  body.append(make('h3',null,'Por prioridade'),reportBars(Object.entries(priorities).map(([key,label])=>({label,value:all.filter(x=>x.priority===key).length}))));
}
function formatEvent(event){
  const action={created:'Pendência criada',updated:'Pendência atualizada',commented:'Comentário registrado'}[event.action]||event.action;
  const text=event.action==='updated'?
     'Alteração registrada no banco de dados; data e responsável preservados.':
     event.action==='created'?'Novo registro incluído.':'Nova observação na atividade.';
  return {action,text};
}
function timelineEvent(event){
  const wrap=make('article','timeline-event');
  wrap.append(make('div','timeline-symbol','◷'));
  const body=make('div');
  const desc=formatEvent(event);
  body.append(make('strong',null,desc.action));
  body.append(make('small',null,humanDate(event.created_at)+' · '+(event.actor_id?memberName(event.actor_id):'Sistema')));
  body.append(make('p',null,desc.text));wrap.append(body);
  return wrap;
}
async function loadHistory(){
  if(!organization)return;
  const host=$('historyList');host.replaceChildren(empty('Carregando histórico…'));
  try{
    const data=check(await db.from('raf_task_events').select('id,task_id,actor_id,action,created_at')
      .eq('organization_id',organization.id).order('created_at',{ascending:false}).limit(300));
    host.replaceChildren();
    if(!data.length){host.append(empty('Sem alterações registradas para os itens acessíveis.'));return}
    for(const event of data)host.append(timelineEvent(event));
  }catch(e){host.replaceChildren(empty('Histórico indisponível: '+e.message))}
}
function escapeCsv(value){
  let text=String(value??'').replace(/[\r\n]+/g,' ');
  if(/^[=+@\-\t]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
function exportCSV(){
  if(!organization)return;
  const header=['Título','Situação','Prioridade','Responsável','Data de acompanhamento','Processo','Criada em'];
  const rows=activeTasks().map(t=>{
    const process=processes.find(p=>p.id===t.process_id);
    return [t.title,statuses[t.status],priorities[t.priority],t.assignee_id?memberName(t.assignee_id):'',t.follow_up_date||'',process?.cnj_number||'',t.created_at];
  });
  const csv='\ufeff'+[header,...rows].map(line=>line.map(escapeCsv).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=make('a');link.href=url;link.download='raf-relatorio-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('Relatório CSV gerado apenas com os registros acessíveis.');
}

function openTaskForm(task=null){
  if(!organization||!writable())return;
  if(task&&!manage()){notify('Seu perfil pode apenas atualizar a situação desta tarefa.',true);return}
  $('taskForm').reset();
  $('taskId').value=task?.id||'';
  $('taskDialogTitle').textContent=task?'Editar pendência':'Nova pendência';
  $('saveTask').textContent=task?'Salvar alterações':'Cadastrar pendência';
  $('taskTitle').value=task?.title||'';
  $('taskDescription').value=task?.description||'';
  $('taskPriority').value=task?.priority||'normal';
  $('taskStatusEdit').value=task?.status||'pending';
  $('taskFollowup').value=task?.follow_up_date||'';
  $('taskAssignee').value=task?.assignee_id||'';
  $('taskProcess').value=task?.process_id||'';
  // Operators can create new personal tasks but cannot assign to other people.
  $('taskAssignee').disabled=!manage();
  $('taskProcess').disabled=false;
  $('taskDialog').showModal();
}
function openProcessForm(process=null){
  if(!organization||!writable())return;
  $('processForm').reset();
  $('processId').value=process?.id||'';
  $('processDialogTitle').textContent=process?'Editar referência':'Novo processo';
  $('cnjNumber').value=process?.cnj_number||'';
  $('cnjNumber').readOnly=!!process;
  $('processLabel').value=process?.label||'';
  $('processDialog').showModal();
}
async function archiveTask(task){
  if(!manage()||!confirm('Arquivar esta pendência? O histórico será preservado.'))return;
  await run(async()=>{
    check(await db.from('raf_tasks').update({archived_at:new Date().toISOString()})
      .eq('organization_id',organization.id).eq('id',task.id));
    await loadAll();
  },'Pendência arquivada sem apagar o histórico.');
}
async function archiveProcess(process){
  if(!confirm('Arquivar o cadastro deste processo? As tarefas vinculadas serão mantidas.'))return;
  await run(async()=>{
    check(await db.from('raf_processes').update({archived_at:new Date().toISOString()})
      .eq('organization_id',organization.id).eq('id',process.id));
    await loadAll();
  },'Processo arquivado.');
}
async function openTaskDetail(task){
  selectedTask=task;
  $('taskDetailTitle').textContent=task.title;
  const process=processes.find(p=>p.id===task.process_id);
  $('taskDetailMeta').textContent=[
    'Situação: '+statuses[task.status],
    'Prioridade: '+priorities[task.priority],
    'Responsável: '+(task.assignee_id?memberName(task.assignee_id):'Não atribuído'),
    'Processo: '+(process?.cnj_number||'Tarefa avulsa'),
    'Acompanhamento: '+humanDate(task.follow_up_date),
    'Criada em: '+humanDate(task.created_at)
  ].join('\n');
  $('editFromDetail').hidden=!manage();
  $('commentForm').hidden=!writable();
  $('taskComments').replaceChildren(empty('Carregando comentários…'));
  $('taskHistory').replaceChildren(empty('Carregando histórico…'));
  $('taskDetailDialog').showModal();
  await loadTaskDiscussion(task.id);
}
async function loadTaskDiscussion(id){
  if(!organization)return;
  try{
    const [commentsResult,eventsResult]=await Promise.all([
      db.from('raf_task_comments').select('id,author_id,body,created_at')
        .eq('organization_id',organization.id).eq('task_id',id)
        .order('created_at',{ascending:true}).limit(150),
      db.from('raf_task_events').select('id,actor_id,action,created_at')
        .eq('organization_id',organization.id).eq('task_id',id)
        .order('created_at',{ascending:false}).limit(100)
    ]);
    const comments=check(commentsResult),events=check(eventsResult);
    // Ignore stale async response if a different card was opened meanwhile.
    if(selectedTask?.id!==id)return;
    const host=$('taskComments');host.replaceChildren();
    if(!comments.length)host.append(empty('Nenhum comentário ainda.'));
    for(const comment of comments){
      const card=make('article','comment');
      card.append(make('span',null,memberName(comment.author_id)+' · '+humanDate(comment.created_at)));
      card.append(make('p',null,comment.body));host.append(card);
    }
    const timeline=$('taskHistory');timeline.replaceChildren();
    if(!events.length)timeline.append(empty('Nenhum evento encontrado.'));
    for(const event of events)timeline.append(timelineEvent(event));
  }catch(e){$('taskComments').replaceChildren(empty('Erro de leitura: '+e.message))}
}
function validateCnj(value){
  const match=/^([0-9]{7})-([0-9]{2})\.([0-9]{4})\.([0-9])\.([0-9]{2})\.([0-9]{4})$/.exec(value);
  if(!match)return false;
  const digits=match[1]+match[3]+match[4]+match[5]+match[6]+'00';
  let remainder=0;
  for(const digit of digits)remainder=(remainder*10+Number(digit))%97;
  return Number(match[2])===98-remainder;
}
async function saveTask(event){
  event.preventDefault();
  if(!organization||!writable())return;
  const id=$('taskId').value;
  const title=clean($('taskTitle').value);
  if(title.length<3){notify('Informe um título com pelo menos 3 caracteres.',true);return}
  const row={
    title,description:clean($('taskDescription').value),
    priority:$('taskPriority').value,status:$('taskStatusEdit').value,
    follow_up_date:$('taskFollowup').value||null,
    process_id:$('taskProcess').value||null
  };
  if(manage())row.assignee_id=$('taskAssignee').value||null;
  await run(async()=>{
    if(id){
      if(!manage())throw Error('A edição detalhada está restrita a gestores.');
      check(await db.from('raf_tasks').update(row)
        .eq('id',id).eq('organization_id',organization.id));
    }else{
      row.organization_id=organization.id;
      row.created_by=currentUser.id;
      check(await db.from('raf_tasks').insert(row));
    }
    $('taskDialog').close();
    await loadAll();
  },id?'Pendência atualizada.':'Pendência criada.');
}
async function saveProcess(event){
  event.preventDefault();
  if(!organization)return;
  const id=$('processId').value;
  const cnj=clean($('cnjNumber').value),label=clean($('processLabel').value);
  if(!validateCnj(cnj)){notify('Número CNJ inválido: confira os dígitos verificadores.',true);return}
  await run(async()=>{
    if(id){
      check(await db.from('raf_processes').update({label})
        .eq('id',id).eq('organization_id',organization.id));
    }else{
      check(await db.from('raf_processes').insert({organization_id:organization.id,
        created_by:currentUser.id,cnj_number:cnj,label}));
    }
    $('processDialog').close();
    await loadAll();
  },id?'Referência atualizada.':'Processo cadastrado.');
}

async function submitInvitation(event){
  event.preventDefault();
  if(!admin())return;
  const email=clean($('inviteEmail').value).toLowerCase();
  const inviteRole=$('inviteRole').value;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){notify('E-mail de convite inválido.',true);return}
  await run(async()=>{
    check(await db.from('raf_invitations').insert({
      organization_id:organization.id,email,role:inviteRole,invited_by:currentUser.id
    }));
    $('inviteForm').reset();
    await loadAll();
  },'Convite registrado. O destinatário deve possuir conta autorizada e entrar no RAF para aceitar.');
}
async function submitComment(event){
  event.preventDefault();
  if(!selectedTask||!organization||!writable())return;
  const text=clean($('commentText').value);
  if(!text||text.length>1500)return;
  await run(async()=>{
    check(await db.from('raf_task_comments').insert({
      task_id:selectedTask.id,organization_id:organization.id,
      author_id:currentUser.id,body:text
    }));
    $('commentText').value='';
    await loadTaskDiscussion(selectedTask.id);
  },'Comentário registrado com histórico de autoria.');
}
async function submitProfile(event){
  event.preventDefault();
  if(!organization)return;
  const display_name=clean($('myDisplayName').value);
  await run(async()=>{
    check(await db.from('raf_memberships').update({display_name:display_name||null})
      .eq('organization_id',organization.id).eq('user_id',currentUser.id));
    await loadAll();
  },'Identificação atualizada.');
}
async function createOrganization(event){
  event.preventDefault();
  const name=clean($('newOrgName').value);
  if(name.length<2){notify('Informe pelo menos dois caracteres.',true);return}
  await run(async()=>{
    const row=check(await db.from('raf_organizations').insert({
      name,owner_id:currentUser.id
    }).select('id').single());
    sessionStorage.setItem('raf:activeOrg',row.id);
    $('organizationForm').reset();
    await loadAll();
  },'Seu ambiente foi criado com perfil de administrador.');
}
async function signIn(event){
  event.preventDefault();
  const button=$('loginForm').querySelector('button[type="submit"]');
  button.disabled=true;$('loginError').hidden=true;
  try{
    const data=check(await db.auth.signInWithPassword({
      email:clean($('email').value),password:$('password').value
    }));
    await enter(data.session);
    $('password').value='';
  }catch(error){
    $('loginError').textContent='Não foi possível entrar. Confira a conta e a senha ou solicite acesso ao administrador.';
    $('loginError').hidden=false;
  }finally{button.disabled=false}
}
async function signOut(){
  try{check(await db.auth.signOut());await enter(null)}
  catch(e){notify('Não foi possível encerrar a sessão. Tente novamente.',true)}
}
function wireUI(){
  $('loginForm').addEventListener('submit',signIn);
  $('logoutBtn').addEventListener('click',signOut);
  $('organizationForm').addEventListener('submit',createOrganization);
  $('organizationSelect').addEventListener('change',()=>{
    if(!currentUser)return;
    sessionStorage.setItem('raf:activeOrg',$('organizationSelect').value);
    loadAll().catch(e=>notify('Não foi possível alternar o ambiente: '+e.message,true));
  });
  $('taskForm').addEventListener('submit',saveTask);
  $('processForm').addEventListener('submit',saveProcess);
  $('commentForm').addEventListener('submit',submitComment);
  $('inviteForm').addEventListener('submit',submitInvitation);
  $('profileForm').addEventListener('submit',submitProfile);
  for(const button of document.querySelectorAll('.newTaskBtn')){
    button.addEventListener('click',()=>openTaskForm());
  }
  $('newProcessBtn').addEventListener('click',()=>openProcessForm());
  $('editFromDetail').addEventListener('click',()=>{
    if(!selectedTask)return;
    const task=selectedTask;
    $('taskDetailDialog').close();
    openTaskForm(task);
  });
  for(const button of document.querySelectorAll('[data-close]')){
    button.addEventListener('click',()=>$(button.dataset.close).close());
  }
  for(const link of document.querySelectorAll('[data-view]')){
    link.addEventListener('click',e=>{e.preventDefault();show(link.dataset.view)});
  }
  for(const button of document.querySelectorAll('[data-go]')){
    button.addEventListener('click',()=>show(button.dataset.go));
  }
  $('menuBtn').setAttribute('aria-expanded','false');
  $('menuBtn').setAttribute('aria-controls','mainSidebar');
  $('menuBtn').addEventListener('click',()=>{
    const open=document.querySelector('.sidebar').classList.toggle('open');
    $('navScrim').hidden=!open;
    $('menuBtn').setAttribute('aria-expanded',String(open));
  });
  $('navScrim').addEventListener('click',()=>{
    document.querySelector('.sidebar').classList.remove('open');
    $('navScrim').hidden=true;
    $('menuBtn').setAttribute('aria-expanded','false');
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&document.querySelector('.sidebar').classList.contains('open')){
      document.querySelector('.sidebar').classList.remove('open');
      $('navScrim').hidden=true;
      $('menuBtn').setAttribute('aria-expanded','false');
      $('menuBtn').focus();
    }
  });
  $('taskSearch').addEventListener('input',renderTasks);
  $('taskStatus').addEventListener('change',renderTasks);
  $('taskPriorityFilter').addEventListener('change',renderTasks);
  $('taskAssigneeFilter').addEventListener('change',renderTasks);
  $('taskProcessFilter').addEventListener('change',renderTasks);
  $('processSearch').addEventListener('input',renderProcesses);
  $('exportCSV').addEventListener('click',exportCSV);
  $('printReport').addEventListener('click',()=>window.print());
  $('reloadHistory').addEventListener('click',loadHistory);
  for(const dialog of document.querySelectorAll('dialog')){
    dialog.addEventListener('click',event=>{
      if(event.target===dialog)dialog.close();
    });
  }
}
async function start(){
  if(initDone)return;
  initDone=true;
  initLegalView(notify);
  wireUI();
  try{
    const {data:{session},error}=await db.auth.getSession();
    if(error)throw error;
    if(session){
      const result=await db.auth.getUser();
      if(result.error)throw result.error;
      await enter(session);
    }else await enter(null);
  }catch(e){
    await enter(null);
    notify('Sessão indisponível: '+e.message,true);
  }
  db.auth.onAuthStateChange((event,session)=>{
    // Não iniciar consultas Supabase dentro do próprio callback do Auth.
    if(event==='SIGNED_OUT')setTimeout(()=>enter(null),0);
    if(event==='SIGNED_IN'&&session&&(!currentUser||currentUser.id!==session.user.id))
      setTimeout(()=>enter(session).catch(e=>notify(e.message,true)),0);
  });
}
start().catch(error=>{
  $('loginError').textContent='O sistema não iniciou corretamente. Recarregue a página.';
  $('loginError').hidden=false;
  console.warn('RAF initialization failed:',error?.name);
});
