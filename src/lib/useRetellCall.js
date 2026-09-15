import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS, readStored, writeStored } from "./storage.js";

export const CALL_STATE = { idle: "idle", requestingPermission: "requesting_permission", connecting: "connecting", connected: "connected", ending: "ending", processing: "processing", completed: "completed", error: "error" };
export const ACTIVE_STATES = new Set([CALL_STATE.requestingPermission, CALL_STATE.connecting, CALL_STATE.connected, CALL_STATE.ending]);
const copy = { idle: "Choose a language, then start a live conversation.", requesting_permission: "Allow microphone access to speak with AqionVOX.", connecting: "Establishing a secure Retell connection.", connected: "Connected. Speak naturally.", ending: "Ending the call.", processing: "Fetching Retell call analysis…", completed: "Call complete. The lead dashboard is updated.", error: "The call could not be completed." };

function friendlyError(error) {
  const value = String(error?.message || error || "").toLowerCase();
  if (value.includes("permission") || value.includes("notallowed")) return "Microphone permission is required. Enable it in your browser and try again.";
  if (value.includes("agent")) return "Add a valid Retell agent ID for the selected language.";
  if (value.includes("key") || value.includes("401") || value.includes("403")) return "The Retell API key was rejected. Check the session credential.";
  return "AqionVOX could not start the call. Check the Retell configuration and microphone access.";
}

function displayTranscript(entries = []) {
  return entries.filter((item) => String(item?.content || "").trim()).map((item, index) => ({ id: `turn-${index}`, speaker: item.role === "agent" ? "agent" : "user", text: String(item.content).trim(), isFinal: true }));
}

export function useRetellCall({ agent, apiKey, clientName }) {
  const [status, setStatus] = useState(CALL_STATE.idle);
  const [statusMessage, setStatusMessage] = useState(copy.idle);
  const [errorInfo, setErrorInfo] = useState(null);
  const [transcript, setTranscript] = useState(() => readStored(STORAGE_KEYS.transcript, []) || []);
  const [lead, setLead] = useState(() => readStored(STORAGE_KEYS.lead, null));
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [completedCall, setCompletedCall] = useState(null);
  const clientRef = useRef(null); const callIdRef = useRef(""); const startedAtRef = useRef(""); const transcriptRef = useRef([]); const elapsedRef = useRef(0); const handledRef = useRef(false);
  const applyState = (next, message) => { setStatus(next); setStatusMessage(message || copy[next] || ""); };

  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);
  useEffect(() => { if (status !== CALL_STATE.connected) return undefined; const origin = Date.now() - elapsedRef.current * 1000; const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - origin) / 1000)), 1000); return () => window.clearInterval(timer); }, [status]);
  useEffect(() => () => { try { clientRef.current?.stopCall?.(); } catch { /* closed */ } }, []);

  const fetchResult = useCallback(async (callId, localTranscript) => {
    applyState(CALL_STATE.processing);
    try {
      let result = null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await fetch("/api/retell/call-result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId, apiKey }) });
        result = await response.json(); if (result.ok && result.ready) break;
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
      }
      if (!result?.ok) throw new Error(result?.error || "Retell analysis unavailable");
      const finalTranscript = result.transcript?.length ? result.transcript : localTranscript;
      const callRecord = { id: callId, clientName, language: agent?.label, agentId: agent?.agentId, startedAt: startedAtRef.current, durationSeconds: elapsedRef.current, summary: result.summary || "", transcript: finalTranscript };
      const nextLead = result.lead ? { ...result.lead, id: callId, language: agent?.label, capturedAt: new Date().toISOString(), summary: result.summary } : null;
      writeStored(STORAGE_KEYS.calls, [callRecord, ...(readStored(STORAGE_KEYS.calls, []) || []).filter((item) => item.id !== callId)].slice(0, 100));
      if (nextLead) { writeStored(STORAGE_KEYS.leads, [nextLead, ...(readStored(STORAGE_KEYS.leads, []) || []).filter((item) => item.id !== callId)].slice(0, 100)); writeStored(STORAGE_KEYS.lead, nextLead); setLead(nextLead); }
      writeStored(STORAGE_KEYS.transcript, finalTranscript); setTranscript(finalTranscript); setCompletedCall(callRecord); applyState(CALL_STATE.completed);
    } catch (error) {
      const callRecord = { id: callId, clientName, language: agent?.label, startedAt: startedAtRef.current, durationSeconds: elapsedRef.current, summary: "Retell analysis was not ready.", transcript: localTranscript };
      writeStored(STORAGE_KEYS.calls, [callRecord, ...(readStored(STORAGE_KEYS.calls, []) || [])].slice(0, 100)); setCompletedCall(callRecord); setErrorInfo({ message: error.message }); applyState(CALL_STATE.completed, "Call saved locally; Retell analysis was not available yet.");
    }
  }, [agent, apiKey, clientName]);

  const finishCall = useCallback(() => { if (handledRef.current || !callIdRef.current) return; handledRef.current = true; setIsMuted(false); fetchResult(callIdRef.current, transcriptRef.current); }, [fetchResult]);
  const startCall = useCallback(async () => {
    if (ACTIVE_STATES.has(status)) return;
    setErrorInfo(null); setTranscript([]); transcriptRef.current = []; setLead(null); setElapsed(0); setCompletedCall(null); handledRef.current = false;
    if (!agent?.agentId) { const message = "Enter a Retell agent ID for this language in the builder."; setErrorInfo({ message }); applyState(CALL_STATE.error, message); return; }
    if (!apiKey) { const message = "Enter the Retell API key in the builder for this session."; setErrorInfo({ message }); applyState(CALL_STATE.error, message); return; }
    applyState(CALL_STATE.requestingPermission);
    try {
      const response = await fetch("/api/retell/web-call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey, agentId: agent.agentId, language: agent.language, browserSessionId: crypto.randomUUID() }) });
      const result = await response.json(); if (!response.ok || !result.accessToken) throw new Error(result.error || "No access token returned");
      callIdRef.current = result.callId; startedAtRef.current = new Date().toISOString();
      const { RetellWebClient } = await import("retell-client-js-sdk");
      const client = new RetellWebClient(); clientRef.current = client;
      client.on("call_started", () => applyState(CALL_STATE.connected));
      client.on("update", (update) => { const next = displayTranscript(update?.transcript); transcriptRef.current = next; setTranscript(next); });
      client.on("call_ended", finishCall);
      client.on("error", (error) => { const message = friendlyError(error); setErrorInfo({ message }); applyState(CALL_STATE.error, message); });
      applyState(CALL_STATE.connecting); await client.startCall({ accessToken: result.accessToken });
    } catch (error) { const message = friendlyError(error); setErrorInfo({ message }); applyState(CALL_STATE.error, message); }
  }, [agent, apiKey, finishCall, status]);
  const endCall = useCallback(() => { applyState(CALL_STATE.ending); try { clientRef.current?.stopCall?.(); } catch { /* closed */ } window.setTimeout(finishCall, 150); }, [finishCall]);
  const toggleMute = useCallback(() => { setIsMuted((current) => { try { current ? clientRef.current?.unmute?.() : clientRef.current?.mute?.(); return !current; } catch { return current; } }); }, []);
  const clearTestData = useCallback(() => { setTranscript([]); setLead(null); setElapsed(0); setCompletedCall(null); setErrorInfo(null); writeStored(STORAGE_KEYS.transcript, []); applyState(CALL_STATE.idle); }, []);
  return { status, statusMessage, errorInfo, transcript, lead, elapsed, isMuted, completedCall, isActive: ACTIVE_STATES.has(status), startCall, endCall, toggleMute, clearTestData };
}
