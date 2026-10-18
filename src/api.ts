// Chamadas tipadas aos comandos da Clara (lado Rust).
import { invoke } from "@tauri-apps/api/core";

export type SecretKind = "password" | "recovery";

export interface AppStatus {
  initialized: boolean;
  unlocked: boolean;
  lock_minutes: number;
  data_dir: string;
  version: string;
  pending_restore: boolean;
}

export interface Portal {
  id: string;
  name: string;
  kind: "portal" | "site_proprio" | "rede_social" | "categoria";
  monitoring_enabled: boolean;
  grupo: string;
  rules_status: string;
  last_verified_at: string | null;
  updated_at: string;
}

export interface HistoryEvent {
  seq: number;
  id: string;
  occurred_at: string;
  actor: "andreia" | "sistema";
  entity_type: string;
  entity_id: string | null;
  action: string;
  origin: string;
  reason: string | null;
  summary: string;
  compensates_event_id: string | null;
  has_payload: boolean;
  redacted: boolean;
}

export interface ChainReport {
  events: number;
  ok: boolean;
  problem: string | null;
}

export interface RunRecord {
  id: string;
  started_at: string;
  finished_at: string;
  source: "app" | "agendado";
  ok: boolean;
  file_name: string | null;
  bytes: number | null;
  error: string | null;
}

export interface BackupFile {
  file_name: string;
  path: string;
  bytes: number;
  created_local: string;
}

export interface TaskStatus {
  supported: boolean;
  installed: boolean;
  command: string | null;
  current_exe: string | null;
  matches_current_exe: boolean;
}

export interface BackupOverview {
  dir: string | null;
  dir_confirmed: boolean;
  dir_problem: string | null;
  last_success: RunRecord | null;
  last_attempt: RunRecord | null;
  stale: boolean;
  next_slot_local: string;
  files: BackupFile[];
  task: TaskStatus;
  picked_file: string | null;
}

export interface VerifyReport {
  file_name: string;
  created_at: string;
  source: "app" | "agendado";
  app_version: string;
  schema_version: number;
  cipher_version: string;
  portals: number;
  history_events: number;
  history_chain_ok: boolean;
  history_problem: string | null;
}

export interface RestoreOut {
  report: VerifyReport;
  previous_saved_as: string | null;
}

/** Os erros chegam como texto PT-PT, pronto a mostrar. */
function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args).catch((e: unknown) => {
    throw new Error(typeof e === "string" ? e : "Ocorreu um erro inesperado.");
  });
}

export const api = {
  status: () => call<AppStatus>("app_status"),
  touch: () => call<void>("touch"),
  createVault: (password: string) => call<{ groups: string[] }>("create_vault", { password }),
  unlock: (secretKind: SecretKind, secret: string) => call<void>("unlock", { secretKind, secret }),
  lock: () => call<void>("lock"),
  resetPassword: (recovery: string, newPassword: string) => call<void>("reset_password", { recovery, newPassword }),
  changePassword: (current: string, newPassword: string) => call<void>("change_password", { current, newPassword }),
  regenerateRecovery: (password: string) => call<{ groups: string[] }>("regenerate_recovery", { password }),
  setLockMinutes: (minutes: number) => call<number>("set_lock_minutes", { minutes }),
  portals: () => call<Portal[]>("portals_list"),
  setMonitoring: (id: string, enabled: boolean) => call<Portal>("portal_set_monitoring", { id, enabled }),
  history: (limit: number, offset: number) => call<{ events: HistoryEvent[]; total: number }>("history_list", { limit, offset }),
  verifyHistory: () => call<ChainReport>("history_verify"),
  backupOverview: () => call<BackupOverview>("backup_overview"),
  pickBackupDir: () => call<string | null>("backup_pick_dir"),
  confirmBackupDir: (confirmed: boolean) => call<void>("backup_confirm_dir", { confirmed }),
  backupNow: () => call<RunRecord>("backup_now"),
  pickBackupFile: () => call<string | null>("backup_pick_file"),
  verifyBackup: (fileName: string | null, secretKind: SecretKind, secret: string) =>
    call<VerifyReport>("backup_verify", { fileName, secretKind, secret }),
  restoreBackup: (fileName: string | null, secretKind: SecretKind, secret: string) =>
    call<RestoreOut>("backup_restore", { fileName, secretKind, secret }),
  taskInstall: () => call<TaskStatus>("task_install"),
  taskRunNow: () => call<void>("task_run_now"),
  taskRemove: () => call<TaskStatus>("task_remove"),
};
