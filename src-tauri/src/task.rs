//! Tarefa do Agendador do Windows para o backup das 22h.
//! Usa `schtasks`, que já vem com o Windows e não precisa de administrador.

use chrono::Offset;
use serde::Serialize;

use clara_core::paths::DataDir;
use clara_core::schedule::{TASK_NAME, task_xml, utf16le_with_bom};

#[derive(Serialize)]
pub struct TaskStatus {
    pub supported: bool,
    pub installed: bool,
    pub command: Option<String>,
    pub current_exe: Option<String>,
    pub matches_current_exe: bool,
}

#[cfg(windows)]
fn schtasks(args: &[&str]) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let out = std::process::Command::new("schtasks")
        .args(args)
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Não foi possível chamar o Agendador de Tarefas: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        Err(format!(
            "O Agendador de Tarefas recusou: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ))
    }
}

#[cfg(not(windows))]
fn schtasks(_args: &[&str]) -> Result<String, String> {
    Err("A tarefa agendada só está disponível no Windows.".into())
}

fn current_exe() -> Option<String> {
    std::env::current_exe()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
}

fn extract_command(xml: &str) -> Option<String> {
    let start = xml.find("<Command>")? + "<Command>".len();
    let end = xml[start..].find("</Command>")? + start;
    Some(
        xml[start..end]
            .replace("&amp;", "&")
            .replace("&quot;", "\"")
            .trim_matches('"')
            .to_string(),
    )
}

pub fn status() -> TaskStatus {
    status_named(TASK_NAME)
}

fn status_named(name: &str) -> TaskStatus {
    let current = current_exe();
    if !cfg!(windows) {
        return TaskStatus {
            supported: false,
            installed: false,
            command: None,
            current_exe: current,
            matches_current_exe: false,
        };
    }
    match schtasks(&["/Query", "/TN", name, "/XML"]) {
        Ok(xml) => {
            let command = extract_command(&xml);
            let matches = match (&command, &current) {
                (Some(a), Some(b)) => a.eq_ignore_ascii_case(b),
                _ => false,
            };
            TaskStatus {
                supported: true,
                installed: true,
                command,
                current_exe: current,
                matches_current_exe: matches,
            }
        }
        Err(_) => TaskStatus {
            supported: true,
            installed: false,
            command: None,
            current_exe: current,
            matches_current_exe: false,
        },
    }
}

pub fn install(dd: &DataDir) -> Result<(), String> {
    install_named(dd, TASK_NAME)
}

fn install_named(dd: &DataDir, name: &str) -> Result<(), String> {
    let exe = current_exe().ok_or("Não foi possível saber onde está a Clara.")?;
    let today = chrono::Local::now().date_naive();
    let xml = utf16le_with_bom(&task_xml(&exe, today));
    dd.ensure().map_err(|e| e.to_string())?;
    let path = dd.tmp().join("clara-tarefa.xml");
    std::fs::write(&path, xml).map_err(|e| e.to_string())?;
    let p = path.to_string_lossy().to_string();
    let r = schtasks(&["/Create", "/TN", name, "/XML", &p, "/F"]);
    let _ = std::fs::remove_file(&path);
    r.map(|_| ())
}

pub fn run_now() -> Result<(), String> {
    schtasks(&["/Run", "/TN", TASK_NAME]).map(|_| ())
}

pub fn remove() -> Result<(), String> {
    remove_named(TASK_NAME)
}

fn remove_named(name: &str) -> Result<(), String> {
    schtasks(&["/Delete", "/TN", name, "/F"]).map(|_| ())
}

pub const WEEKLY_ARG: &str = "--weekly-reminder";
const WEEKLY_TASK: &str = r"Clara\Resumo semanal";
fn weekly_xml(exe: &str, today: chrono::NaiveDate) -> String {
    task_xml(exe,today).replace("T22:00:00","T20:15:00")
 .replace("<ScheduleByDay>\n        <DaysInterval>1</DaysInterval>\n      </ScheduleByDay>","<ScheduleByWeek><WeeksInterval>1</WeeksInterval><DaysOfWeek><Friday /></DaysOfWeek></ScheduleByWeek>")
 .replace(clara_core::schedule::SCHEDULED_ARG,WEEKLY_ARG)
 .replace("Copia cifrada diária da Clara. A tarefa copia ficheiros já cifrados e nunca abre os dados.","Lembrete semanal para preparar o resumo local. Não lê dados nem envia emails.")
}
pub fn weekly_status() -> TaskStatus {
    status_named(WEEKLY_TASK)
}
pub fn weekly_remove() -> Result<(), String> {
    remove_named(WEEKLY_TASK)
}
pub fn weekly_install(dd: &DataDir) -> Result<(), String> {
    let utc = chrono::Utc::now();
    if chrono::Local::now().offset().local_minus_utc()
        != utc
            .with_timezone(&clara_core::TZ)
            .offset()
            .fix()
            .local_minus_utc()
    {
        return Err(
            "Configura o fuso horário do Windows para Lisboa antes de ativar o lembrete das 20h15."
                .into(),
        );
    }
    let exe = current_exe().ok_or("Não foi possível localizar a Clara.")?;
    dd.ensure().map_err(|e| e.to_string())?;
    let path = dd.tmp().join("clara-resumo-tarefa.xml");
    std::fs::write(
        &path,
        utf16le_with_bom(&weekly_xml(&exe, chrono::Local::now().date_naive())),
    )
    .map_err(|e| e.to_string())?;
    let result = schtasks(&[
        "/Create",
        "/TN",
        WEEKLY_TASK,
        "/XML",
        &path.to_string_lossy(),
        "/F",
    ]);
    let _ = std::fs::remove_file(path);
    result.map(|_| ())
}
pub fn show_weekly_reminder() -> i32 {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let shell = std::path::PathBuf::from(
            std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into()),
        )
        .join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let ok=std::process::Command::new(shell).args(["-NoProfile","-NonInteractive","-Command","Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Abre a Clara e escolhe Resumo semanal para preparar o email para a Sara, com a Julia em CC. Confirma que o ficheiro principal esta guardado e sincronizado. Nenhum email sera enviado automaticamente.','Clara - Resumo semanal') | Out-Null"]).creation_flags(0x08000000).status().map(|s|s.success()).unwrap_or(false);
        return if ok { 0 } else { 1 };
    }
    #[cfg(not(windows))]
    {
        1
    }
}

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    #[test]
    fn scheduler_accepts_weekly_reminder_xml(){
        let name=r"Clara\Teste resumo semanal";
        let file=std::env::temp_dir().join(format!("clara-weekly-task-{}.xml",std::process::id()));
        let exe=super::current_exe().unwrap();
        std::fs::write(&file,clara_core::schedule::utf16le_with_bom(&super::weekly_xml(&exe,chrono::Local::now().date_naive()))).unwrap();
        let result=super::schtasks(&["/Create","/TN",name,"/XML",&file.to_string_lossy(),"/F"]);
        let _=std::fs::remove_file(file);
        result.expect("criar lembrete de teste");
        let installed=super::status_named(name).installed;
        super::remove_named(name).expect("remover lembrete de teste");
        assert!(installed);
    }
    #[test]
    fn weekly_is_friday_2015_without_backup_arg() {
        let x = super::weekly_xml(
            r"C:\Clara\clara.exe",
            chrono::NaiveDate::from_ymd_opt(2026, 10, 19).unwrap(),
        );
        assert!(x.contains("T20:15:00"));
        assert!(x.contains("<Friday />"));
        assert!(!x.contains("ScheduleByDay"));
        assert!(x.contains(super::WEEKLY_ARG));
        assert!(!x.contains(clara_core::schedule::SCHEDULED_ARG));
    }
    /// Só no Windows: cria, confirma e apaga uma tarefa de teste com outro nome,
    /// para provar que o Agendador aceita o XML da Clara.
    #[cfg(windows)]
    #[test]
    fn scheduler_accepts_task_xml() {
        let name = r"Clara\Teste automatico";
        let dir = std::env::temp_dir().join(format!("clara-teste-{}", std::process::id()));
        let dd = clara_core::paths::DataDir::new(&dir);
        super::install_named(&dd, name).expect("criar tarefa");
        let st = super::status_named(name);
        assert!(st.installed);
        assert!(
            st.matches_current_exe,
            "{:?} vs {:?}",
            st.command, st.current_exe
        );
        super::remove_named(name).expect("apagar tarefa");
        assert!(!super::status_named(name).installed);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn extracts_command() {
        let x = "<Exec><Command>\"C:\\Users\\a\\Clara &amp; Co\\clara.exe\"</Command></Exec>";
        assert_eq!(
            super::extract_command(x).unwrap(),
            "C:\\Users\\a\\Clara & Co\\clara.exe"
        );
    }
}
