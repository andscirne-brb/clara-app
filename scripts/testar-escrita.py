import os,zipfile,pathlib,xml.etree.ElementTree as E,subprocess,json,hashlib,base64,uuid
repo=pathlib.Path(__file__).resolve().parents[1]
d=repo/'qa-output/escrita';d.mkdir(parents=True,exist_ok=True);p=d/'Levantamento TESTE é.xlsm';N='http://schemas.openxmlformats.org/spreadsheetml/2006/main';ns={'m':N}
def sheet(rows):
 root=E.Element('{'+N+'}worksheet');data=E.SubElement(root,'{'+N+'}sheetData')
 for r,values in rows:
  row=E.SubElement(data,'{'+N+'}row',r=str(r))
  for i,v in enumerate(values):
   c=E.SubElement(row,'{'+N+'}c',r=chr(65+i)+str(r),t='inlineStr',s='0');E.SubElement(E.SubElement(c,'{'+N+'}is'),'{'+N+'}t').text=v
 return root
headers=['Data da alteração','Referência EGO','ID da pendência','Autor','Onde foi alterado','Campo / assunto','Antes','Depois / alteração realizada','Motivo / fonte','Resultado da verificação','Data da verificação','Verificado por']
root=sheet([(5,headers),(6,['']*12),(7,['']*12)]);tp=E.SubElement(root,'{'+N+'}tableParts',count='1');E.SubElement(tp,'{'+N+'}tablePart',{'{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id':'rId1'})
def make():
 with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED)as z:
  z.writestr('xl/workbook.xml','<workbook xmlns="'+N+'" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Levantamento" sheetId="1" r:id="rId1"/><sheet name="Registo de alterações" sheetId="2" r:id="rId2"/></sheets></workbook>')
  z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>')
  z.writestr('xl/worksheets/sheet1.xml',E.tostring(sheet([(9,['Referência EGO']),(10,['TESTE-01'])])))
  z.writestr('xl/worksheets/sheet2.xml',E.tostring(root))
  z.writestr('xl/worksheets/_rels/sheet2.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="../tables/table1.xml"/></Relationships>')
  z.writestr('xl/tables/table1.xml','<table xmlns="'+N+'" ref="A5:L7"/>')
  z.writestr('xl/vbaProject.bin',b'MARCADOR FICTICIO SEM MACROS EXECUTAVEIS');z.writestr('custom/keep.txt',b'PRESERVAR')

# Disposable fixtures are regenerated; never read a production workbook.
make();original=p.read_bytes()
for previous in d.glob('.Clara-recuperacao-*'):
 previous.unlink()
script="[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);"+(repo/'src-tauri/src/workbook-write.ps1').read_text(encoding='utf-8')
wrapper="[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);& ([scriptblock]::Create($env:CLARA_WRITER_SCRIPT))"
os.environ['CLARA_WRITER_SCRIPT']=script
cmd=['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(wrapper.encode('utf-16-le')).decode()]
w={'id':str(uuid.uuid4()),'date':'2026-10-20','reference':'TESTE-01','author':'TESTE','location':'eGO','field':'Planta','before':'','after':'Planta TESTE <exemplo> & anexada.','reason':'Evidência fictícia','verification':'Por verificar'}
def run(hash,work=w):return subprocess.run(cmd,input=json.dumps({'path':str(p.resolve()),'expected_hash':hash,'work':work},ensure_ascii=False).encode(),capture_output=True)
h=hashlib.sha256(original).hexdigest();out=run('0'*64);assert out.returncode!=0 and p.read_bytes()==original,out.stderr.decode('utf-8',errors='replace')
out=run(h);assert out.returncode==0,out.stderr.decode('utf-8',errors='replace');r=json.loads(out.stdout);assert not r['already_written'];after=p.read_bytes()
with zipfile.ZipFile(p)as new,zipfile.ZipFile(__import__('io').BytesIO(original))as old:
 for k in old.namelist():
  if k!='xl/worksheets/sheet2.xml':assert new.read(k)==old.read(k),k
 row=E.fromstring(new.read('xl/worksheets/sheet2.xml')).find("m:sheetData/m:row[@r='6']",ns);assert row.find("m:c[@r='H6']/m:is/m:t",ns).text==w['after']
assert p.with_name(r['recovery_file']).read_bytes()==original
out=run(h);assert out.returncode==0 and json.loads(out.stdout)['already_written'] and p.read_bytes()==after
other={**w,'id':str(uuid.uuid4()),'reference':'DESCONHECIDO'};out=run(hashlib.sha256(after).hexdigest(),other);assert out.returncode!=0 and p.read_bytes()==after

# A second entry uses the next row; a full table must leave bytes intact.
second={**w,'id':str(uuid.uuid4()),'after':'Segundo trabalho TESTE'}
out=run(hashlib.sha256(after).hexdigest(),second);assert out.returncode==0,out.stderr.decode('utf-8',errors='replace')
full=p.read_bytes();third={**w,'id':str(uuid.uuid4())};out=run(hashlib.sha256(full).hexdigest(),third);assert out.returncode!=0 and p.read_bytes()==full
# Same local sharing lock used by an open Excel workbook.
import ctypes
kernel=ctypes.WinDLL('kernel32',use_last_error=True);kernel.CreateFileW.restype=ctypes.c_void_p;kernel.CreateFileW.argtypes=[ctypes.c_wchar_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p,ctypes.c_uint32,ctypes.c_uint32,ctypes.c_void_p];kernel.CloseHandle.argtypes=[ctypes.c_void_p]
handle=kernel.CreateFileW(str(p.resolve()),0x80000000,0,None,3,0,None);assert handle not in [None,ctypes.c_void_p(-1).value]
try:out=run(hashlib.sha256(full).hexdigest(),third);assert out.returncode!=0
finally:kernel.CloseHandle(handle)
assert p.read_bytes()==full
print('PASS: tabela cheia e ficheiro bloqueado sem perda; conflito sem escrita; gravação; recuperação; partes preservadas; Unicode/HTML literal; repetição sem duplicado; referência desconhecida bloqueada.')

# Capture audit: all three sheets change atomically; originals/macros stay intact.
make()
with zipfile.ZipFile(p)as z: parts={n:z.read(n) for n in z.namelist()}
book=E.fromstring(parts['xl/workbook.xml']);E.SubElement(book.find('m:sheets',ns),'{'+N+'}sheet',{'name':'Textos por idioma','sheetId':'3','{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id':'rId3'})
parts['xl/workbook.xml']=E.tostring(book)
rels=E.fromstring(parts['xl/_rels/workbook.xml.rels']);E.SubElement(rels,'{http://schemas.openxmlformats.org/package/2006/relationships}Relationship',{'Id':'rId3','Target':'worksheets/sheet3.xml'});parts['xl/_rels/workbook.xml.rels']=E.tostring(rels)
main=sheet([(9,['Referência EGO','Natureza','Concelho','Imagens','Alt-text','Descrição PT']),(10,['TESTE-01','Moradia','TESTE','','','Por verificar'])]);row=main.find("m:sheetData/m:row[@r='10']",ns);cell=E.SubElement(row,'{'+N+'}c',r='Y10');E.SubElement(cell,'{'+N+'}f').text='IF(F10="Preenchido","Verificado","Em curso")';E.SubElement(cell,'{'+N+'}v').text='Verificado'
parts['xl/worksheets/sheet1.xml']=E.tostring(main)
parts['xl/worksheets/sheet3.xml']=E.tostring(sheet([(5,['Referência EGO','Idioma','Título original','Descrição original','Origem / evidência','Data de recolha','Estado da recolha']),(6,['TESTE-01','PT','Título a preservar','Texto anterior','','','Por recolher'])]))
dates=E.fromstring(parts['xl/worksheets/sheet3.xml']);dc=dates.find("m:sheetData/m:row[@r='6']/m:c[@r='F6']",ns);dc.clear();dc.set('r','F6');E.SubElement(dc,'{'+N+'}v').text='46314.0';parts['xl/worksheets/sheet3.xml']=E.tostring(dates)
with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED)as z:
 for n,b in parts.items():z.writestr(n,b)
before=p.read_bytes();audit_work={**w,'id':str(uuid.uuid4()),'location':'Levantamento Excel'}
audit={'cells':[{'sheet':'Levantamento','column':'F','row':10,'before':'Por verificar','after':'Preenchido'},{'sheet':'Textos por idioma','column':'D','row':6,'before':'Texto anterior','after':'=Texto TESTE <literal> & revisto'},{'sheet':'Textos por idioma','column':'F','row':6,'before':'46314','after':'2026-10-20'}]}
def audit_run(hash,a=audit):return subprocess.run(cmd,input=json.dumps({'path':str(p.resolve()),'expected_hash':hash,'work':audit_work,'audit':a},ensure_ascii=False).encode(),capture_output=True)
out=audit_run('0'*64);assert out.returncode!=0 and p.read_bytes()==before
changed_date={'cells':[{**audit['cells'][-1],'before':'46313'}]};out=audit_run(hashlib.sha256(before).hexdigest(),changed_date);assert out.returncode!=0 and p.read_bytes()==before;assert b'CLIXML'not in out.stderr
out=audit_run(hashlib.sha256(before).hexdigest());assert out.returncode==0,out.stderr.decode('utf-8',errors='replace')
after=p.read_bytes();result=json.loads(out.stdout);assert p.with_name(result['recovery_file']).read_bytes()==before
with zipfile.ZipFile(p)as z:
 for name in ['xl/vbaProject.bin','custom/keep.txt','xl/tables/table1.xml']:assert z.read(name)==parts[name]
 md=E.fromstring(z.read('xl/worksheets/sheet1.xml'));assert md.find("m:sheetData/m:row[@r='10']/m:c[@r='F10']/m:is/m:t",ns).text=='Preenchido';assert md.find("m:sheetData/m:row[@r='10']/m:c[@r='Y10']/m:v",ns)is None;assert md.find("m:sheetData/m:row[@r='10']/m:c[@r='Y10']/m:f",ns)is not None
 td=E.fromstring(z.read('xl/worksheets/sheet3.xml'));assert td.find("m:sheetData/m:row[@r='6']/m:c[@r='C6']/m:is/m:t",ns).text=='Título a preservar';assert td.find("m:sheetData/m:row[@r='6']/m:c[@r='D6']/m:is/m:t",ns).text.startswith('=Texto TESTE');assert td.find("m:sheetData/m:row[@r='6']/m:c[@r='F6']/m:v",ns)is not None
out=audit_run(hashlib.sha256(before).hexdigest());assert out.returncode==0 and json.loads(out.stdout)['already_written'] and p.read_bytes()==after
print('PASS: captura atualiza levantamento + textos + histórico numa gravação, preserva título/macro, invalida caches e não duplica a operação.')
