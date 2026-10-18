use chrono::{DateTime, SecondsFormat, Utc};
use std::sync::Mutex;

/// Relógio substituível, para testar rotação e horários sem esperar.
pub trait Clock: Send + Sync {
    fn now(&self) -> DateTime<Utc>;
}

pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> DateTime<Utc> {
        Utc::now()
    }
}

/// Relógio fixo para testes.
pub struct FixedClock(pub Mutex<DateTime<Utc>>);

impl FixedClock {
    pub fn new(t: DateTime<Utc>) -> Self {
        Self(Mutex::new(t))
    }
    pub fn set(&self, t: DateTime<Utc>) {
        *self.0.lock().unwrap() = t;
    }
}

impl Clock for FixedClock {
    fn now(&self) -> DateTime<Utc> {
        *self.0.lock().unwrap()
    }
}

/// Timestamps guardados sempre em UTC, formato RFC 3339 com milissegundos.
pub fn ts(t: DateTime<Utc>) -> String {
    t.to_rfc3339_opts(SecondsFormat::Millis, true)
}
