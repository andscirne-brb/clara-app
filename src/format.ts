const dateTime = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const longDate = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Timestamps guardados em UTC, apresentados na hora de Lisboa. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "N/D";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "N/D" : dateTime.format(d).replace(",", " às");
}

export function formatToday(): string {
  const s = longDate.format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null) return "N/D";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "há menos de uma hora";
  if (h < 24) return h === 1 ? "há 1 hora" : `há ${h} horas`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

export const kindLabel: Record<string, string> = {
  portal: "Portal",
  site_proprio: "Site da agência",
  rede_social: "Rede social",
  categoria: "Categoria",
};

export const grupoLabel: Record<string, string> = {
  por_confirmar: "Por confirmar",
  core: "Core",
  secondary: "Secondary",
  feed_only: "Feed only",
};

export const rulesLabel: Record<string, string> = {
  por_levantar: "Por levantar",
  em_levantamento: "Em levantamento",
  levantado: "Levantadas",
};
