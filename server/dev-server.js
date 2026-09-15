import path from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns/promises";
import net from "node:net";
import "./load-env.js";
import express from "express";
import mammoth from "mammoth";
import multer from "multer";
import nodemailer from "nodemailer";
import pdfParse from "pdf-parse";
import { createServer as createViteServer } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const port = Number(process.env.PORT || 5173);
const hmrPort = Number(process.env.HMR_PORT || port + 20000);
const isProduction = process.env.NODE_ENV === "production";
const retellApiBase = process.env.RETELL_API_BASE || "https://api.retellai.com";
const firecrawlBase = process.env.FIRECRAWL_API_BASE || "https://api.firecrawl.dev/v1";
const defaultRecipient = process.env.AQION_NOTIFICATION_EMAIL || "jaferm@aqionlabs.com";

app.use(express.json({ limit: "2mb" }));

function apiError(response, error, status = 500) {
  console.error(error);
  response.status(status).json({ ok: false, error: error?.message || "Unexpected server error" });
}

function isPrivateIp(ip) {
  if (!net.isIP(ip)) return true;
  return ip === "::1" || ip.startsWith("10.") || ip.startsWith("127.") || ip.startsWith("169.254.") || ip.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80:");
}

async function safeUrl(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS sources are supported.");
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error("Private or local network URLs are not allowed.");
  return url;
}

function decode(text) {
  return String(text || "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
}

function cleanHtml(html) {
  return decode(String(html || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 18000);
}

function metadataFromHtml(html, url) {
  const title = decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "").trim();
  const description = decode(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i.exec(html)?.[1] || /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i.exec(html)?.[1] || "").trim();
  return { title, description, text: cleanHtml(html), url };
}

async function firecrawl(url) {
  const response = await fetch(`${firecrawlBase}/scrape`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` }, body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }), signal: AbortSignal.timeout(30000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success === false) throw new Error(result.error || `Firecrawl returned ${response.status}`);
  const data = result.data || result;
  return { title: data.metadata?.title || "", description: data.metadata?.description || "", text: String(data.markdown || data.content || "").slice(0, 18000), url };
}

async function directScrape(url) {
  const response = await fetch(url, { headers: { "User-Agent": "AqionVoiceAgentBuilder/1.0 (+https://aqionlabs.com)", Accept: "text/html,application/xhtml+xml" }, redirect: "manual", signal: AbortSignal.timeout(15000) });
  if (response.status >= 300 && response.status < 400) throw new Error("Source redirected; use the final public URL.");
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) throw new Error("Source did not return a public HTML page.");
  const html = (await response.text()).slice(0, 800000);
  return metadataFromHtml(html, url);
}

function sourceLabel(key) {
  return { website: "Website", maps: "Google Maps", linkedin: "LinkedIn", instagram: "Instagram", facebook: "Facebook" }[key] || key;
}

function factsFromPages(pages) {
  const facts = [];
  pages.forEach((page) => {
    if (page.title) facts.push({ label: "Page title", value: page.title, source: page.url });
    if (page.description) facts.push({ label: "Published description", value: page.description, source: page.url });
  });
  return facts.slice(0, 12);
}

function recommendationsFor(text) {
  const haystack = String(text || "").toLowerCase();
  const rules = [
    { terms: ["appointment", "booking", "schedule", "reservation"], title: "Automated appointment workflow", description: "Connect qualified voice enquiries to availability, confirmations and reminders.", evidence: "Booking or appointment language in supplied content" },
    { terms: ["quote", "quotation", "estimate", "pricing"], title: "AI-assisted quotation intake", description: "Structure requirements from calls and route complete requests to the estimating team.", evidence: "Quote or pricing language in supplied content" },
    { terms: ["support", "service request", "maintenance", "complaint"], title: "Customer support triage", description: "Classify requests, capture urgency and hand off a clear case summary to the right team.", evidence: "Support or service language in supplied content" },
    { terms: ["property", "real estate", "listing", "viewing"], title: "Property enquiry qualification", description: "Capture preferences, budget signals and viewing intent before the human follow-up.", evidence: "Property-related language in supplied content" },
    { terms: ["restaurant", "menu", "delivery", "order"], title: "Conversational order and enquiry handling", description: "Answer common service questions and structure orders or reservation requests for staff review.", evidence: "Food service or order language in supplied content" },
    { terms: ["lead", "sales", "customer", "contact"], title: "Lead routing and follow-up automation", description: "Move structured AqionVOX call outcomes into an approved CRM or follow-up workflow.", evidence: "Lead, sales or customer language in supplied content" },
    { terms: ["document", "pdf", "form", "application"], title: "Document intake automation", description: "Classify uploaded documents, extract agreed fields and route exceptions for human review.", evidence: "Document or application language in supplied content" },
  ];
  return rules.filter((rule) => rule.terms.some((term) => haystack.includes(term))).slice(0, 3).map(({ title, description, evidence }) => ({ title, description, evidence }));
}

app.get("/api/health", (_request, response) => response.json({ ok: true, storage: "browser-only", firecrawl: Boolean(process.env.FIRECRAWL_API_KEY), retellDefault: Boolean(process.env.RETELL_API_KEY && process.env.RETELL_AGENT_ID) }));

app.post("/api/client-research", async (request, response) => {
  try {
    const client = request.body?.client || {};
    const entries = ["website", "maps", "linkedin", "instagram", "facebook"].filter((key) => client[key]).map((key) => [key, client[key]]);
    const results = await Promise.all(entries.map(async ([key, rawUrl]) => {
      try {
        const url = String(await safeUrl(rawUrl));
        const page = process.env.FIRECRAWL_API_KEY ? await firecrawl(url) : await directScrape(url);
        return { key, url, label: sourceLabel(key), status: "captured", provider: process.env.FIRECRAWL_API_KEY ? "Firecrawl" : "Direct public page", page };
      } catch (error) { return { key, url: rawUrl, label: sourceLabel(key), status: "unavailable", reason: error.message }; }
    }));
    const pages = results.filter((item) => item.page).map((item) => item.page);
    const knowledge = String(request.body?.knowledge || "").slice(0, 50000);
    const combined = [...pages.map((page) => `${page.title}\n${page.description}\n${page.text}`), knowledge].join("\n");
    const first = pages[0];
    const inferredName = first?.title?.split(/[|–—-]/)[0]?.trim();
    response.json({ ok: true, client: client.name === "Your Client" && inferredName ? { name: inferredName } : {}, sources: results.map(({ page, ...item }) => item), facts: factsFromPages(pages), summary: pages.length ? `Captured public content from ${pages.length} source${pages.length === 1 ? "" : "s"}. Review the extracted facts before using them in a client demo.` : "No public source content was captured. Only the supplied knowledge base was analysed.", recommendations: recommendationsFor(combined) });
  } catch (error) { apiError(response, error, 400); }
});

app.post("/api/knowledge/extract", upload.single("file"), async (request, response) => {
  try {
    if (!request.file) throw new Error("Choose a knowledge-base file first.");
    const ext = path.extname(request.file.originalname).toLowerCase();
    let text = "";
    if ([".txt", ".md", ".csv"].includes(ext)) text = request.file.buffer.toString("utf8");
    else if (ext === ".pdf") text = (await pdfParse(request.file.buffer)).text;
    else if (ext === ".docx") text = (await mammoth.extractRawText({ buffer: request.file.buffer })).value;
    else throw new Error("Supported knowledge files are PDF, DOCX, TXT, MD and CSV.");
    response.json({ ok: true, text: String(text || "").replace(/\u0000/g, "").trim().slice(0, 50000), fileName: request.file.originalname });
  } catch (error) { apiError(response, error, 400); }
});

async function retellFetch(endpoint, apiKey, options = {}) {
  const response = await fetch(`${retellApiBase}${endpoint}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...(options.headers || {}) }, signal: AbortSignal.timeout(20000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.message || result?.error || `Retell returned ${response.status}`);
  return result;
}

app.post("/api/retell/web-call", async (request, response) => {
  try {
    const apiKey = String(request.body?.apiKey || process.env.RETELL_API_KEY || "").trim();
    const agentId = String(request.body?.agentId || process.env.RETELL_AGENT_ID || "").trim();
    if (!apiKey || !agentId) return response.status(400).json({ ok: false, error: "A Retell API key and agent ID are required." });
    const result = await retellFetch("/v2/create-web-call", apiKey, { method: "POST", body: JSON.stringify({ agent_id: agentId, metadata: { source: "Aqion VoiceAgentBuilder", language: String(request.body?.language || ""), browserSessionId: String(request.body?.browserSessionId || "") } }) });
    response.json({ ok: true, accessToken: result.access_token, callId: result.call_id, agentId });
  } catch (error) { apiError(response, error, 502); }
});

function grab(summary, labels) {
  for (const label of labels) {
    const match = new RegExp(`${label}\\s*[:=-]\\s*([^;\\n]+)`, "i").exec(summary);
    if (match) { const value = match[1].trim().replace(/\.$/, ""); if (!/^(none|unknown|not (provided|captured)|n\/a)$/i.test(value)) return value.slice(0, 240); }
  }
  return "";
}

function leadFromCall(call) {
  const analysis = call.call_analysis || {};
  const custom = analysis.custom_analysis_data || {};
  const summary = String(analysis.call_summary || "");
  const lead = {
    customer_name: custom.customer_name || custom.name || grab(summary, ["Customer Name", "Caller Name", "Name"]),
    company_name: custom.company_name || custom.company || grab(summary, ["Company", "Organization"]),
    phone_number: custom.phone_number || custom.phone || grab(summary, ["Phone", "Contact Number"]),
    email: custom.email || custom.email_id || grab(summary, ["Email"]),
    requirement_summary: custom.requirement_summary || custom.requirement || grab(summary, ["Requirement", "Needs", "Request"]),
    location: custom.location || grab(summary, ["Location"]),
  };
  const cleaned = Object.fromEntries(Object.entries(lead).filter(([, value]) => String(value || "").trim()));
  return Object.keys(cleaned).length ? cleaned : null;
}

app.post("/api/retell/call-result", async (request, response) => {
  try {
    const apiKey = String(request.body?.apiKey || process.env.RETELL_API_KEY || "").trim();
    const callId = String(request.body?.callId || "").trim();
    if (!apiKey || !callId) return response.status(400).json({ ok: false, error: "Retell credentials and call ID are required." });
    const call = await retellFetch(`/v2/get-call/${encodeURIComponent(callId)}`, apiKey);
    const transcript = Array.isArray(call.transcript_object) ? call.transcript_object.filter((turn) => String(turn?.content || "").trim()).map((turn, index) => ({ id: `${callId}-${index}`, speaker: turn.role === "agent" ? "agent" : "user", text: String(turn.content).trim(), isFinal: true })) : [];
    response.json({ ok: true, ready: Boolean(call.end_timestamp || call.call_analysis), summary: call.call_analysis?.call_summary || "", lead: leadFromCall(call), transcript });
  } catch (error) { apiError(response, error, 502); }
});

app.post("/api/email-updates", async (request, response) => {
  try {
    const recipients = [...new Set((Array.isArray(request.body?.recipients) ? request.body.recipients : [defaultRecipient]).map((value) => String(value).trim().toLowerCase()).filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))];
    const message = String(request.body?.message || "").trim();
    if (!recipients.length || !message) return response.status(400).json({ ok: false, error: "A valid recipient and call summary are required." });
    if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM) return response.json({ ok: true, configured: false, sent: 0, recipients });
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: String(process.env.SMTP_SECURE).toLowerCase() === "true", auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
    const result = await transport.sendMail({ from: process.env.EMAIL_FROM, to: recipients, subject: String(request.body?.subject || "AqionVOX call summary"), text: message });
    response.json({ ok: true, configured: true, sent: recipients.length, messageId: result.messageId });
  } catch (error) { apiError(response, error); }
});

if (isProduction) { const dist = path.join(root, "dist"); app.use(express.static(dist)); app.get(/.*/, (_request, response) => response.sendFile(path.join(dist, "index.html"))); }
else { const vite = await createViteServer({ root, server: { middlewareMode: true, host: "0.0.0.0", hmr: { port: hmrPort } }, appType: "spa" }); app.use(vite.middlewares); }

app.listen(port, "0.0.0.0", () => console.log(`Aqion VoiceAgentBuilder running at http://localhost:${port}/`));
