//! Hora do backup diário e definição da tarefa do Agendador do Windows.

use chrono::{DateTime, Duration, NaiveTime, TimeZone, Utc};

use crate::TZ;

pub const BACKUP_HOUR: u32 = 22;
pub const TASK_NAME: &str = r"Clara\Backup diario";
pub const SCHEDULED_ARG: &str = "--scheduled-backup";
/// A partir de quanto tempo sem backup bem-sucedido a Clara avisa.
pub const STALE_AFTER_HOURS: i64 = 48;

/// Último instante das 22:00 em Lisboa igual ou anterior a `now`.
pub fn last_slot(now: DateTime<Utc>) -> DateTime<Utc> {
    let local = now.with_timezone(&TZ);
    let at = NaiveTime::from_hms_opt(BACKUP_HOUR, 0, 0).unwrap();
    let mut day = local.date_naive();
    loop {
        let candidate = TZ
            .from_local_datetime(&day.and_time(at))
            .earliest()
            .map(|d| d.with_timezone(&Utc));
        if let Some(c) = candidate {
            if c <= now {
                return c;
            }
        }
        day = day.pred_opt().unwrap();
    }
}

/// A app, se estiver desbloqueada, deve fazer o backup agora?
pub fn app_backup_due(now: DateTime<Utc>, last_success: Option<DateTime<Utc>>) -> bool {
    let slot = last_slot(now);
    match last_success {
        None => true,
        Some(t) => t < slot,
    }
}

pub fn is_stale(now: DateTime<Utc>, last_success: Option<DateTime<Utc>>) -> bool {
    match last_success {
        None => true,
        Some(t) => now - t > Duration::hours(STALE_AFTER_HOURS),
    }
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

/// XML da tarefa: todos os dias às 22:00 (hora local), corre assim que
/// possível se o PC estiver desligado, não acorda o PC, sem direitos de
/// administrador, sem janela.
pub fn task_xml(exe_path: &str, start_date: chrono::NaiveDate) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Copia cifrada diária da Clara. A tarefa copia ficheiros já cifrados e nunca abre os dados.</Description>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>{date}T{hour:02}:00:00</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <WakeToRun>false</WakeToRun>
    <Hidden>true</Hidden>
    <ExecutionTimeLimit>PT30M</ExecutionTimeLimit>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{exe}</Command>
      <Arguments>{arg}</Arguments>
    </Exec>
  </Actions>
</Task>
"#,
        date = start_date.format("%Y-%m-%d"),
        hour = BACKUP_HOUR,
        exe = xml_escape(exe_path),
        arg = SCHEDULED_ARG,
    )
}

/// O `schtasks` espera o XML em UTF-16 LE com BOM.
pub fn utf16le_with_bom(s: &str) -> Vec<u8> {
    let mut out = vec![0xFF, 0xFE];
    for u in s.encode_utf16() {
        out.extend_from_slice(&u.to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn utc(s: &str) -> DateTime<Utc> {
        DateTime::parse_from_rfc3339(s).unwrap().with_timezone(&Utc)
    }

    #[test]
    fn slot_follows_lisbon_time_across_dst() {
        // Verão (UTC+1): 22:00 Lisboa = 21:00 UTC.
        assert_eq!(last_slot(utc("2026-07-10T21:30:00Z")), utc("2026-07-10T21:00:00Z"));
        assert_eq!(last_slot(utc("2026-07-10T20:59:00Z")), utc("2026-07-09T21:00:00Z"));
        // Inverno (UTC+0): 22:00 Lisboa = 22:00 UTC.
        assert_eq!(last_slot(utc("2026-12-10T22:01:00Z")), utc("2026-12-10T22:00:00Z"));
    }

    #[test]
    fn due_once_per_slot() {
        let now = utc("2026-12-10T22:05:00Z");
        assert!(app_backup_due(now, None));
        assert!(app_backup_due(now, Some(utc("2026-12-10T21:59:00Z"))));
        assert!(!app_backup_due(now, Some(utc("2026-12-10T22:01:00Z"))));
    }

    #[test]
    fn stale_after_48h() {
        let now = utc("2026-12-10T12:00:00Z");
        assert!(!is_stale(now, Some(utc("2026-12-09T12:00:00Z"))));
        assert!(is_stale(now, Some(utc("2026-12-08T11:00:00Z"))));
        assert!(is_stale(now, None));
    }

    #[test]
    fn task_xml_is_escaped() {
        let x = task_xml(r"C:\Program Files\Clara & Co\clara.exe", chrono::NaiveDate::from_ymd_opt(2026, 10, 18).unwrap());
        assert!(x.contains("Clara &amp; Co"));
        assert!(x.contains("2026-10-18T22:00:00"));
        assert!(x.contains("<WakeToRun>false</WakeToRun>"));
        assert!(x.contains("<StartWhenAvailable>true</StartWhenAvailable>"));
        let b = utf16le_with_bom(&x);
        assert_eq!(&b[..2], &[0xFF, 0xFE]);
    }
}
