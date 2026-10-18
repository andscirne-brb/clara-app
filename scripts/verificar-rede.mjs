// Falha o build se aparecer alguma biblioteca com capacidade de rede.
// Corre automaticamente antes de cada `npm run tauri build`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROIBIDAS_RUST = [
  "reqwest", "hyper", "hyper-util", "ureq", "curl", "isahc", "attohttpc", "surf",
  "tungstenite", "tokio-tungstenite", "rustls", "native-tls", "h2", "quinn",
  "sentry", "tauri-plugin-http", "tauri-plugin-updater", "tauri-plugin-upload",
  "tauri-plugin-websocket", "tauri-plugin-shell",
  // Nota: tauri-plugin-fs entra como dependência interna do plugin de diálogo.
  // Não é rede, e a interface não tem permissão para o usar (capabilities/default.json).
];
const PERMITIDAS_NPM = new Set([
  "react", "react-dom", "react-aria-components", "@tauri-apps/api",
  "@tauri-apps/cli", "@types/react", "@types/react-dom", "@vitejs/plugin-react",
  "typescript", "vite",
]);

let falhas = [];
for (const target of ["x86_64-pc-windows-msvc", null]) {
  const args = ["tree", "-p", "clara", "-e", "normal", "--prefix", "none"];
  if (target) args.push("--target", target);
  let out;
  try {
    out = execFileSync("cargo", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    console.error("Não foi possível listar as dependências Rust:", e.message);
    process.exit(1);
  }
  const nomes = new Set(out.split(/\r?\n/).map((l) => l.trim().split(" ")[0]).filter(Boolean));
  for (const p of PROIBIDAS_RUST) if (nomes.has(p)) falhas.push(`Rust (${target ?? "local"}): ${p}`);
}

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
  if (!PERMITIDAS_NPM.has(dep)) falhas.push(`npm: ${dep} (não está na lista aprovada)`);
}

if (falhas.length) {
  console.error("\nVerificação de rede FALHOU. Dependências não autorizadas:\n  " + [...new Set(falhas)].join("\n  "));
  process.exit(1);
}
console.log("Verificação de rede: OK (nenhuma biblioteca de rede nas dependências).");
