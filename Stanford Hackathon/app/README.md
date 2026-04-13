# Contract Negotiation Arena

This app now runs the negotiation counterparty through a local OpenAI-backed API instead of a browser-side Anthropic call. The React client stays in Vite, and `server.mjs` holds the OpenAI key server-side and exposes `/api/negotiate`.

## Local setup

1. Install dependencies with `npm install`
2. Create `C:\Users\ayush\Desktop\Hackathons\Startup Legal Tech\Stanford-LLM-x-Law-Hackathon\Stanford Hackathon\app\.env.local` from `.env.example`
3. Add your key as `OPENAI_API_KEY=...`
4. Optional model override: `OPENAI_MODEL=gpt-5-mini`
5. Start the full stack with `npm run dev`

That starts:

- the Vite client on port `5173`
- the local negotiation API on port `5050`

## Previewing a production build

1. Run `npm run build`
2. Run `npm run preview`

The preview server serves the built `dist` bundle and keeps `/api/negotiate` available on the same origin.

## Notes

- If `OPENAI_API_KEY` is missing, the UI now shows a setup error banner instead of silently fabricating a vendor rejection.
- The default model is `gpt-5-mini`; set `OPENAI_MODEL` if you want to swap to another OpenAI Responses-compatible model.
