// Referências públicas verificadas em 18/10/2026. Material informativo não vinculante.
// Não há aqui autorização institucional, cessão de propriedade intelectual ou avaliação jurídica individual.
export const legalReferences = Object.freeze([
  {
    id: 'cf37', group:'proposta', number:'01',
    title:'Constituição Federal — art. 37, caput',
    theme:'Eficiência administrativa',
    summary:'A eficiência é princípio da Administração Pública e ajuda a justificar uma proposta de melhoria dos procedimentos.',
    limitation:'Não autoriza, por si, instalar software, usar equipamentos institucionais ou tratar dados de processos.',
    source:'Planalto · Constituição Federal',
    url:'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm'
  },
  {
    id:'digital', group:'proposta', number:'02',
    title:'Lei nº 14.129/2021 — arts. 2º e 3º',
    theme:'Modernização e Governo Digital',
    summary:'Desburocratização e modernização são diretrizes importantes para projetos digitais na Administração.',
    limitation:'A aplicação aos demais entes federados depende de adoção por atos normativos próprios (art. 2º, III). Não é autorização para um sistema particular no TJRJ.',
    source:'Planalto · Lei de Governo Digital',
    url:'https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14129.htm'
  },
  {
    id:'estagio', group:'proposta', number:'03',
    title:'Lei nº 11.788/2008 — arts. 1º, 3º e 9º',
    theme:'Atividade de estágio supervisionado',
    summary:'O estágio é ato educativo supervisionado, compatível com o termo de compromisso e acompanhado por orientadores e supervisores.',
    limitation:'Uma iniciativa de software dentro do órgão deve respeitar as atividades previstas no estágio e as orientações da instituição; não amplia atribuições nem dispensa autorização.',
    source:'Planalto · Lei do Estágio',
    url:'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11788.htm'
  },
  {
    id:'software', group:'autoria', number:'04',
    title:'Lei nº 9.609/1998 — arts. 2º e 4º, §§ 2º e 3º',
    theme:'Autoria e titularidade do software',
    summary:'A autoria de um programa pode ser identificada e documentada. A titularidade patrimonial depende das circunstâncias de desenvolvimento e do vínculo.',
    limitation:'O art. 4º prevê direitos do empregador, contratante ou órgão em hipóteses específicas; seu § 3º alcança estagiários. Desenvolvimento independente exige ausência de relação com o vínculo e de uso de recursos ou informações do órgão. Registro de autoria não resolve, sozinho, a titularidade.',
    source:'Planalto · Lei do Software',
    url:'https://www.planalto.gov.br/ccivil_03/leis/l9609.htm'
  },
  {
    id:'lgpd', group:'condicoes', number:'05',
    title:'Lei nº 13.709/2018 — LGPD, arts. 6º, 23, 26, 33 e 46',
    theme:'Dados pessoais e hospedagem externa',
    summary:'Tratamentos de dados precisam de finalidade, base legal, segurança, minimização e regras próprias para o Poder Público e transferências internacionais.',
    limitation:'O ambiente Supabase usado nos testes está na região dos EUA. Não inserir dados reais da serventia ou dos autos sem avaliação formal do órgão, da TI, do encarregado de dados e dos requisitos para fornecedor e transferência internacional.',
    source:'Planalto · LGPD',
    url:'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm'
  },
  {
    id:'lai', group:'condicoes', number:'06',
    title:'Lei nº 12.527/2011 — arts. 6º e 31',
    theme:'Proteção de dados e informações restritas',
    summary:'Transparência não elimina os deveres de proteger informações sigilosas e pessoais.',
    limitation:'O fato de um processo ser consultável publicamente não autoriza copiar integralmente seus dados para uma ferramenta pessoal.',
    source:'Planalto · Lei de Acesso à Informação',
    url:'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm'
  },
  {
    id:'cnj363', group:'condicoes', number:'07',
    title:'Resolução CNJ nº 363/2021',
    theme:'Adequação dos tribunais à LGPD',
    summary:'Prevê medidas de adequação à proteção de dados no âmbito dos tribunais.',
    limitation:'O projeto precisa aderir às diretrizes, políticas e decisões administrativas aplicáveis ao tribunal; o texto não aprova a adoção do RAF.',
    source:'CNJ · Atos normativos',
    url:'https://atos.cnj.jus.br/atos/detalhar/3668'
  },
  {
    id:'cnj396', group:'condicoes', number:'08',
    title:'Resolução CNJ nº 396/2021',
    theme:'Segurança cibernética do Judiciário',
    summary:'Institui a Estratégia Nacional de Segurança Cibernética do Poder Judiciário, incluindo proteção de ativos e informações.',
    limitation:'Exige avaliação de riscos e aderência às regras de TI e segurança; não permite integrar sistemas ou usar dados institucionais sem autorização.',
    source:'CNJ · Atos normativos',
    url:'https://atos.cnj.jus.br/atos/detalhar/3975'
  },
  {
    id:'tjrjpsi', group:'condicoes', number:'09',
    title:'Resolução OE/TJRJ nº 20/2026',
    theme:'Política de Segurança da Informação do PJERJ',
    summary:'É a política de segurança da informação atualmente publicada para o Judiciário fluminense e substitui a Resolução OE nº 9/2024.',
    limitation:'Antes de qualquer uso institucional é indispensável submeter a proposta aos setores competentes, verificar a conformidade com a PSI e obter as aprovações pertinentes.',
    source:'TJRJ · Política de Segurança da Informação',
    url:'https://www.tjrj.jus.br/lgpd/politica-de-seguranca-da-informacao'
  }
]);

export const regularizationSteps = Object.freeze([
  {id:'scope', text:'Descrever formalmente finalidade, limites e benefícios do protótipo, sem atribuir caráter oficial ao RAF.'},
  {id:'supervisor',text:'Apresentar a proposta à chefia/supervisão, respeitando o termo de compromisso e as atribuições do estágio.'},
  {id:'ti',text:'Solicitar avaliação escrita das unidades competentes de TI e Segurança da Informação antes de uso em ambiente institucional.'},
  {id:'privacy',text:'Submeter tratamento de dados e fornecedor externo ao responsável institucional e ao encarregado de dados, incluindo a hospedagem nos EUA.'},
  {id:'ownership',text:'Documentar autoria, datas, equipamentos e recursos empregados; esclarecer titularidade e eventual cessão/licença conforme Lei nº 9.609/1998.'},
  {id:'testing',text:'Realizar homologação técnica e de segurança exclusivamente com dados fictícios, mantendo o RAF separado do PJe.'},
  {id:'authorization',text:'Obter autorização institucional expressa e registrada antes de inserir dados reais ou oferecer uso à equipe.'}
]);

export const legalGroups = Object.freeze([
  {id:'proposta',label:'Fundamentos para apresentar a proposta',note:'Justificam a discussão de melhorias, sem dispensar procedimentos administrativos.'},
  {id:'autoria',label:'Autoria, direitos e documentação técnica',note:'A autoria pode ser reconhecida; a titularidade patrimonial deve ser analisada.'},
  {id:'condicoes',label:'Limites e condições do uso institucional',note:'Aplicam-se controles de acesso, sigilo e segurança, além de autorização.'}
]);
