import React, { useEffect, useRef } from "react";
import { AudioWaveform, Loader2, Mic, MicOff, PhoneCall, PhoneOff, Sparkles, TriangleAlert } from "lucide-react";
import { CALL_STATE } from "../lib/useRetellCall.js";

const duration = (seconds) => `${String(Math.floor((seconds || 0) / 60)).padStart(2, "0")}:${String((seconds || 0) % 60).padStart(2, "0")}`;

function Status({ status, elapsed }) {
  const values = { idle: ["ready", "Ready"], requesting_permission: ["pending", "Microphone"], connecting: ["pending", "Connecting"], connected: ["live", "Live"], ending: ["pending", "Ending"], processing: ["pending", "Analysing"], completed: ["ready", "Complete"], error: ["error", "Attention"] };
  const [tone, label] = values[status] || values.idle;
  return <span className={`status-pill tone-${tone}`} role="status"><i />{label}{status === CALL_STATE.connected && <b>{duration(elapsed)}</b>}</span>;
}

function Transcript({ items, language }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [items]);
  if (!items.length) return <div className="transcript-empty"><AudioWaveform size={24} /><p>Your {language} transcript will appear here as you speak.</p></div>;
  return <ol ref={ref} className="phone-transcript" aria-live="polite">{items.map((item) => <li key={item.id} className={`from-${item.speaker}`}><span>{item.speaker === "agent" ? "AqionVOX" : "You"}</span><p dir="auto">{item.text}</p></li>)}</ol>;
}

export function PhoneMockup({ call, config, selectedAgent, onSelectAgent }) {
  const busy = [CALL_STATE.requestingPermission, CALL_STATE.connecting, CALL_STATE.ending, CALL_STATE.processing].includes(call.status);
  const live = [CALL_STATE.connected, CALL_STATE.ending].includes(call.status);
  return (
    <div className={`phone ${live ? "is-live" : ""}`} style={{ "--client-primary": config.brand.primary, "--client-accent": config.brand.accent }}>
      <span className="phone-side-button side-volume-up" aria-hidden="true" /><span className="phone-side-button side-volume-down" aria-hidden="true" /><span className="phone-side-button side-power" aria-hidden="true" />
      <div className="phone-screen">
        <div className="phone-safe-top"><span>9:41</span><i /></div>
        <header className="agent-header">
          <div className="agent-identity-wrap">
            <span className="agent-mark">{config.brand.logo ? <img src={config.brand.logo} alt="" /> : <AudioWaveform size={16} />}</span>
            <div className="agent-identity"><span>{config.client.name}</span><strong>AqionVOX</strong></div>
          </div>
          <Status status={call.status} elapsed={call.elapsed} />
        </header>
        {config.agents.length > 1 && <div className="language-switch" role="group" aria-label="Voice agent language">{config.agents.map((agent) => <button key={agent.id} type="button" className={selectedAgent.id === agent.id ? "active" : ""} onClick={() => onSelectAgent(agent.id)} disabled={call.isActive}>{agent.label}</button>)}</div>}
        <div className="phone-content">
          {live ? <Transcript items={call.transcript} language={selectedAgent.label} /> : (
            <div className="phone-state">
              <span className={`voice-core ${busy ? "pending" : ""}`}>{busy ? <Loader2 className="spin" size={27} /> : call.status === CALL_STATE.error ? <TriangleAlert size={27} /> : <Sparkles size={27} />}</span>
              <strong>{call.status === CALL_STATE.completed ? "Conversation complete" : call.status === CALL_STATE.error ? "Configuration needed" : busy ? "Preparing AqionVOX" : `Talk with ${config.client.name}`}</strong>
              <p>{call.statusMessage}</p>
            </div>
          )}
          {call.status === CALL_STATE.connected && <div className="listening"><span className="waveform">{[1,2,3,4,5,6,7].map((item) => <i key={item} />)}</span>{call.isMuted ? "Muted" : "Listening"}</div>}
          {call.status === CALL_STATE.connected ? <div className="controls-live">
            <button type="button" onClick={call.toggleMute} aria-label={call.isMuted ? "Unmute microphone" : "Mute microphone"}>{call.isMuted ? <MicOff size={20} /> : <Mic size={20} />}<span>{call.isMuted ? "Unmute" : "Mute"}</span></button>
            <button className="end" type="button" onClick={call.endCall}><PhoneOff size={20} /><span>End call</span></button>
          </div> : <button type="button" className="start-call" disabled={busy} onClick={call.startCall}>{busy ? <Loader2 className="spin" size={18} /> : <PhoneCall size={18} />}{call.status === CALL_STATE.completed || call.status === CALL_STATE.error ? "Start new call" : "Start live call"}</button>}
        </div>
        <span className="home-indicator" aria-hidden="true" />
      </div><span className="phone-shadow" aria-hidden="true" />
    </div>
  );
}
