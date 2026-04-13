<div align="center">

# Contract Negotiation Arena

**AI-powered contract negotiation sparring partner.**  
Negotiate real legal agreements against an AI counterparty with hidden preferences, then get a forensic debrief on where you left value on the table.

<br>

[![Built at Stanford](https://img.shields.io/badge/Stanford_CodeX-LLM_%C3%97_Law_Hackathon_%236-8C1515?style=flat-square)](https://law.stanford.edu/codex-the-stanford-center-for-legal-informatics/)
[![Harvey Challenge](https://img.shields.io/badge/Harvey-Challenge_Entry-000000?style=flat-square)](https://www.harvey.ai/)
[![Powered by Claude](https://img.shields.io/badge/Powered_by-Anthropic_Claude-D97706?style=flat-square)](https://www.anthropic.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)

</div>

<br>

## Overview

<table>
<tr>
<td align="center" width="33%"><h2>2×</h2><sub>avg times a non-lawyer<br>negotiates a major contract</sub></td>
<td align="center" width="33%"><h2>365×</h2><sub>times the counterparty<br>attorney does the same</sub></td>
<td align="center" width="33%"><h2>0</h2><sub>tools to practice before<br>you sit at the table</sub></td>
</tr>
</table>

<br>

Most people negotiate contracts a handful of times in their lives. The person across the table does it every day. That asymmetry is expensive, and until now there has been no way to practice before you sit down.

Contract Negotiation Arena puts you in a live negotiation against an AI counterparty with hidden priorities. Your score stays completely hidden until you commit to a deal. Only then does the debrief reveal what each side actually valued, where you conceded too much, and what the optimal strategy was.

<br>

## Table of Contents

- [How It Works](#how-it-works)
- [Scenarios](#scenarios)
- [Game Mechanics](#game-mechanics)
- [Scoring and Debrief](#scoring-and-debrief)
- [Setup](#setup)
- [Background](#background)
- [License](#license)

<br>

## How It Works

```
01  Pick a scenario
          │
          ▼
02  Read the contract — clauses update live as you adjust your position
          │
          ▼
03  Negotiate — propose terms, counter-offer, accept, or walk away
    An AI counterparty plays the other side with hidden priority weights
    Your score is completely hidden throughout
          │
          ▼
04  Debrief — both sides' valuations are revealed
    See where you won, where you got bluffed, and what the optimal trade was
```

> **The key constraint:** your score is completely hidden while you negotiate. No feedback, no hints. Because that is how real negotiation works.

<br>

## Scenarios

| Scenario | You Play | Against | Key Terms |
|---|---|---|---|
| SaaS Vendor Agreement | Buyer | Vendor Counsel | Liability Cap · Termination Notice · SLA Uptime · Data Deletion |
| Series A Side Letter | LP | Fund GP | Mgmt Fee · Co-Invest Rights · Info Rights · MFN |
| VP Engineering Offer | Candidate | VP People | Equity Grant · Remote Flexibility · Signing Bonus · Acceleration |

<br>

## Game Mechanics

Adapted from [Paradigm's Optimization Arena](https://www.optimizationarena.com/negotiation) negotiation challenge.

- Each term has 11 positions on a spectrum — e.g. Liability Cap slides from `$50K → Unlimited`
- Both sides receive private priority weights for each term, unknown to the other side
- Rounds 1–4 are guaranteed; after round 4, any round can end the game with no deal
- No deal scores `-0.5` for both sides, always worse than any agreed outcome

The core skill: trade what you value less for what the other side values more.

<br>

## Scoring and Debrief

```
score = points captured / theoretical maximum
```

<br>

<table>
<tr>
<td align="center" width="25%"><strong>73%</strong><br><sub>of theoretical max captured<br>(example round)</sub></td>
<td align="center" width="25%"><strong>What you valued most</strong><br><sub>Liability Cap<br>9 pts / unit</sub></td>
<td align="center" width="25%"><strong>What they valued most</strong><br><sub>Termination Notice<br>11 pts / unit</sub></td>
<td align="center" width="25%"><strong>The trade you missed</strong><br><sub>Give notice, take cap<br>+18 pts left on the table</sub></td>
</tr>
</table>

<br>

After the deal closes, the debrief surfaces:

- **Per-term breakdown** — your valuation vs. the AI's, and how the split compared
- **Missed trades** — terms where you conceded despite valuing them more than the AI did
- **Optimal strategy** — the single most valuable trade available in that scenario
- **Final score** — your percentage of theoretical maximum

> Valuation ranges benchmarked against NVCA model legal documents, Bonterms, and SEC EDGAR public filings.

<br>

## Setup

```bash
npm install
npm run dev
```

Works out of the box as a Claude.ai artifact. For local development:

```bash
export ANTHROPIC_API_KEY=your_key_here
```

**Stack:** React · Vite · Claude API (`claude-sonnet-4`)

<br>

## Background

Built at Stanford CodeX LLM × Law Hackathon #6 (April 2026) for the Harvey Challenge.

The negotiation engine is adapted from Paradigm's Optimization Arena, where we prompt-injected the AI-to-AI challenge to achieve a perfect score by planting a fabricated deal history in our messages. We rebuilt the same engine with real legal contract terms, turning that adversarial insight into a human training tool.

<br>

## License

MIT
