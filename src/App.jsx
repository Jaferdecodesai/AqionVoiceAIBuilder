import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, Database, ExternalLink, Settings2, Sparkles, Workflow } from "lucide-react";
import { BuilderPanel } from "./components/BuilderPanel.jsx";
import { ClientHero, ExperienceNotes, GridBackground, MotionDecoration } from "./components/Hero.jsx";
import { PhoneMockup } from "./components/PhoneMockup.jsx";
import { LeadDashboard } from "./components/LeadDashboard.jsx";
import { EmailRecipients } from "./components/EmailRecipients.jsx";
import { loadConfig, saveConfig } from "./lib/builderConfig.js";
import { STORAGE_KEYS, readSession } from "./lib/storage.js";
import { useRetellCall } from "./lib/useRetellCall.js";

export default function App() {
  const [config, setConfig] = useState(loadConfig);
  const [retellKey, setRetellKey] = useState(() => readSession(STORAGE_KEYS.retellKey, ""));
  const [selectedAgentId, setSelectedAgentId] = useState(() => config.agents[0]?.id);
  const [preview, setPreview] = useState(() => new URLSearchParams(window.location.search).get("view") === "demo");
  const [saved, setSaved] = useState(false);
  const selectedAgent = useMemo(() => config.agents.find((item) => item.id === selectedAgentId) || config.agents[0], [config.agents, selectedAgentId]);
  const call = useRetellCall({ agent: selectedAgent, apiKey: retellKey, clientName: config.client.name });

  useEffect(() => { if (!config.agents.some((item) => item.id === selectedAgentId)) setSelectedAgentId(config.agents[0]?.id); }, [config.agents, selectedAgentId]);
  useEffect(() => { setSaved(false); }, [config]);
  const save = () => { saveConfig(config); setSaved(true); };

  return (
    <div className={`app-shell ${preview ? "preview-mode" : "builder-mode"}`} style={{ "--primary": config.brand.primary, "--accent": config.brand.accent, "--client-bg": config.brand.background }}>
      {!preview && <BuilderPanel config={config} setConfig={setConfig} retellKey={retellKey} setRetellKey={setRetellKey} onSave={save} onPreview={() => { save(); setPreview(true); window.history.replaceState({}, "", "?view=demo"); }} saved={saved} />}
      <div className="demo-canvas">
        {preview && <button className="edit-builder" type="button" onClick={() => { setPreview(false); window.history.replaceState({}, "", window.location.pathname); }}><ArrowLeft size={17} />Edit builder</button>}
        {!preview && <div className="canvas-toolbar"><span><Settings2 size={16} />Live preview</span><small>Changes appear instantly</small></div>}
        <GridBackground />
        <main>
          <section className="stage" aria-labelledby="experience-title">
            <MotionDecoration /><ClientHero config={config} />
            <div className="installation"><ExperienceNotes side="left" /><PhoneMockup call={call} config={config} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgentId} /><ExperienceNotes side="right" /></div>
            <p className="stage-caption">One conversation. Live understanding. A structured opportunity ready for your team.</p>
          </section>

          {config.media.length > 0 && <section className="demo-section media-section"><div className="section-intro"><p className="eyebrow">Prepared for {config.client.name}</p><h2>Services, spaces and customer context</h2></div><div className="client-media-grid">{config.media.slice(0, 6).map((item) => <figure key={item.id}><img src={item.data} alt={item.name} loading="lazy" /><figcaption>{item.name.replace(/\.[^.]+$/, "")}</figcaption></figure>)}</div></section>}

          <LeadDashboard latestCall={call.completedCall} latestLead={call.lead} clientName={config.client.name} />
          <EmailRecipients completedCall={call.completedCall} lead={call.lead} transcript={call.transcript} durationSeconds={call.elapsed} />
          <Recommendations config={config} />
        </main>
        <footer className="page-footer"><span><img src="/brand/aqionlabs-icon.png" alt="" />AqionVOX by AqionLabs</span><span>Client-specific voice AI, demonstrated live.</span></footer>
      </div>
    </div>
  );
}

function Recommendations({ config }) {
  const icons = [Workflow, Bot, Database];
  return (
    <section className="demo-section recommendations" aria-labelledby="recommendations-title">
      <div className="recommendation-head"><div><p className="eyebrow">Beyond the voice demo</p><h2 id="recommendations-title">Where AqionLabs could help next</h2><p>These are opportunity hypotheses based only on the sources and knowledge base provided—not claims about the client’s current systems.</p></div><span><Sparkles size={18} />Evidence-led</span></div>
      {config.recommendations.length ? <div className="recommendation-grid">{config.recommendations.map((item, index) => { const Icon = icons[index % icons.length]; return <article key={item.title}><span><Icon size={20} /></span><div><h3>{item.title}</h3><p>{item.description}</p><small><CheckCircle2 size={13} />Signal: {item.evidence}</small></div></article>; })}</div> : <div className="recommendation-empty"><Sparkles size={23} /><div><strong>Add client evidence to generate relevant ideas</strong><p>Paste a brief or analyse public sources in the builder. AqionLabs recommendations remain empty until there is evidence to support them.</p></div></div>}
      {!!config.research.sources.length && <div className="evidence-row"><strong>Source status</strong>{config.research.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className={source.status}><span />{source.label}<ExternalLink size={12} /></a>)}</div>}
    </section>
  );
}
