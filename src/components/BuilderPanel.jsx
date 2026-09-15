import React, { useMemo, useRef, useState } from "react";
import {
  CheckCircle2, Download, Eye, FileText, Globe2, ImagePlus, KeyRound,
  Link2, Loader2, MapPin, Plus, Save, ShieldCheck, Trash2, UploadCloud,
} from "lucide-react";
import { exportableConfig, LANGUAGES } from "../lib/builderConfig.js";
import { STORAGE_KEYS, writeSession } from "../lib/storage.js";

const SOURCE_FIELDS = [
  ["website", "Website URL", Globe2, "https://client.com"],
  ["maps", "Google Maps entry", MapPin, "https://maps.google.com/…"],
  ["linkedin", "LinkedIn", Link2, "https://linkedin.com/company/…"],
  ["instagram", "Instagram", Link2, "https://instagram.com/…"],
  ["facebook", "Facebook", Link2, "https://facebook.com/…"],
];

function Field({ label, icon: Icon, ...props }) {
  return (
    <label className="builder-field">
      <span><Icon size={15} aria-hidden="true" />{label}</span>
      <input {...props} />
    </label>
  );
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function BuilderPanel({ config, setConfig, retellKey, setRetellKey, onSave, onPreview, saved }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const logoInput = useRef(null);
  const mediaInput = useRef(null);
  const kbInput = useRef(null);
  const urls = useMemo(() => SOURCE_FIELDS.map(([key]) => config.client[key]).filter(Boolean), [config.client]);

  const patchClient = (key, value) => setConfig((current) => ({ ...current, client: { ...current.client, [key]: value } }));
  const patchBrand = (key, value) => setConfig((current) => ({ ...current, brand: { ...current.brand, [key]: value } }));

  async function analyzeSources() {
    if (!urls.length && !config.knowledge.text && !config.knowledge.extractedText) {
      setMessage("Add at least one source or knowledge-base note first.");
      return;
    }
    setBusy("research"); setMessage("");
    setConfig((current) => ({ ...current, research: { ...current.research, status: "loading" } }));
    try {
      const response = await fetch("/api/client-research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: config.client, knowledge: `${config.knowledge.text}\n${config.knowledge.extractedText}` }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Research failed");
      setConfig((current) => ({
        ...current,
        client: { ...current.client, ...(result.client || {}) },
        research: { status: "ready", sources: result.sources, summary: result.summary, facts: result.facts },
        recommendations: result.recommendations,
      }));
      setMessage(`Analysed ${result.sources.filter((item) => item.status === "captured").length} verified source(s).`);
    } catch (error) {
      setConfig((current) => ({ ...current, research: { ...current.research, status: "error" } }));
      setMessage(error.message || "Could not analyse those sources.");
    } finally { setBusy(""); }
  }

  async function loadLogo(event) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { setMessage("Choose an image file for the logo."); return; }
    patchBrand("logo", await toDataUrl(file));
  }

  async function loadMedia(event) {
    const files = [...(event.target.files || [])].slice(0, 8);
    const next = await Promise.all(files.map(async (file) => ({ id: crypto.randomUUID(), name: file.name, type: file.type, data: await toDataUrl(file) })));
    setConfig((current) => ({ ...current, media: [...current.media, ...next].slice(0, 12) }));
  }

  async function loadKnowledge(event) {
    const file = event.target.files?.[0]; if (!file) return;
    setBusy("knowledge"); setMessage("");
    const form = new FormData(); form.append("file", file);
    try {
      const response = await fetch("/api/knowledge/extract", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not read file");
      setConfig((current) => ({ ...current, knowledge: { ...current.knowledge, fileName: file.name, extractedText: result.text } }));
      setMessage(`Knowledge base extracted from ${file.name}.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(""); }
  }

  function addAgent() {
    const used = new Set(config.agents.map((item) => item.language));
    const language = LANGUAGES.find((item) => !used.has(item.code)) || LANGUAGES[0];
    setConfig((current) => ({ ...current, agents: [...current.agents, { id: crypto.randomUUID(), language: language.code, label: language.label, agentId: "" }] }));
  }

  function patchAgent(id, key, value) {
    setConfig((current) => ({ ...current, agents: current.agents.map((agent) => agent.id === id ? { ...agent, [key]: value } : agent) }));
  }

  function removeAgent(id) {
    if (config.agents.length === 1) return;
    setConfig((current) => ({ ...current, agents: current.agents.filter((agent) => agent.id !== id) }));
  }

  function downloadConfig() {
    const blob = new Blob([JSON.stringify(exportableConfig(config), null, 2)], { type: "application/json" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `${config.client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "client"}-aqionvox.json`;
    link.click(); URL.revokeObjectURL(link.href);
  }

  function saveAll() { writeSession(STORAGE_KEYS.retellKey, retellKey); onSave(); }

  return (
    <aside className="builder-panel" aria-label="Aqion VoiceAgentBuilder configuration">
      <div className="builder-brand">
        <img src="/brand/aqionlabs-icon.png" alt="" />
        <div><strong>Aqion VoiceAgentBuilder</strong><span>Client demo studio</span></div>
        <span className="local-badge"><ShieldCheck size={14} /> Browser only</span>
      </div>

      <section className="builder-block">
        <div className="builder-step"><span>01</span><div><strong>Client sources</strong><small>Verified public information only</small></div></div>
        <div className="field-grid two">
          <Field label="Client name" icon={CheckCircle2} value={config.client.name} onChange={(e) => patchClient("name", e.target.value)} />
          <Field label="Client tagline" icon={FileText} value={config.client.tagline} onChange={(e) => patchClient("tagline", e.target.value)} />
        </div>
        <div className="field-grid">
          {SOURCE_FIELDS.map(([key, label, Icon, placeholder]) => <Field key={key} label={label} icon={Icon} type="url" placeholder={placeholder} value={config.client[key]} onChange={(e) => patchClient(key, e.target.value)} />)}
        </div>
        <button className="button secondary" type="button" onClick={analyzeSources} disabled={busy === "research"}>
          {busy === "research" ? <Loader2 className="spin" size={17} /> : <Globe2 size={17} />} Capture & analyse sources
        </button>
        {!!config.research.sources.length && <ul className="source-results">{config.research.sources.map((source) => <li key={source.url} className={source.status}><span />{source.label}<small>{source.status === "captured" ? source.provider : source.reason}</small></li>)}</ul>}
      </section>

      <section className="builder-block">
        <div className="builder-step"><span>02</span><div><strong>Brand & knowledge</strong><small>Logo, palette, imagery and client context</small></div></div>
        <div className="brand-row">
          <button className="upload-tile" type="button" onClick={() => logoInput.current?.click()}>{config.brand.logo ? <img src={config.brand.logo} alt="Client logo preview" /> : <><ImagePlus size={22} /><span>Upload logo</span></>} </button>
          <input ref={logoInput} className="sr-only" type="file" accept="image/*" onChange={loadLogo} />
          <label className="color-field"><span>Primary</span><input type="color" value={config.brand.primary} onChange={(e) => patchBrand("primary", e.target.value)} /></label>
          <label className="color-field"><span>Accent</span><input type="color" value={config.brand.accent} onChange={(e) => patchBrand("accent", e.target.value)} /></label>
        </div>
        <textarea className="knowledge-text" rows="4" placeholder="Paste the client brief, service information, FAQs, opening hours, constraints or other knowledge…" value={config.knowledge.text} onChange={(e) => setConfig((current) => ({ ...current, knowledge: { ...current.knowledge, text: e.target.value } }))} />
        <div className="upload-actions">
          <button className="button ghost" type="button" onClick={() => kbInput.current?.click()} disabled={busy === "knowledge"}>{busy === "knowledge" ? <Loader2 className="spin" size={16} /> : <UploadCloud size={16} />}{config.knowledge.fileName || "Upload PDF, DOCX or TXT"}</button>
          <button className="button ghost" type="button" onClick={() => mediaInput.current?.click()}><ImagePlus size={16} />Add images/screenshots</button>
        </div>
        <input ref={kbInput} className="sr-only" type="file" accept=".pdf,.docx,.txt,.md" onChange={loadKnowledge} />
        <input ref={mediaInput} className="sr-only" type="file" accept="image/*" multiple onChange={loadMedia} />
        {!!config.media.length && <div className="media-strip">{config.media.map((item) => <figure key={item.id}><img src={item.data} alt={item.name} /><button type="button" aria-label={`Remove ${item.name}`} onClick={() => setConfig((current) => ({ ...current, media: current.media.filter((media) => media.id !== item.id) }))}><Trash2 size={14} /></button></figure>)}</div>}
      </section>

      <section className="builder-block">
        <div className="builder-step"><span>03</span><div><strong>Retell agents</strong><small>One agent ID for each demo language</small></div></div>
        <label className="builder-field secret-field"><span><KeyRound size={15} />Retell API key</span><input type="password" autoComplete="off" placeholder="key_••••••••" value={retellKey} onChange={(e) => setRetellKey(e.target.value)} /><small>Held in this tab’s session only. Never included in exports.</small></label>
        <div className="agent-list">
          {config.agents.map((agent) => <div className="agent-row" key={agent.id}>
            <select aria-label="Agent language" value={agent.language} onChange={(e) => { const lang = LANGUAGES.find((item) => item.code === e.target.value); patchAgent(agent.id, "language", e.target.value); patchAgent(agent.id, "label", lang?.label || e.target.value); }}>
              {LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.label} · {language.nativeLabel}</option>)}
            </select>
            <input aria-label={`${agent.label} Retell agent ID`} placeholder="agent_…" value={agent.agentId} onChange={(e) => patchAgent(agent.id, "agentId", e.target.value)} />
            <button type="button" aria-label={`Remove ${agent.label} agent`} onClick={() => removeAgent(agent.id)} disabled={config.agents.length === 1}><Trash2 size={16} /></button>
          </div>)}
        </div>
        <button className="text-button" type="button" onClick={addAgent}><Plus size={16} /> Add language agent</button>
      </section>

      {message && <p className="builder-message" role="status">{message}</p>}
      <div className="builder-footer">
        <button className="button ghost" type="button" onClick={downloadConfig}><Download size={17} />Export</button>
        <button className="button secondary" type="button" onClick={saveAll}>{saved ? <CheckCircle2 size={17} /> : <Save size={17} />}{saved ? "Saved" : "Save draft"}</button>
        <button className="button primary" type="button" onClick={onPreview}><Eye size={17} />Preview demo</button>
      </div>
    </aside>
  );
}
