export function formatDuration(seconds = 0) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function buildEmailSummary(call = {}) {
  const lead = call.lead || {};
  const lines = [
    "AqionVOX call summary",
    `Call ID: ${call.id || call.sessionId || "Not available"}`,
    `Client: ${call.clientName || lead.company_name || "Not captured"}`,
    `Language: ${call.language || lead.language || "Not captured"}`,
    `Started: ${call.startedAt ? new Date(call.startedAt).toLocaleString() : "Not captured"}`,
    `Duration: ${formatDuration(call.durationSeconds || 0)}`,
    "",
    `Caller: ${lead.customer_name || "Not captured"}`,
    `Company: ${lead.company_name || "Not captured"}`,
    `Phone: ${lead.phone_number || "Not captured"}`,
    `Email: ${lead.email || "Not captured"}`,
    `Requirement: ${lead.requirement_summary || call.summary || "Not captured"}`,
    "",
    "Transcript",
    ...(call.transcript || []).map((turn) => `${turn.speaker === "agent" ? "AqionVOX" : "Caller"}: ${turn.text}`),
  ];
  return lines.join("\n");
}
