import { STORAGE_KEYS, readStored, writeStored } from "./storage.js";

export const LANGUAGES = [
  ["en-US", "English", "English"], ["ar-AE", "Arabic", "العربية"],
  ["hi-IN", "Hindi", "हिन्दी"], ["ml-IN", "Malayalam", "മലയാളം"],
  ["ta-IN", "Tamil", "தமிழ்"], ["de-DE", "German", "Deutsch"],
  ["fr-FR", "French", "Français"], ["it-IT", "Italian", "Italiano"],
  ["es-ES", "Spanish", "Español"], ["ru-RU", "Russian", "Русский"],
  ["fil-PH", "Tagalog", "Tagalog"],
].map(([code, label, nativeLabel]) => ({ code, label, nativeLabel }));

export const DEFAULT_CONFIG = {
  client: { name: "Your Client", tagline: "AI-powered customer conversations", website: "", maps: "", linkedin: "", instagram: "", facebook: "" },
  brand: { primary: "#2563EB", accent: "#059669", background: "#F8FAFC", logo: "", font: "Plus Jakarta Sans" },
  media: [],
  knowledge: { text: "", fileName: "", extractedText: "" },
  research: { status: "idle", sources: [], summary: "", facts: [] },
  agents: [{ id: crypto.randomUUID(), language: "en-US", agentId: "", label: "English" }],
  recommendations: [],
  updatedAt: new Date().toISOString(),
};

export function loadConfig() {
  const saved = readStored(STORAGE_KEYS.config, null);
  if (!saved) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG, ...saved,
    client: { ...DEFAULT_CONFIG.client, ...(saved.client || {}) },
    brand: { ...DEFAULT_CONFIG.brand, ...(saved.brand || {}) },
    knowledge: { ...DEFAULT_CONFIG.knowledge, ...(saved.knowledge || {}) },
    research: { ...DEFAULT_CONFIG.research, ...(saved.research || {}) },
    agents: saved.agents?.length ? saved.agents : DEFAULT_CONFIG.agents,
  };
}

export function saveConfig(config) {
  writeStored(STORAGE_KEYS.config, { ...config, updatedAt: new Date().toISOString() });
}

export function exportableConfig(config) {
  return { ...config, exportedAt: new Date().toISOString(), retellApiKey: undefined };
}

export const EMBEDDED_BUILD_RULES = {
  scraping: ["Prefer Firecrawl when connected", "Report blocked sources", "Never invent client facts", "Keep API keys server-side"],
  mobile: ["44px minimum touch targets", "Safe-area aware", "Mobile-first layout", "Language selector fits 375px"],
  interaction: ["150–300ms feedback", "Async loading state", "Reduced-motion support", "No hover-only actions"],
  responsive: ["Fluid type and spacing", "Content-driven breakpoints", "No horizontal overflow", "Card-based mobile data"],
  visual: ["Token-driven client branding", "WCAG AA contrast", "Consistent Lucide icons", "No decorative 3D effects"],
};
