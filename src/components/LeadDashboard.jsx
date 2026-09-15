import React, { useMemo, useState } from "react";
import { BarChart3, Clock3, Languages, PhoneCall, Search, UsersRound } from "lucide-react";
import { STORAGE_KEYS, readStored } from "../lib/storage.js";

const clock = (seconds) => `${Math.floor((seconds || 0) / 60)}:${String((seconds || 0) % 60).padStart(2, "0")}`;
const when = (iso) => iso ? new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";

export function LeadDashboard({ latestCall, latestLead, clientName }) {
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const calls = useMemo(() => { const stored = readStored(STORAGE_KEYS.calls, []) || []; return latestCall ? [latestCall, ...stored.filter((item) => item.id !== latestCall.id)] : stored; }, [latestCall]);
  const leads = useMemo(() => { const stored = readStored(STORAGE_KEYS.leads, []) || []; return latestLead ? [latestLead, ...stored.filter((item) => item.id !== latestLead.id)] : stored; }, [latestLead]);
  const filtered = leads.filter((lead) => JSON.stringify(lead).toLowerCase().includes(query.toLowerCase()));
  const average = calls.length ? Math.round(calls.reduce((sum, call) => sum + Number(call.durationSeconds || 0), 0) / calls.length) : 0;

  return (
    <section className="demo-section dashboard-section" aria-labelledby="dashboard-title">
      <div className="section-intro"><p className="eyebrow">Browser-only live dashboard</p><h2 id="dashboard-title">Call intelligence for {clientName}</h2><p>Call records, transcripts and summary-derived leads stay in this browser. Nothing is sent to a database.</p></div>
      <div className="dashboard-shell">
        <aside className="dash-sidebar">
          <div className="dash-brand"><img src="/brand/aqionlabs-icon.png" alt="" /><span><strong>AqionVOX</strong><small>Lead workspace</small></span></div>
          <nav aria-label="Dashboard sections">
            <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><BarChart3 size={18} />Overview</button>
            <button className={tab === "leads" ? "active" : ""} onClick={() => setTab("leads")}><UsersRound size={18} />Leads <b>{leads.length}</b></button>
            <button className={tab === "calls" ? "active" : ""} onClick={() => setTab("calls")}><PhoneCall size={18} />Calls <b>{calls.length}</b></button>
          </nav>
          <small className="storage-note">Stored locally on this device</small>
        </aside>
        <div className="dash-main">
          <header className="dash-top"><div><strong>{tab[0].toUpperCase() + tab.slice(1)}</strong><span>Retell call analysis</span></div>{tab === "leads" && <label className="dash-search"><Search size={16} /><input aria-label="Search leads" placeholder="Search leads" value={query} onChange={(e) => setQuery(e.target.value)} /></label>}</header>
          {tab === "overview" && <div className="dash-content">
            <div className="kpi-grid"><article><PhoneCall size={19} /><span>Total calls</span><strong>{calls.length}</strong><small>on this browser</small></article><article><UsersRound size={19} /><span>Captured leads</span><strong>{leads.length}</strong><small>from call summaries</small></article><article><Clock3 size={19} /><span>Average duration</span><strong>{clock(average)}</strong><small>minutes</small></article><article><Languages size={19} /><span>Languages used</span><strong>{new Set(calls.map((item) => item.language).filter(Boolean)).size}</strong><small>configured agents</small></article></div>
            <div className="activity-card"><div className="card-head"><strong>Recent activity</strong><span>{calls.length ? "Latest calls" : "Ready for first call"}</span></div>{calls.length ? calls.slice(0, 5).map((call) => <div className="activity-row" key={call.id}><span className="activity-icon"><PhoneCall size={16} /></span><div><strong>{call.language || "Voice call"}</strong><small>{call.summary || "Transcript captured"}</small></div><time>{when(call.startedAt)}</time></div>) : <Empty text="Start a call in the phone demo to populate this dashboard." />}</div>
          </div>}
          {tab === "leads" && <div className="dash-content"><div className="data-card"><div className="data-head"><span>Contact</span><span>Company</span><span>Requirement</span><span>Language</span></div>{filtered.length ? filtered.map((lead) => <article className="data-row" key={lead.id}><span><strong>{lead.customer_name || "Unnamed caller"}</strong><small>{lead.phone_number || lead.email || "No contact captured"}</small></span><span>{lead.company_name || "—"}</span><span>{lead.requirement_summary || lead.summary || "—"}</span><span className="language-chip">{lead.language || "—"}</span></article>) : <Empty text="No summary-derived leads match this view." />}</div></div>}
          {tab === "calls" && <div className="dash-content"><div className="calls-grid">{calls.length ? calls.map((call) => <article className="call-card" key={call.id}><div><span className="language-chip">{call.language || "Voice"}</span><time>{when(call.startedAt)}</time></div><h3>{call.summary || "Conversation captured"}</h3><p>{call.transcript?.length || 0} transcript turns · {clock(call.durationSeconds)}</p>{call.transcript?.length ? <details><summary>Read transcript</summary><ol>{call.transcript.map((turn) => <li key={turn.id}><strong>{turn.speaker === "agent" ? "AqionVOX" : "Caller"}</strong><span dir="auto">{turn.text}</span></li>)}</ol></details> : null}</article>) : <Empty text="Completed calls will appear here." />}</div></div>}
        </div>
      </div>
    </section>
  );
}

function Empty({ text }) { return <div className="empty-state"><span><PhoneCall size={21} /></span><p>{text}</p></div>; }
