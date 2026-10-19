// Chamadas tipadas aos comandos da Clara (lado Rust).
import { invoke } from "@tauri-apps/api/core";

export type SecretKind = "password" | "recovery";

export interface PropertyInput { ego_ref: string; nature: string; municipality: string; availability: string; ego_modified: string }
export interface Property extends PropertyInput { id: string; original_description: string | null; archived: boolean; updated_at: string }
export interface ListingInput { property_id: string; portal_id: string; portal_ref: string; url: string; visibility: string; monitoring: boolean }
export interface Listing extends ListingInput { id: string; portal_name: string; revision: number }
export interface Issue { id: string; listing_id: string; field: string; title: string; status: string; change_id: string | null; qa_id: string | null; change_reason: string | null; qa_note: string | null }
export interface Inventory { properties: Property[]; listings: Listing[]; issues: Issue[] }
export interface AuditItem { field: string; state: string; note: string }
export interface Audit { id: string; listing_id: string; listing_revision: number; checklist_version: string; rules_status: string; items: AuditItem[]; created_at: string }
export interface ImportRow { row: number; input: PropertyInput; status: string; error: string | null; changes: string[] }
export interface ImportPreview { token: string; sheet: string; description_enabled: boolean; rows: ImportRow[]; created: number; updated: number; unchanged: number; errors: number }
export interface ImportResult { created: number; updated: number; unchanged: number }

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
  properties: number;
  listings: number;
  issues: number;
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
  weeklyOverview: () => call<WeeklyOverview>("weekly_overview"),
  weeklyPick: () => call<string | null>("weekly_pick"),
  weeklyGenerate: (start: string, end: string) => call<WeeklyReport>("weekly_generate", { start, end }),
  weeklyReminder: (enabled: boolean) => call<TaskStatus>("weekly_reminder", { enabled }),
  collectionList: (propertyId: string) => call<CollectionSnapshot[]>("collection_list", { propertyId }),
  collectionSave: (propertyId: string, data: CollectionData) => call<CollectionSnapshot>("collection_save", { propertyId, data }),
  collectionSuggestions: (data: CollectionData) => call<CollectionSuggestion[]>("collection_suggestions", { data }),
  collectionCapture: () => call<{ name: string; text: string } | null>("collection_capture"),
  inventory: () => call<Inventory>("inventory"),
  propertyCreate: (input: PropertyInput) => call<Property>("property_create", { input }),
  propertyArchive: (id: string, archived: boolean) => call<Property>("property_archive", { id, archived }),
  listingSave: (id: string | null, input: ListingInput) => call<Listing>("listing_save", { id, input }),
  audits: (listingId: string) => call<Audit[]>("audits_list", { listingId }),
  auditDraft: (listingId: string) => call<AuditItem[] | null>("audit_draft_get", { listingId }),
  auditDraftSave: (listingId: string, items: AuditItem[]) => call<void>("audit_draft_save", { listingId, items }),
  auditRecord: (listingId: string, items: AuditItem[]) => call<string>("audit_record", { listingId, items }),
  changeRecord: (issueId: string, editLocation: string, fields: string, reason: string) => call<string>("change_record", { issueId, editLocation, fields, reason }),
  qaRecord: (changeId: string, result: string, observedUrl: string, note: string) => call<string>("qa_record", { changeId, result, observedUrl, note }),
  egoPick: () => call<{ file_name: string; sheets: string[] } | null>("ego_pick_file"),
  egoPreview: (sheet: string, includeDescription: boolean) => call<ImportPreview>("ego_preview", { sheet, includeDescription }),
  egoApply: (token: string) => call<ImportResult>("ego_apply", { token }),
  egoCancel: () => call<void>("ego_cancel"),
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

export interface CollectionData {
 source: string;
 contents: { language: string; title: string; description: string; reviewed: boolean }[];
 captures: { name: string; text: string }[];
 selected_features: string[];
 feature_list_reviewed: boolean;
 notes: string;
}
export interface CollectionSnapshot { id: string; collected_at: string; data: CollectionData }
export interface CollectionSuggestion { field: string; evidence: string; state: string }
export interface WeeklyReport { id: string; generated_at: string; start: string; end: string; file_name: string; source_hash: string; body: string; warnings: string[] }
export interface WeeklyOverview { file_name: string | null; start: string; end: string; reports: WeeklyReport[]; reminder: TaskStatus }
