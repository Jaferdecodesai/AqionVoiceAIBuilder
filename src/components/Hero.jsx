import React from "react";
import { AudioLines, Languages, ScanText } from "lucide-react";

export function GridBackground() { return <div className="grid-backdrop" aria-hidden="true" />; }
export function MotionDecoration() { return <div className="motion-decoration" aria-hidden="true"><img src="/motion/service-motion.svg" alt="" /></div>; }

const notes = [
  { icon: AudioLines, title: "Speak naturally", copy: "Try a real conversation with a client-trained voice agent." },
  { icon: Languages, title: "Switch language", copy: "Each language connects to its own configured Retell agent." },
  { icon: ScanText, title: "See the outcome", copy: "Transcripts and call summaries become structured leads." },
];

export function ExperienceNotes({ side }) {
  const selected = side === "left" ? notes.slice(0, 2) : notes.slice(2);
  return <aside className={`experience-notes notes-${side}`}>{selected.map(({ icon: Icon, title, copy }, index) => <div className="experience-note" key={title}><span>0{side === "left" ? index + 1 : 3}</span><Icon size={18} /><strong>{title}</strong><p>{copy}</p></div>)}</aside>;
}

export function ClientHero({ config }) {
  return (
    <header className="hero">
      <div className="client-lockup">
        {config.brand.logo ? <img className="client-logo" src={config.brand.logo} alt={`${config.client.name} logo`} /> : <span className="client-logo-fallback">{config.client.name.slice(0, 2).toUpperCase()}</span>}
        <span className="powered-by">Voice experience by <img src="/brand/aqionlabs-wordmark.png" alt="AqionLabs" /></span>
      </div>
      <p className="eyebrow">Meet your multilingual voice agent</p>
      <h1 id="experience-title"><span>{config.client.name}</span> conversations,<br />powered by <em>AqionVOX</em></h1>
      <p className="hero-sub">{config.client.tagline || "A live AI voice experience, prepared for your business."}</p>
    </header>
  );
}
