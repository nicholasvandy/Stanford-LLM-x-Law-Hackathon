<div align="center">

# Contract Negotiation Arena

**Negotiate real legal agreements against an AI counterparty with hidden preferences.**  
Get a forensic debrief on exactly where you left value on the table.

<br>

<svg width="760" height="140" viewBox="0 0 760 140" xmlns="http://www.w3.org/2000/svg">
  <rect width="760" height="140" rx="8" fill="#f6f8fa" stroke="#d0d7de" stroke-width="1"/>
  <line x1="253" y1="20" x2="253" y2="120" stroke="#d0d7de" stroke-width="1"/>
  <line x1="506" y1="20" x2="506" y2="120" stroke="#d0d7de" stroke-width="1"/>
  <text x="126" y="70" text-anchor="middle" fill="#0969da" font-size="38" font-weight="700" font-family="ui-monospace,SFMono-Regular,monospace">2×</text>
  <text x="126" y="94" text-anchor="middle" fill="#57606a" font-size="12" font-family="-apple-system,BlinkMacSystemFont,sans-serif">avg times a non-lawyer</text>
  <text x="126" y="110" text-anchor="middle" fill="#57606a" font-size="12" font-family="-apple-system,BlinkMacSystemFont,sans-serif">negotiates a major contract</text>
  <text x="380" y="70" text-anchor="middle" fill="#cf222e" font-size="38" font-weight="700" font-family="ui-monospace,SFMono-Regular,monospace">365×</text>
  <text x="380" y="94" text-anchor="middle" fill="#57606a" font-size="12" font-family="-apple-system,BlinkMacSystemFont,sans-serif">times the counterparty attorney</text>
  <text x="380" y="110" text-anchor="middle" fill="#57606a" font-size="12" font-family="-apple-system,BlinkMacSystemFont,sans-serif">does the same</text>
  <text x="633" y="70" text-anchor="middle" fill="#1a7f37" font-size="38" font-weight="700" font-family="ui-monospace,SFMono-Regular,monospace">0</text>
  <text x="633" y="94" text-anchor="middle" fill="#57606a" font-size="12" font-family="-apple-system,BlinkMacSystemFont,sans-serif">tools to practice before</text>
  <text x="633" y="110" text-anchor="middle" fill="#57606a" font-size="12" font-family="-apple-system,BlinkMacSystemFont,sans-serif">you sit at the table</text>
</svg>

</div>

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

> **Key rule:** your score is completely hidden while you negotiate. No feedback, no hints. Because that is how real negotiation works.

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

After the deal closes, the debrief surfaces:

| | |
|---|---|
| **Per-term breakdown** | Your valuation vs. the AI's, and how the split compared |
| **Missed trades** | Terms where you conceded despite valuing them more than the AI did |
| **Optimal strategy** | The single most valuable trade available in that scenario |
| **Final score** | Your percentage of theoretical maximum |

**Example output:**

```
Score: 73% of theoretical maximum

  Liability Cap    you: 9pts/unit   them: 3pts/unit   → you got 4/6 units   ✓
  Termination      you: 2pts/unit   them: 11pts/unit  → you got 5/8 units   ⚠ gave too much
  SLA Uptime       you: 6pts/unit   them: 5pts/unit   → you got 3/5 units   ✓

  Optimal trade missed: concede termination notice, take liability cap  →  +18 pts
```

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
