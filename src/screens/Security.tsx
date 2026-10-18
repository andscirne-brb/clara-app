import { useState } from "react";
import { api, type AppStatus } from "../api";
import { Btn, Card, Field, Notice, PasswordPair, RecoveryKeyFlow, passwordPairOk } from "../components";

const OPTIONS = [5, 10, 15, 30, 60];

export function Security(props: { status: AppStatus; onChanged: () => void }) {
  const [cur, setCur] = useState("");
  const [n1, setN1] = useState("");
  const [n2, setN2] = useState("");
  const [pwMsg, setPwMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [recPw, setRecPw] = useState("");
  const [groups, setGroups] = useState<string[] | null>(null);
  const [recMsg, setRecMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const [lockMsg, setLockMsg] = useState<string | null>(null);

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Configuração</p>
        <h1>Segurança</h1>
      </header>

      <Card title="Bloqueio por inatividade">
        <label className="field">
          <span className="label">Bloquear a Clara depois de</span>
          <select
            value={props.status.lock_minutes}
            onChange={async (e) => {
              setLockMsg(null);
              try {
                await api.setLockMinutes(Number(e.target.value));
                props.onChanged();
                setLockMsg("Guardado.");
              } catch (err) {
                setLockMsg((err as Error).message);
              }
            }}
          >
            {OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} minutos sem atividade
              </option>
            ))}
          </select>
        </label>
        {lockMsg && <p className="muted small" role="status">{lockMsg}</p>}
      </Card>

      <Card title="Mudar a palavra-passe">
        <form
          className="stack narrow"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("pw");
            setPwMsg(null);
            try {
              await api.changePassword(cur, n1);
              setCur("");
              setN1("");
              setN2("");
              setPwMsg({ tone: "ok", text: "Palavra-passe alterada." });
            } catch (err) {
              setPwMsg({ tone: "error", text: (err as Error).message });
            } finally {
              setBusy(null);
            }
          }}
        >
          <Field label="Palavra-passe atual" type="password" value={cur} onChange={setCur} autoComplete="current-password" />
          <PasswordPair label="Nova palavra-passe" value={n1} onChange={setN1} confirm={n2} onConfirm={setN2} />
          <Notice tone="info">
            Os backups já feitos continuam a abrir com a palavra-passe antiga. Os novos, a partir de hoje, usam a nova.
          </Notice>
          {pwMsg && <Notice tone={pwMsg.tone}>{pwMsg.text}</Notice>}
          <div>
            <Btn variant="primary" type="submit" busy={busy === "pw"} isDisabled={!cur || !passwordPairOk(n1, n2)}>
              Mudar palavra-passe
            </Btn>
          </div>
        </form>
      </Card>

      <Card title="Nova chave de recuperação">
        {groups ? (
          <RecoveryKeyFlow
            groups={groups}
            doneLabel="Concluir"
            onDone={() => {
              setGroups(null);
              setRecMsg({ tone: "ok", text: "Nova chave de recuperação ativa." });
            }}
          />
        ) : (
          <form
            className="stack narrow"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("rec");
              setRecMsg(null);
              try {
                const r = await api.regenerateRecovery(recPw);
                setRecPw("");
                setGroups(r.groups);
              } catch (err) {
                setRecMsg({ tone: "error", text: (err as Error).message });
              } finally {
                setBusy(null);
              }
            }}
          >
            <p>Usa isto se perderes o papel ou suspeitares que alguém o viu. A chave atual deixa de abrir esta base.</p>
            <Notice tone="warn">
              Não deites fora o papel antigo durante cerca de 4 semanas: as cópias feitas antes desta mudança só abrem com a
              chave antiga (ou com a palavra-passe dessa altura).
            </Notice>
            <Field label="Palavra-passe atual" type="password" value={recPw} onChange={setRecPw} autoComplete="current-password" />
            {recMsg && <Notice tone={recMsg.tone}>{recMsg.text}</Notice>}
            <div>
              <Btn type="submit" busy={busy === "rec"} isDisabled={!recPw}>
                Gerar nova chave
              </Btn>
            </div>
          </form>
        )}
      </Card>

      <Card title="Onde estão os dados">
        <p>
          <span className="mono small">{props.status.data_dir}</span>
        </p>
        <p className="muted small">
          Pasta local, fora do OneDrive e do Google Drive. A base está cifrada (SQLCipher) e só abre com a tua palavra-passe
          ou com a chave de recuperação. Versão {props.status.version}.
        </p>
      </Card>
    </div>
  );
}
