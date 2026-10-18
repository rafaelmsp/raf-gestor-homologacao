import {legalReferences,regularizationSteps,legalGroups} from './legal-basis.js';

function el(tag,className,text) {
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
}
function referenceCard(item) {
  const details=el('details','legal-reference');
  const summary=el('summary','legal-reference-summary');
  const badge=el('span','legal-reference-number',item.number);
  const heading=el('span','legal-reference-heading');
  heading.append(el('strong',null,item.theme),el('small',null,item.title));
  summary.append(badge,heading,el('span','legal-chevron','⌄'));
  details.append(summary);
  const body=el('div','legal-reference-body');
  const meaningful=el('p',null,item.summary);
  const limit=el('p','legal-boundary');
  limit.append(el('strong',null,'Limite de aplicação: '),document.createTextNode(item.limitation));
  const link=el('a','legal-source-link','Consultar texto oficial ↗');
  link.href=item.url;
  link.target='_blank';
  link.rel='noopener noreferrer';
  link.setAttribute('aria-label','Consultar '+item.source+' em site oficial');
  body.append(meaningful,limit,link);
  details.append(body);
  return details;
}
function formatMemo() {
  return [
    'MINUTA — SOLICITAÇÃO DE ANÁLISE INSTITUCIONAL',
    'Assunto: Proposta de avaliação de protótipo privado de gestão de pendências',
    '',
    'À Chefia da Unidade e aos setores competentes de Tecnologia da Informação,',
    '',
    'Apresento, para conhecimento e eventual avaliação, o protótipo RAF — Gestor de Pendências,',
    'uma ferramenta experimental destinada à organização de tarefas e ao acompanhamento',
    'administrativo, sem integração com sistemas oficiais e sem pretensão de substituir',
    'o PJe ou os procedimentos institucionalmente aprovados.',
    '',
    'Fundamentos para apreciação, sem alegação de autorização prévia:',
    '• Constituição Federal, art. 37, caput (eficiência administrativa).',
    '• Lei nº 14.129/2021, arts. 2º e 3º (aplicabilidade condicionada a ato local).',
    '• Lei nº 11.788/2008 (estágio supervisionado e adequação às atividades pactuadas).',
    '• Lei nº 9.609/1998, art. 4º e § 3º (autoria e titularidade de software).',
    '• Lei nº 13.709/2018, arts. 6º, 23, 26, 33 e 46 (LGPD).',
    '• Resoluções CNJ nº 363/2021 e nº 396/2021.',
    '• Resolução OE/TJRJ nº 20/2026 (política de segurança da informação).',
    '',
    'Solicito, caso haja interesse institucional, orientação formal sobre:',
    '1. Compatibilidade do projeto com as atividades e a supervisão pertinentes;',
    '2. Exigências de TI, segurança, privacidade e avaliação de fornecedor externo;',
    '3. Titularidade, autoria e eventual instrumento jurídico de uso;',
    '4. Eventual autorização expressa para homologação e/ou utilização institucional.',
    '',
    'Até a conclusão dessas análises, não haverá inserção de dados processuais',
    'reais, importação de dados oficiais nem utilização como sistema do órgão.',
    '',
    'Material não oficial — minuta para adaptação e análise jurídica.',
    'Data de referência das normas consultadas: 18/10/2026.'
  ].join('\n');
}
async function copyText(value){
  if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(value);
    return;
  }
  // Navegadores mais antigos com usuário autenticado e gesto de clique.
  const textarea=document.createElement('textarea');
  textarea.value=value;
  textarea.setAttribute('aria-hidden','true');
  textarea.style.cssText='position:fixed;left:-9999px;top:0';
  document.body.append(textarea);
  textarea.select();
  const ok=document.execCommand('copy');
  textarea.remove();
  if(!ok)throw new Error('Recurso de cópia indisponível.');
}
function renderChecklist(notice){
  const host=document.getElementById('legalChecklist');
  const count=document.getElementById('legalChecklistCount');
  const checks=[];
  for(const item of regularizationSteps){
    const label=el('label','legal-check-row');
    const input=el('input');
    input.type='checkbox';
    input.value=item.id;
    input.setAttribute('aria-label',item.text);
    checks.push(input);
    const span=el('span',null,item.text);
    label.append(input,span);
    host.append(label);
    input.addEventListener('change',()=>{
      const n=checks.filter(box=>box.checked).length;
      count.textContent=`${n} de ${checks.length} etapas assinaladas (registro apenas visual)`;
    });
  }
  count.textContent=`0 de ${regularizationSteps.length} etapas assinaladas (registro apenas visual)`;
  const button=document.getElementById('copyChecklist');
  button.addEventListener('click',async()=>{
    const text=['ROTEIRO PREPARATÓRIO — SEM VALIDADE DE AUTORIZAÇÃO',...regularizationSteps.map((x,i)=>`${checks[i].checked?'[x]':'[ ]'} ${x.text}`),'','Assinalar etapas no navegador não constitui aprovação do órgão.'].join('\n');
    try{await copyText(text);notice('Roteiro copiado. Não substitui aprovação institucional.')}
    catch(_){notice('Não foi possível copiar. Use a seleção manual do texto.')}
  });
}
export function initLegalView(notice){
  const sections=document.getElementById('legalNormGroups');
  if(!sections)return;
  for(const group of legalGroups){
    const section=el('section','legal-group');
    const heading=el('div','legal-group-heading');
    heading.append(el('h3',null,group.label),el('p',null,group.note));
    section.append(heading);
    for(const norm of legalReferences.filter(ref=>ref.group===group.id)) section.append(referenceCard(norm));
    sections.append(section);
  }
  renderChecklist(notice);
  document.getElementById('copyLegalMemo').addEventListener('click',async()=>{
    try{await copyText(formatMemo());notice('Minuta copiada para revisão antes do envio.')}
    catch(_){notice('Não foi possível copiar a minuta neste navegador.')}
  });
  const references=[...document.querySelectorAll('.legal-reference')];
  let expandedBeforePrinting=null;
  window.addEventListener('beforeprint',()=>{
    expandedBeforePrinting=references.map(item=>item.open);
    references.forEach(item=>{item.open=true});
  });
  window.addEventListener('afterprint',()=>{
    if(!expandedBeforePrinting)return;
    references.forEach((item,i)=>{item.open=expandedBeforePrinting[i]});
    expandedBeforePrinting=null;
  });
  document.getElementById('printLegal').addEventListener('click',()=>window.print());
}
