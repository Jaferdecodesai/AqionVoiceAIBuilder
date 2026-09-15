/**
 * Versioned browser-only storage. Retell secrets intentionally use
 * sessionStorage and are excluded from exported client configurations.
 */

const SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  config: "aqion_voice_builder_config",
  leads: "aqion_voice_builder_leads",
  calls: "aqion_voice_builder_calls",
  lead: "aqion_voice_builder_latest_lead",
  transcript: "aqion_voice_builder_latest_transcript",
  recipients: "aqion_voice_builder_notification_recipients",
  retellKey: "aqion_voice_builder_retell_key",
};

function readRaw(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readStored(key, fallback) {
  const raw = readRaw(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return fallback;
    if (parsed.v !== SCHEMA_VERSION) return fallback;
    return parsed.data ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key, data) {
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: SCHEMA_VERSION, at: new Date().toISOString(), data }));
  } catch {
    // Storage can be unavailable (private mode, quota). Persistence is a
    // convenience here, never a requirement for the call to work.
  }
}

export function removeStored(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore — see writeStored.
  }
}

export function readSession(key, fallback = "") {
  try { return window.sessionStorage.getItem(key) || fallback; } catch { return fallback; }
}

export function writeSession(key, value) {
  try { window.sessionStorage.setItem(key, String(value || "")); } catch { /* optional */ }
}
