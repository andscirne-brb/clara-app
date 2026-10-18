// Ecrãs antes de entrar: primeira configuração, desbloqueio, palavra-passe esquecida e restauro.
import { useState } from "react";
import { api, type RestoreOut, type SecretKind } from "../api";
import { Btn, Field, Notice, PasswordPair, RecoveryKeyFlow, SecretKindPicker, passwordPairOk } from "../components";
import { formatDateTime } from "../format";

function Frame(props: { title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="start">
      <div className={`start-panel ${props.wide ? "wide" : ""}`}>
        <div className="brand">
          <img src="/clara.svg" alt="" width={40} height={40} />
          <span>Clara</span>
        </div>
        <h1>{props.title}</h1>
        {props.subtitle && <p className="lead">{props.subtitle}</p>}
        {props.children}
      </div>
    </main>
  );
}

export function Welcome(props: { onDone: () => void }) {
  const [mode, setMode] = useState<"choose" | "create" | "recovery" | "restore">("choose");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mode === "restore") {
    return <RestoreFlow onCancel={() => setMode("choose")} onDone={props.onDone} />;
  }

  if (mode === "recovery") {
    return (
      <Frame title="Guarda a tua chave de recuperação" wide>
        <RecoveryKeyFlow groups={groups} onDone={props.onDone} doneLabel="Entrar na Clara" />
      </Frame>
    );
  }

  if (mode === "create") {
    return (
      <Frame title="Cria a tua palavra-passe" subtitle="É ela que tranca os dados. Pedida sempre que abres a Clara.">
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const r = await api.createVault(pw);
              setPw("");
              setPw2("");
              setGroups(r.groups);
              setMode("recovery");
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <PasswordPair value={pw} onChange={setPw} confirm={pw2} onConfirm={setPw2} autoFocus />
          <Notice tone="info">
            Não existe forma de recuperar a palavra-passe sem a chave de recuperação que vais escrever a seguir. Nem eu,
            nem ninguém, consegue abrir os dados sem uma das duas.
          </Notice>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="row-between">
            <Btn variant="ghost" onPress={() => setMode("choose")} isDisabled={busy}>
              Voltar
            </Btn>
            <Btn variant="primary" type="submit" busy={busy} isDisabled={!passwordPairOk(pw, pw2)}>
              {busy ? "A cifrar…" : "Criar e cifrar"}
            </Btn>
          </div>
        </form>
      </Frame>
    );
  }

  return (
    <Frame
      title="Olá, Andreia."
      subtitle="Eu sou a Clara. Ajudo-te a detetar o que falta e a clarificar o que precisa de melhorar. Tudo fica neste computador, cifrado."
      wide
    >
      <div className="choice-grid">
        <button className="choice" onClick={() => setMode("create")}>
          <span className="choice-title">Começar do zero</span>
          <span className="choice-text">Primeira vez neste computador. Crias a palavra-passe e a chave de recuperação.</span>
        </button>
        <button className="choice" onClick={() => setMode("restore")}>
          <span className="choice-title">Restaurar de um backup</span>
          <span className="choice-text">PC novo ou recuperação. Escolhes um ficheiro .clarabak da pasta Clara Backups.</span>
        </button>
      </div>
    </Frame>
  );
}

export function Unlock(props: { onDone: () => void; message?: string | null; onRestore: () => void }) {
  const [mode, setMode] = useState<"password" | "forgot">("password");
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      props.onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "forgot") {
    return (
      <Frame title="Esqueceste-te da palavra-passe?" subtitle="Usa a chave de recuperação que escreveste em papel e define uma palavra-passe nova.">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api.resetPassword(code, n1));
          }}
        >
          <Field label="Chave de recuperação" value={code} onChange={setCode} mono autoFocus description="8 blocos de 4 caracteres. Hífenes e maiúsculas são opcionais." />
          <PasswordPair label="Nova palavra-passe" value={n1} onChange={setN1} confirm={n2} onConfirm={setN2} />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="row-between">
            <Btn variant="ghost" onPress={() => setMode("password")} isDisabled={busy}>
              Voltar
            </Btn>
            <Btn variant="primary" type="submit" busy={busy} isDisabled={!code || !passwordPairOk(n1, n2)}>
              Repor e entrar
            </Btn>
          </div>
        </form>
      </Frame>
    );
  }

  return (
    <Frame title="Desbloquear a Clara">
      {props.message && <Notice tone="info">{props.message}</Notice>}
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api.unlock("password", pw);
            setPw("");
          });
        }}
      >
        <Field label="Palavra-passe" type="password" value={pw} onChange={setPw} autoFocus autoComplete="current-password" />
        {error && <Notice tone="error">{error}</Notice>}
        <Btn variant="primary" type="submit" busy={busy} isDisabled={!pw}>
          {busy ? "A abrir…" : "Desbloquear"}
        </Btn>
      </form>
      <div className="start-links">
        <button className="link" onClick={() => setMode("forgot")}>
          Esqueci-me da palavra-passe
        </button>
        <button className="link" onClick={props.onRestore}>
          Restaurar de um backup
        </button>
      </div>
    </Frame>
  );
}

export function RestoreFlow(props: { onCancel: () => void; onDone: () => void }) {
  const [file, setFile] = useState<string | null>(null);
  const [kind, setKind] = useState<SecretKind>("password");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RestoreOut | null>(null);

  if (result) {
    return (
      <Frame title="Backup restaurado" wide>
        <Notice tone="ok" title={result.report.file_name}>
          Cópia de {formatDateTime(result.report.created_at)}. Integridade verificada: {result.report.history_events} eventos no
          histórico, {result.report.portals} destinos.
        </Notice>
        {result.previous_saved_as && (
          <Notice tone="info">
            A base que estava neste computador não foi apagada. Ficou guardada em <code>{result.previous_saved_as}</code>.
          </Notice>
        )}
        <p>
          Desbloqueia agora com a palavra-passe que usavas quando esta cópia foi feita, ou com a chave de recuperação dessa
          altura.
        </p>
        <div className="row-end">
          <Btn variant="primary" onPress={props.onDone}>
            Continuar para o desbloqueio
          </Btn>
        </div>
      </Frame>
    );
  }

  return (
    <Frame
      title="Restaurar de um backup"
      subtitle="A Clara verifica a cópia antes de substituir o que quer que seja. Se já existir uma base neste PC, fica guardada ao lado."
      wide
    >
      <div className="stack">
        <div className="file-pick">
          <Btn
            onPress={async () => {
              setError(null);
              try {
                const f = await api.pickBackupFile();
                if (f) setFile(f);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Escolher ficheiro .clarabak
          </Btn>
          <span className="path">{file ?? "Nenhum ficheiro escolhido"}</span>
        </div>
        <SecretKindPicker value={kind} onChange={setKind} />
        <Field
          label={kind === "password" ? "Palavra-passe da altura do backup" : "Chave de recuperação da altura do backup"}
          type={kind === "password" ? "password" : "text"}
          value={secret}
          onChange={setSecret}
          mono={kind === "recovery"}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <div className="row-between">
          <Btn variant="ghost" onPress={props.onCancel} isDisabled={busy}>
            Voltar
          </Btn>
          <Btn
            variant="primary"
            busy={busy}
            isDisabled={!file || !secret}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                setResult(await api.restoreBackup(null, kind, secret));
                setSecret("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "A verificar…" : "Verificar e restaurar"}
          </Btn>
        </div>
      </div>
    </Frame>
  );
}
