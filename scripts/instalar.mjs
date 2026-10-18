// Copia a Clara compilada para %LOCALAPPDATA%\Programs\Clara e cria um
// atalho no menu Iniciar. Os dados ficam à parte, em %LOCALAPPDATA%\Clara-Dados. (Para usar a Clara, prefere o instalador.)
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

if (process.platform !== "win32") {
  console.error("Este passo só funciona no Windows.");
  process.exit(1);
}
const origem = join(process.cwd(), "target", "release", "clara.exe");
if (!existsSync(origem)) {
  console.error("Ainda não existe target\\release\\clara.exe. Corre primeiro: npm run compilar");
  process.exit(1);
}
const destinoDir = join(process.env.LOCALAPPDATA, "Programs", "Clara");
mkdirSync(destinoDir, { recursive: true });
const destino = join(destinoDir, "clara.exe");
try {
  copyFileSync(origem, destino);
} catch (e) {
  console.error("Não consegui copiar. A Clara está aberta? Fecha-a e tenta outra vez.\n" + e.message);
  process.exit(1);
}
const atalho = join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs", "Clara.lnk");
const ps = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${atalho.replace(/'/g, "''")}');` +
  `$s.TargetPath='${destino.replace(/'/g, "''")}';$s.WorkingDirectory='${destinoDir.replace(/'/g, "''")}';$s.Save()`;
execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { stdio: "inherit" });
console.log(`\nClara instalada em ${destino}\nAtalho criado no menu Iniciar ("Clara").`);
console.log("Se já tinhas ativado a tarefa das 22h com outra cópia, abre a Clara instalada e ativa-a outra vez em Configuração > Backups.");
