# Aqion VoiceAgentBuilder

A reusable AqionLabs studio for preparing client-branded, multilingual AqionVOX demos. It preserves the mobile voice-agent and live-dashboard experience of the original ECcallingAgent template while removing all EthikCorp, Vapi and Supabase dependencies.

## What it does

- Accepts a client website, Google Maps listing and social URLs.
- Uses server-side Firecrawl when configured, with a safe public-page fallback.
- Accepts logo, palette, screenshots, service imagery and PDF/DOCX/TXT knowledge files.
- Configures one Retell agent ID per language.
- Keeps the Retell secret in session storage and excludes it from exports.
- Runs Retell web calls, retrieves the post-call summary and turns verified fields into browser-stored leads.
- Shows call history, transcripts and lead metrics without a database.
- Generates evidence-led AqionLabs automation opportunities from supplied content.
- Defaults call-summary distribution to `jaferm@aqionlabs.com`.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Copy `.env.example` to `.env.local` only when you need Firecrawl, SMTP or server-default Retell credentials.

## Security and data model

- Durable settings, call records and leads use versioned `localStorage`.
- The Retell API key uses `sessionStorage`, is sent only to the server proxy for Retell requests, and is not included in downloaded client configuration.
- Production deployments should supply Retell credentials on the server or through an authenticated secret broker. Do not distribute a public demo with a Retell secret embedded in client code.
- Source ingestion blocks private/local IP addresses to reduce SSRF risk.
- Blocked sources are marked unavailable; recommendations require evidence in captured or uploaded content.

## Verification

```bash
npm run build
npm run dev
curl http://localhost:5173/api/health
```
