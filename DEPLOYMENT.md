# Deployment notes

Deploy this project to a Node.js host because source ingestion, knowledge-file extraction, Retell token minting and optional SMTP delivery use the Express server.

1. Run `npm ci` and `npm run build`.
2. Set `NODE_ENV=production` and the variables required from `.env.example`.
3. Start with `npm start`.
4. Terminate TLS at the platform or reverse proxy; microphone access requires HTTPS outside localhost.

For shareable client demos, provision Retell credentials server-side. The exported JSON intentionally contains no Retell API key.
