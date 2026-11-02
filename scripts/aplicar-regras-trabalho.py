from pathlib import Path
import re,json,argparse
p=Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description='Aplica regras de trabalho à fonte atual exportada, preservando alterações concorrentes. Não publica nem liga a serviços.')
parser.add_argument('source',type=Path)
parser.add_argument('output',type=Path)
args=parser.parse_args()
assert args.source.resolve()!=args.output.resolve(),'Usar um ficheiro de saída diferente.'
s=args.source.read_text(encoding='utf-8')
assert 'function pfCampos_(' not in s,'Regras já presentes: não repetir automaticamente.'
def sub(old,new):
 global s
 assert old in s,old[:100]
 s=s.replace(old,new)
# Fonte atual do Claude é a base; não regenerar a partir de módulos antigos.
s=re.sub(r'const DOCS = \[[\s\S]*?\n\];', 'const DOCS = []; // Upload documental dispensado; histórico preservado.',s,count=1)
sub("['planta','Planta','Planta']","['planta','Planta','Planta'],\n  ['energia','Classe energética','Classe energética']")
sub('ED_CAMPOS.forEach','pfCampos_().forEach')
sub("campos:ED_CAMPOS.map(x=>({id:x[0],nome:x[2]}))","campos:pfCampos_().map(x=>({id:x[0],nome:x[2],opcoes:pfOpcoes_(x)}))")
sub("if(r[2]!=='Documentos')return null;","if(r[2]==='Energia'&&r[3]==='Classe energética')return ED_CAMPOS[5];\n  return null; // Os anexos antigos já não sincronizam trabalho ativo.\n  if(r[2]!=='Documentos')return null;")
sub("function edEstado_(valor,nota,nome){","function edEstado_(valor,nota,nome){\n  if(nome==='Classe energética')return pfEnergia_(valor);")
sub("function edAcao_(estado,nome){","function edAcao_(estado,nome){\n  if(nome==='Classe energética')return pfEnergiaPreenchida_(estado)?'':'Conferir a letra energética > preencher no eGO. Sem upload de ficheiro.';")
sub("pfCampos_().forEach(x=>{\n      if(campo===x", "pfCampos_().forEach(x=>{\n      if(x[0]==='energia')return; // A letra só vem do campo explícito, nunca do estado da tarefa.\n      if(campo===x")
sub("if(!ED_ESTADOS.includes(estado))throw Error('Estado não reconhecido: '+x[2]);","if(!pfOpcoes_(x).includes(estado))throw Error('Estado não reconhecido: '+x[2]);")
sub("const fechado=['Preenchido','Não aplicável'].includes(estado);","const fechado=['Preenchido','Não aplicável'].includes(estado)||x[0]==='energia'&&pfEnergiaPreenchida_(estado);")
sub("x[0]==='planta'?'Plantas':'Documentos'","x[0]==='planta'?'Plantas':x[0]==='energia'?'Energia':'Documentos'")
sub("const status=estado==='Preenchido'?'Concluído'","const status=estado==='Preenchido'||x[0]==='energia'&&pfEnergiaPreenchida_(estado)?'Concluído'")
sub("const status=estado==='Preenchido'||x[0]", "const status=estado==='N/A'?'Não aplicável':estado==='Preenchido'||x[0]")
sub("if(!estados||!ED_ESTADOS.includes(estados[x[0]]))throw Error('Confirma os cinco estados.');","if(!estados||!pfOpcoes_(x).includes(estados[x[0]]))throw Error('Confirma a planta e a letra energética.');")
sub("if(nome===LEV.nome&&(r.getLastRow()<10||r.getColumn()>24))return;","if(nome===LEV.nome&&(r.getLastRow()<10||r.getColumn()>36))return;")
sub("const status=v[8],etat=status==='Concluído'?'Preenchido':ED_ESTADOS.includes(status)?status:null;","const status=v[8],etat=x[0]==='energia'?(status==='Concluído'?null:PF_ENERGIA.includes(status)?status:null):status==='Concluído'?'Preenchido':ED_ESTADOS.includes(status)?status:null;")
# Não transformar conclusão de tarefa em letra inventada. Atualização da classe é sempre explícita.
sub("edConfigurarDropdowns_(ss,ED_CAMPOS.map(x=>({nome:LEV.nome,col:c.col(x[1]),opcoes:valores,substituir:true}))","edConfigurarDropdowns_(ss,pfCampos_().map(x=>({nome:LEV.nome,col:c.col(x[1]),opcoes:x[0]==='energia'?PF_ENERGIA:valores,substituir:true}))")
# Coletor individual e em lote: nunca reabrir os anexos dispensados.
sub("if (!completa) notas.push('Levantamento em curso: confirma os quatro documentos, os cinco idiomas e os dados de imagens, planta, vídeo e folheto.');","if (!completa) notas.push('Levantamento em curso: confirma os idiomas, fotos, planta JPEG, vídeo e folheto. A letra energética é conferida por referência em eGO: estado. Não é necessário upload de documentação.');\n  desconhecido('Classe energética');")
sub("/jpg|png|webp|gif/.test(e)","/^(jpg|jpeg)$/.test(e)")
sub("['Planta','Imóvel sem planta','Planta só em PDF']", "['Planta','Imóvel sem planta','Planta só em PDF','Planta em formato errado']")
sub("nova('Plantas', 'Planta só em PDF',", "nova('Plantas', 'Planta em formato errado',")
sub("pode('Imóvel sem planta'); pode('Planta só em PDF');", "pode('Imóvel sem planta'); pode('Planta só em PDF'); pode('Planta em formato errado');")
sub("individuais:['Imóvel sem planta','Planta só em PDF','Planta']", "individuais:['Imóvel sem planta','Planta só em PDF','Planta em formato errado','Planta']")
sub("else if (!img && pdf)","else if (!img && d.plantas.length)")
sub("pdf + ' planta(s) só em PDF: não são exportadas para os portais'","'planta sem versão JPEG'")
sub("'O site mostra ' + pdf + ' planta(s) em PDF' + fonte + '. Plantas em PDF não são exportadas para os portais.'","'A planta recolhida não está em JPEG' + fonte + '.'")
sub("AP_CAMPOS=['Imagens','Alt-text','Descrição PT','Descrição EN','Descrição FR','Descrição DE','Descrição ES','Características','Vídeo','Planta','Caderneta Predial (anexo)','Certificado Energético (anexo)','Contrato Mediação (anexo)','Licença Habitação (anexo)','Folheto']","AP_CAMPOS=['Imagens','Alt-text','Descrição PT','Descrição EN','Descrição FR','Descrição DE','Descrição_ES','Características','Vídeo','Planta','Folheto','Classe energética']".replace('Descrição_ES','Descrição ES'))
sub("if(v==='Preenchido')return 'registado';","if(v==='Preenchido'||PF_CLASSES.includes(v))return 'registado';")
# HTMLs atuais preservam CLARA7 e o agrupamento desenvolvido no Claude.
for const in ['PAINEL_HTML','ESTADO_DOCUMENTAL_HTML']:
 m=re.search(r'^const '+const+r' = (.*);$',s,re.M);assert m
 h=json.loads(m[1])
 if const=='PAINEL_HTML':
  h=re.sub(r'const DOCS=\[.*?\];',"const DOCS=[];",h,count=1)
  h=h.replace('Documentos na ficha do eGO','Plantas e letra energética').replace('Consulta «Documentos» na ficha do eGO. Se o ficheiro estiver em «Outros documentos», escolhe «Está noutra categoria». Se também não estiver no dossiê, escolhe «Não está no eGO nem no dossiê»: fica a aguardar análise da Sara. Não confirmes um documento que não viste.','As plantas devem estar em JPEG. Não é necessário carregar os restantes documentos. Para conferir a planta e registar a letra energética, pesquisa a referência em eGO: estado.')
  h=h.replace('Pesquisar referência · documentos e planta','Pesquisar referência · planta e energia').replace('Como confirmar os documentos','O que confirmar')
 else:
  h=h.replace('Atualizar documentos e planta por referência.','Atualizar planta JPEG e letra energética por referência.')
  h=h.replace('s.opcoes.map(o=>','(c.opcoes||s.opcoes).map(o=>')
  h=h.replace('Digitalizado: falta preparar e inserir no eGO. Ausente também no dossiê: encaminhado para Sara.','Planta: JPEG > upload eGO. Energia: indicar a letra confirmada no eGO; não carregar o certificado. Os anexos antigos ficam apenas no histórico.')
 s=s[:m.start(1)]+json.dumps(h,ensure_ascii=False)+s[m.end(1):]
# Modulo genérico sem dados reais, utilizável no repositório.
s+='\n'+(p/'apps-script/clara/RegrasTrabalho.gs').read_text(encoding='utf-8')
s+='\n'+(p/'apps-script/clara/MigrarRegrasTrabalho.gs').read_text(encoding='utf-8')
args.output.write_text(s,encoding='utf-8')
print('Patch preparado. Conferir sintaxe e testes antes de aplicar no Apps Script. A migração exige uma chamada explícita no documento autorizado.')
