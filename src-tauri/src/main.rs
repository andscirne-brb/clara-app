// Sem janela de consola na versão final.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Modo da tarefa agendada: copia a base cifrada e termina, sem janela.
    if std::env::args().any(|a| a == clara_core::schedule::SCHEDULED_ARG) {
        std::process::exit(clara_lib::run_scheduled_backup());
    }
    clara_lib::run();
}
