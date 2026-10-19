import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Dialog,
  FieldError,
  Heading,
  Input,
  Label,
  Modal,
  ModalOverlay,
  Radio,
  RadioGroup,
  Text,
  TextField,
} from "react-aria-components";
import type { SecretKind } from "./api";

export function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "password";
  description?: string;
  error?: string | null;
  autoFocus?: boolean;
  autoComplete?: string;
  mono?: boolean;
}) {
  return (
    <TextField
      className="field"
      value={props.value}
      onChange={props.onChange}
      type={props.type ?? "text"}
      isInvalid={!!props.error}
      autoFocus={props.autoFocus}
      autoComplete={props.autoComplete ?? "off"}
    >
      <Label>{props.label}</Label>
      <Input className={props.mono ? "mono" : undefined} spellCheck={false} />
      {props.description && <Text slot="description">{props.description}</Text>}
      <FieldError>{props.error}</FieldError>
    </TextField>
  );
}

export function Notice(props: { tone: "ok" | "warn" | "error" | "info"; title?: string; children: ReactNode }) {
  const icon = { ok: "✓", warn: "!", error: "×", info: "i" }[props.tone];
  return (
    <div className={`notice notice-${props.tone}`} role={props.tone === "error" ? "alert" : "status"}>
      <span className="notice-icon" aria-hidden="true">{icon}</span>
      <div>
        {props.title && <strong className="notice-title">{props.title}</strong>}
        <div>{props.children}</div>
      </div>
    </div>
  );
}

export function Card(props: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${props.className ?? ""}`}>
      {(props.title || props.actions) && (
        <header className="card-head">
          {props.title && <h2>{props.title}</h2>}
          {props.actions && <div className="card-actions">{props.actions}</div>}
        </header>
      )}
      {props.children}
    </section>
  );
}

export function Btn(props: {
  children: ReactNode;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  isDisabled?: boolean;
  type?: "button" | "submit";
  busy?: boolean;
}) {
  return (
    <Button
      className={`btn btn-${props.variant ?? "secondary"}`}
      onPress={props.onPress}
      isDisabled={props.isDisabled || props.busy}
      type={props.type ?? "button"}
    >
      {props.busy ? <span className="spinner" aria-hidden="true" /> : null}
      {props.children}
    </Button>
  );
}

export function ToggleSwitch(props: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="switch">
      <input
        type="checkbox"
        role="switch"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.checked)}
        aria-label={props.label}
      />
      <span className="switch-track" aria-hidden="true">
        <span className="switch-thumb" />
      </span>
      <span className="switch-text">{props.checked ? "Ligada" : "Desligada"}</span>
    </label>
  );
}

export function CheckLine(props: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="checkline">
      <input type="checkbox" checked={props.checked} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.children}</span>
    </label>
  );
}

export function SecretKindPicker(props: { value: SecretKind; onChange: (v: SecretKind) => void }) {
  return (
    <RadioGroup className="radios" value={props.value} onChange={(v) => props.onChange(v as SecretKind)}>
      <Label>Desbloquear a cópia com</Label>
      <div className="radio-row">
        <Radio value="password">Palavra-passe</Radio>
        <Radio value="recovery">Chave de recuperação</Radio>
      </div>
    </RadioGroup>
  );
}

/** Pede palavra-passe ou chave de recuperação num diálogo. */
export function SecretDialog(props: {
  isOpen: boolean;
  title: string;
  intro: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onSubmit: (kind: SecretKind, secret: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<SecretKind>("password");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.isOpen) {
      setSecret("");
      setError(null);
      setKind("password");
    }
  }, [props.isOpen]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await props.onSubmit(kind, secret);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlay className="overlay" isOpen={props.isOpen} onOpenChange={(o) => !o && !busy && props.onCancel()} isDismissable={!busy}>
      <Modal className="modal">
        <Dialog className="dialog">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Heading slot="title">{props.title}</Heading>
            <div className="dialog-intro">{props.intro}</div>
            <SecretKindPicker value={kind} onChange={setKind} />
            <Field
              label={kind === "password" ? "Palavra-passe" : "Chave de recuperação"}
              type={kind === "password" ? "password" : "text"}
              value={secret}
              onChange={setSecret}
              autoFocus
              mono={kind === "recovery"}
              description={kind === "recovery" ? "Podes escrever com ou sem hífenes, em maiúsculas ou minúsculas." : undefined}
            />
            {error && <Notice tone="error">{error}</Notice>}
            <div className="dialog-actions">
              <Btn variant="ghost" onPress={props.onCancel} isDisabled={busy}>
                Cancelar
              </Btn>
              <Btn variant={props.danger ? "danger" : "primary"} type="submit" busy={busy} isDisabled={!secret}>
                {props.confirmLabel}
              </Btn>
            </div>
          </form>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

/** Mostra a chave em blocos e depois pede dois blocos para confirmar que ficou bem escrita. */
export function RecoveryKeyFlow(props: { groups: string[]; onDone: () => void; doneLabel?: string }) {
  const [stage, setStage] = useState<"show" | "confirm">("show");
  const [written, setWritten] = useState(false);
  const picks = useMemo(() => {
    const a = Math.floor(Math.random() * 4);
    const b = 4 + Math.floor(Math.random() * 4);
    return [a, b];
  }, []);
  const [answers, setAnswers] = useState(["", ""]);
  const [error, setError] = useState<string | null>(null);

  const norm = (s: string) => s.trim().toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");

  if (stage === "show") {
    return (
      <div className="stack">
        <p>
          Esta é a tua <strong>chave de recuperação</strong>. Abre a Clara se te esqueceres da palavra-passe e é a única forma
          de recuperar os backups num PC novo sem ela.
        </p>
        <ol className="recovery-key" aria-label="Chave de recuperação, 8 blocos">
          {props.groups.map((g, i) => (
            <li key={i}>
              <span className="recovery-index">{i + 1}</span>
              <span className="recovery-group">{g}</span>
            </li>
          ))}
        </ol>
        <Notice tone="warn" title="Escreve à mão, em papel">
          Não tires fotografia, não guardes no PC nem no email. Guarda o papel fora do computador, junto dos códigos de
          recuperação da tua conta Google de trabalho. A Clara não volta a mostrar esta chave.
        </Notice>
        <CheckLine checked={written} onChange={setWritten}>
          Escrevi os 8 blocos em papel e confirmei letra a letra.
        </CheckLine>
        <div className="row-end">
          <Btn variant="primary" isDisabled={!written} onPress={() => setStage("confirm")}>
            Continuar
          </Btn>
        </div>
      </div>
    );
  }

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const ok = picks.every((p, i) => norm(answers[i]) === props.groups[p]);
        if (ok) props.onDone();
        else setError("Não corresponde. Confirma o que escreveste no papel ou volta a ver a chave.");
      }}
    >
      <p>Para ter a certeza de que ficou bem escrita, copia do papel estes dois blocos.</p>
      <div className="two-cols">
        {picks.map((p, i) => (
          <Field
            key={p}
            label={`Bloco ${p + 1}`}
            value={answers[i]}
            mono
            autoFocus={i === 0}
            onChange={(v) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)))}
          />
        ))}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="row-between">
        <Btn variant="ghost" onPress={() => setStage("show")}>
          Voltar a ver a chave
        </Btn>
        <Btn variant="primary" type="submit" isDisabled={answers.some((a) => a.trim().length < 4)}>
          {props.doneLabel ?? "Confirmar"}
        </Btn>
      </div>
    </form>
  );
}

export function PasswordPair(props: {
  value: string;
  onChange: (v: string) => void;
  confirm: string;
  onConfirm: (v: string) => void;
  label?: string;
  autoFocus?: boolean;
}) {
  const tooShort = props.value.length > 0 && [...props.value].length < 12;
  const mismatch = props.confirm.length > 0 && props.confirm !== props.value;
  return (
    <>
      <Field
        label={props.label ?? "Palavra-passe"}
        type="password"
        value={props.value}
        onChange={props.onChange}
        autoFocus={props.autoFocus}
        autoComplete="new-password"
        description="Mínimo 12 caracteres. Uma frase que só tu conheces é mais fácil de lembrar e mais forte."
        error={tooShort ? "Ainda tem menos de 12 caracteres." : null}
      />
      <Field
        label="Repete a palavra-passe"
        type="password"
        value={props.confirm}
        onChange={props.onConfirm}
        autoComplete="new-password"
        error={mismatch ? "As duas palavras-passe não são iguais." : null}
      />
    </>
  );
}

export function passwordPairOk(a: string, b: string) {
  return [...a].length >= 12 && a === b;
}
