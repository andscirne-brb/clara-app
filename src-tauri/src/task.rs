//! Tarefa do Agendador do Windows para o backup das 22h.
//! Usa `schtasks`, que já vem com o Windows e não precisa de administrador.

use serde::Serialize;

use clara_core::paths::DataDir;
use clara_core::schedule::{task_xml, utf16le_with_bom, TASK_NAME};

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
        Err(format!("O Agendador de Tarefas recusou: {}", String::from_utf8_lossy(&out.stderr).trim()))
    }
}

#[cfg(not(windows))]
fn schtasks(_args: &[&str]) -> Result<String, String> {
    Err("A tarefa agendada só está disponível no Windows.".into())
}

fn current_exe() -> Option<String> {
    std::env::current_exe().ok().map(|p| p.to_string_lossy().to_string())
}

fn extract_command(xml: &str) -> Option<String> {
    let start = xml.find("<Command>")? + "<Command>".len();
    let end = xml[start..].find("</Command>")? + start;
    Some(xml[start..end].replace("&amp;", "&").replace("&quot;", "\"").trim_matches('"').to_string())
}

pub fn status() -> TaskStatus {
    status_named(TASK_NAME)
}

fn status_named(name: &str) -> TaskStatus {
    let current = current_exe();
    if !cfg!(windows) {
        return TaskStatus { supported: false, installed: false, command: None, current_exe: current, matches_current_exe: false };
    }
    match schtasks(&["/Query", "/TN", name, "/XML"]) {
        Ok(xml) => {
            let command = extract_command(&xml);
            let matches = match (&command, &current) {
                (Some(a), Some(b)) => a.eq_ignore_ascii_case(b),
                _ => false,
            };
            TaskStatus { supported: true, installed: true, command, current_exe: current, matches_current_exe: matches }
        }
        Err(_) => TaskStatus { supported: true, installed: false, command: None, current_exe: current, matches_current_exe: false },
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

#[cfg(test)]
mod tests {
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
        assert!(st.matches_current_exe, "{:?} vs {:?}", st.command, st.current_exe);
        super::remove_named(name).expect("apagar tarefa");
        assert!(!super::status_named(name).installed);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn extracts_command() {
        let x = "<Exec><Command>\"C:\\Users\\a\\Clara &amp; Co\\clara.exe\"</Command></Exec>";
        assert_eq!(super::extract_command(x).unwrap(), "C:\\Users\\a\\Clara & Co\\clara.exe");
    }
}
