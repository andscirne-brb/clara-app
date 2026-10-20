import json,hashlib,subprocess,pathlib,zipfile,shutil,io,uuid
BASE=pathlib.Path(__file__).resolve().parents[1]
ROOT=BASE/'qa-output/profiles-excel'/str(uuid.uuid4());ROOT.mkdir(parents=True,exist_ok=True)
def make_source(path):
 import zipfile
 n='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
 with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED)as z:
  z.writestr('xl/workbook.xml',f'<workbook xmlns="{n}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Levantamento" sheetId="1" r:id="rId1"/></sheets></workbook>')
  z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
  z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/></Types>')
  z.writestr('xl/styles.xml',f'<styleSheet xmlns="{n}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>')
  z.writestr('xl/worksheets/sheet1.xml',f'<worksheet xmlns="{n}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>TESTE</t></is></c><c r="B1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>')
  z.writestr('xl/vbaProject.bin',b'SYNTHETIC PRESERVATION MARKER - NO EXECUTABLE MACROS')

source=ROOT/'SOURCE-TESTE.xlsm';make_source(source)
target=ROOT/'TESTE.xlsm';shutil.copyfile(source,target)
script=(BASE/'src-tauri/src/profiles-write.ps1').read_text(encoding='utf-8-sig')
shell=pathlib.Path('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
import base64,os
wrapper='[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);& ([scriptblock]::Create($env:CLARA_WRITER_SCRIPT))'
def run(versions,hash=None,ok=True):
 request=dict(path=str(target),expected_hash=hash or hashlib.sha256(target.read_bytes()).hexdigest(),profiles=versions,work=dict(id=versions[0]['id']))
 env=os.environ.copy();env['CLARA_WRITER_SCRIPT']=script
 p=subprocess.run([str(shell),'-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(wrapper.encode('utf-16le')).decode()],input=json.dumps(request,ensure_ascii=False).encode(),capture_output=True,env=env,timeout=30,creationflags=0x08000000)
 if ok:assert p.returncode==0,p.stderr.decode('utf-8','replace')
 else:assert p.returncode!=0
 return json.loads(p.stdout) if ok else None
def version(id,portal='green-acres',note='Texto TESTE'):
 return dict(id=id,saved_at='2026-10-20T18:50:00Z',data=dict(portal=portal,url='https://example.invalid/perfil',stage='Em curso',source='TESTE',next_action=note,sara='Preciso de confirmar TESTE',applied_date='',applied_confirmed=False,items=[dict(field=f,state='Ajustar',note=note) for f in ['empresa','contactos','imagens','apresentacao','ligacoes']],texts=[dict(language=l,original='Original TESTE '+l,proposed='=TESTE '+l)for l in ['PT','EN','FR','ES','DE']]))
v1=version('teste-001');v2=version('teste-002',note='Nova versão TESTE')
r=run([v1]);assert not r['already_written']
unchanged=target.read_bytes();assert run([v1])['already_written'];assert target.read_bytes()==unchanged
run([v2,v1]);run([version('teste-idealista','idealista')]);run([v2,v1]);run([version('stale')],hash='0'*64,ok=False)
import xml.etree.ElementTree as E
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(source)as z:before={n:z.read(n)for n in z.namelist()}
with zipfile.ZipFile(target)as z:
 changed=[n for n,b in before.items()if z.read(n)!=b]
 assert set(changed)<=set(['xl/workbook.xml','xl/_rels/workbook.xml.rels','[Content_Types].xml','xl/styles.xml']),changed
 sheets=[E.fromstring(z.read(n))for n in z.namelist()if 'claraProfiles' in n]
 assert len(sheets)==2
 assert all(not s.findall('.//m:f',ns)for s in sheets)
 current,history=sheets
 vals=lambda s:[''.join(c.itertext())for c in s.findall('.//m:c',ns)]
 assert 'Nova versão TESTE' in vals(current)
 assert 'teste-001' not in vals(current)
 assert 'teste-idealista' in vals(current)
 assert vals(history).count('teste-001')==13,vals(history).count('teste-001')
print('PASS: new sheets, latest/current, preserved portal, chronological history, retry idempotence, stale hash rejected, literal formula-like text, all original worksheet parts unchanged.')
