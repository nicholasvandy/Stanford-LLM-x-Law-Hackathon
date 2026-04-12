# Contract Negotiation Arena

AI-powered contract negotiation sparring partner. Negotiate real legal agreements against an AI counterparty with hidden preferences — then get a forensic debrief showing where you left value on the table.

Built at **Stanford CodeX LLM × Law Hackathon #6** (April 2026).

## How it works

1. **Pick a scenario** — SaaS Vendor Agreement, Series A Side Letter, or VP Engineering Offer
2. **Read the contract** — Real legal clauses update live as you adjust your position
3. **Negotiate** — Propose terms, counter-offer, or accept. The AI plays a realistic counterparty with its own hidden priorities
4. **Debrief** — After the deal, see both sides' hidden valuations, where you won, where you got bluffed, and what the optimal strategy was

## Game mechanics

Adapted from [Paradigm's Optimization Arena negotiation challenge](https://www.optimizationarena.com/negotiation):

- Each term has 11 positions on a spectrum (e.g., Liability Cap: $50K → Unlimited)
- Both sides have hidden priority weights for each term
- Rounds 1–4 are guaranteed; after that, the game can end at any time with no deal
- No deal = worst outcome for both sides (-0.5)
- The key skill: **trade what you value less for what you value more**

## Setup

```bash
npm install
npm run dev
```

The app uses Claude API via Anthropic's endpoint — works out of the box in Claude.ai artifacts, or add your API key for local development.

## Scenarios

| Scenario | You Play | Against | Key Terms |
|----------|----------|---------|-----------|
| SaaS Vendor Agreement | Buyer | Vendor Counsel | Liability Cap, Termination, SLA, Data Deletion |
| Series A Side Letter | LP | Fund GP | Mgmt Fee, Co-Invest, Info Rights, MFN |
| VP Engineering Offer | Candidate | VP People | Equity, Remote, Signing Bonus, Acceleration |

## Background

This project combines two hackathon experiences:

1. **Paradigm Optimization Arena** — We prompt-injected the negotiation challenge to achieve a perfect score, exposing adversarial vulnerabilities in AI-to-AI negotiation
2. **Stanford CodeX Hackathon** — We rebuilt the engine with real legal contract terms, turning it into an interactive training tool for contract negotiation

## Team

Built for the Harvey Challenge at LLM × Law Hackathon #6, Stanford Law School.

## License

MIT
