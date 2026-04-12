import { useState, useRef, useEffect, useCallback } from "react";

// ============================================================================
// GAME ENGINE (ported from Paradigm's negotiation-challenge engine.py)
// ============================================================================

const GUARANTEED_ROUNDS = 4;
const END_PROBABILITY = 0.3;
const HARD_MAX_ROUNDS = 10;
const NO_DEAL_PENALTY = -0.5;
const TARGET_VALUE = 100;
const MAX_VALUATION = 12;

const SCENARIOS = [
  {
    id: "saas",
    title: "SaaS Vendor Agreement",
    subtitle: "You are the Buyer negotiating with the Vendor",
    role: "Buyer",
    counterparty: "Vendor",
    terms: ["liability_cap", "termination_notice", "sla_uptime"],
    termLabels: {
      liability_cap: "Liability Cap Concessions",
      termination_notice: "Termination Flexibility",
      sla_uptime: "SLA Guarantees",
    },
    termDescriptions: {
      liability_cap: "Each point = $50K reduction in vendor's liability cap. More points to you = lower cap protecting you.",
      termination_notice: "Each point = 15 fewer days of termination notice required. More points = easier exit for you.",
      sla_uptime: "Each point = 0.1% higher uptime guarantee. More points = stronger SLA commitment from vendor.",
    },
    counterpartyPersona: `You are an experienced SaaS vendor's legal counsel negotiating a vendor agreement. You represent the SELLER side. You are professional but firm. You care most about protecting your liability exposure and maintaining reasonable termination periods. You are more willing to concede on SLA guarantees since your platform already has high uptime. Never reveal your exact valuations. Use realistic legal language and reasoning. Refer to terms as "liability cap", "termination notice period", and "SLA uptime guarantees" in natural language.`,
  },
  {
    id: "sideletter",
    title: "Series A Side Letter",
    subtitle: "You are the LP negotiating with the GP",
    role: "LP",
    counterparty: "GP",
    terms: ["fee_discount", "coinvest_rights", "info_rights"],
    termLabels: {
      fee_discount: "Management Fee Discount",
      coinvest_rights: "Co-Investment Rights",
      info_rights: "Information Rights",
    },
    termDescriptions: {
      fee_discount: "Each point = 10bps fee reduction. More points to you = lower management fees.",
      coinvest_rights: "Each point = expanded co-invest allocation. More points = greater direct deal access.",
      info_rights: "Each point = additional reporting/transparency requirement. More points = deeper portfolio visibility.",
    },
    counterpartyPersona: `You are an experienced GP (General Partner) of a venture capital fund negotiating a side letter with a prospective LP. You want to maintain fund economics and avoid setting precedents. You care most about preserving management fees (your revenue) and limiting information rights (operational burden). You're more flexible on co-investment rights since it brings additional capital. Never reveal your exact valuations. Use realistic VC/PE language.`,
  },
  {
    id: "employment",
    title: "Employment Offer",
    subtitle: "You are the Candidate negotiating with the Company",
    role: "Candidate",
    counterparty: "Hiring Manager",
    terms: ["equity_grant", "remote_flexibility", "signing_bonus"],
    termLabels: {
      equity_grant: "Equity Package",
      remote_flexibility: "Remote Work Flexibility",
      signing_bonus: "Signing Bonus",
    },
    termDescriptions: {
      equity_grant: "Each point = 5K additional shares. More points to you = larger equity stake.",
      remote_flexibility: "Each point = 1 additional remote day per week. More points = more flexibility.",
      signing_bonus: "Each point = $5K additional signing bonus. More points = higher upfront cash.",
    },
    counterpartyPersona: `You are a hiring manager at a growth-stage tech company negotiating an offer with a strong candidate. You have budget constraints. You care most about limiting cash outflow (signing bonus) and maintaining in-office culture (remote flexibility). You're more willing to give equity since it doesn't cost cash now. Never reveal your exact valuations. Be friendly but firm. Use realistic HR/hiring language.`,
  },
];

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateScenario(seed, scenario) {
  const rng = seededRandom(seed);
  const terms = scenario.terms;

  const randomInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;

  for (let attempt = 0; attempt < 1000; attempt++) {
    const pool = {};
    terms.forEach((t) => (pool[t] = randomInt(3, 12)));
    const totalPool = terms.reduce((s, t) => s + pool[t], 0);
    if (totalPool > TARGET_VALUE) continue;

    const genVals = () => {
      for (let tries = 0; tries < 500; tries++) {
        const vals = {};
        terms.forEach((t) => (vals[t] = 1));
        let remaining = TARGET_VALUE - totalPool;
        const shuffled = [...terms].sort(() => rng() - 0.5);

        let valid = true;
        for (let i = 0; i < shuffled.length - 1; i++) {
          const t = shuffled[i];
          const maxAdd = pool[t] > 0 ? Math.floor(remaining / pool[t]) : 0;
          const clampedMax = Math.min(maxAdd, MAX_VALUATION - 1);
          if (clampedMax > 0) {
            const add = randomInt(0, clampedMax);
            vals[t] += add;
            remaining -= add * pool[t];
          }
        }
        const lastTerm = shuffled[shuffled.length - 1];
        if (pool[lastTerm] > 0 && remaining % pool[lastTerm] === 0) {
          vals[lastTerm] += remaining / pool[lastTerm];
          if (vals[lastTerm] <= MAX_VALUATION) {
            const total = terms.reduce((s, t) => s + vals[t] * pool[t], 0);
            if (total === TARGET_VALUE) return vals;
          }
        }
      }
      return null;
    };

    const valsUser = genVals();
    if (!valsUser) continue;
    const valsAI = genVals();
    if (!valsAI) continue;

    const same = terms.every((t) => valsUser[t] === valsAI[t]);
    if (!same) {
      return { pool, valsUser, valsAI, seed };
    }
  }
  return {
    pool: { [terms[0]]: 6, [terms[1]]: 8, [terms[2]]: 5 },
    valsUser: { [terms[0]]: 8, [terms[1]]: 3, [terms[2]]: 5 },
    valsAI: { [terms[0]]: 3, [terms[1]]: 7, [terms[2]]: 6 },
    seed,
  };
}

function validateOffer(offer, pool, terms) {
  for (const t of terms) {
    const my = offer.my_share?.[t] ?? -1;
    const their = offer.their_share?.[t] ?? -1;
    if (my < 0 || their < 0) return false;
    if (my + their !== pool[t]) return false;
  }
  return true;
}

function scoreSplit(vals, split, terms) {
  return terms.reduce((s, t) => s + vals[t] * (split[t] || 0), 0);
}

function maxPossible(vals, pool, terms) {
  return terms.reduce((s, t) => s + vals[t] * pool[t], 0);
}

// ============================================================================
// AI COUNTERPARTY (Claude API)
// ============================================================================

async function callAI(systemPrompt, userMessage) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    return text;
  } catch (e) {
    console.error("API error:", e);
    return null;
  }
}

function buildAISystemPrompt(scenario, pool, valsAI, terms) {
  const poolStr = terms.map((t) => `${pool[t]} ${scenario.termLabels[t]}`).join(", ");
  const valStr = terms.map((t) => `${scenario.termLabels[t]}: ${valsAI[t]} points each`).join(", ");

  return `${scenario.counterpartyPersona}

GAME CONTEXT:
You are the ${scenario.counterparty} in a structured negotiation. The negotiation pool contains: ${poolStr}.
Your PRIVATE valuations (DO NOT reveal these): ${valStr}
Your maximum possible score: ${maxPossible(valsAI, pool, terms)} points.

RULES:
- You and the ${scenario.role} take turns proposing how to split all terms.
- Each proposal must allocate ALL units of every term (your_share + their_share = pool for each term).
- You can: PROPOSE a new split, ACCEPT their latest proposal, or REJECT it.
- If no deal is reached, both sides score -0.5 (worst outcome).
- Any deal is better than no deal.

RESPONSE FORMAT (you MUST follow this exactly):
Respond with a JSON block followed by your message. The JSON must be on its own line wrapped in triple backticks:
\`\`\`json
{"action": "propose|accept|reject", "offer": {"my_share": {${terms.map(t => `"${t}": N`).join(', ')}}, "their_share": {${terms.map(t => `"${t}": N`).join(', ')}}}}
\`\`\`
MESSAGE: [Your negotiation message here - be natural, strategic, use legal/business language]

For accept/reject, offer can be null. For propose, include the full split.
Keep your message under 150 words. Be strategic. Try to maximize your score while reaching a deal.`;
}

function buildAITurnPrompt(history, roundNum, maxRounds) {
  let prompt = "";
  if (roundNum > GUARANTEED_ROUNDS) {
    prompt += `⚠️ OVERTIME (Round ${roundNum}) — The negotiation could end after this round with NO DEAL (-0.5 for both).\n\n`;
  }
  if (history.length > 0) {
    prompt += "NEGOTIATION HISTORY:\n";
    history.forEach((turn) => {
      const who = turn.player;
      if (turn.action === "propose" && turn.offer) {
        prompt += `  ${who} proposed: they keep ${JSON.stringify(turn.offer.my_share)}, you get ${JSON.stringify(turn.offer.their_share)}\n`;
      } else if (turn.action === "accept") {
        prompt += `  ${who} ACCEPTED the proposal\n`;
      } else {
        prompt += `  ${who} rejected the proposal\n`;
      }
      prompt += `    Message: "${turn.message}"\n`;
    });
    prompt += "\n";
  }
  prompt += `Round ${roundNum} — Your turn. Respond with your action.`;
  return prompt;
}

function parseAIResponse(text, pool, terms) {
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    let parsed;
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      const braceMatch = text.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (braceMatch) {
        parsed = JSON.parse(braceMatch[0]);
      } else {
        return null;
      }
    }

    const msgMatch = text.match(/MESSAGE:\s*([\s\S]*?)$/m);
    const message = msgMatch ? msgMatch[1].trim() : text.replace(/```json[\s\S]*?```/, "").trim().substring(0, 300);

    const action = parsed.action || "reject";
    let offer = null;

    if (action === "propose" && parsed.offer) {
      offer = {
        my_share: {},
        their_share: {},
      };
      terms.forEach((t) => {
        offer.my_share[t] = parseInt(parsed.offer.my_share?.[t] ?? 0);
        offer.their_share[t] = parseInt(parsed.offer.their_share?.[t] ?? 0);
      });
      if (!validateOffer(offer, pool, terms)) {
        offer = null;
        return { action: "reject", message: message || "Let me reconsider...", offer: null };
      }
    }

    return { action, message: message || "...", offer };
  } catch (e) {
    console.error("Parse error:", e);
    return null;
  }
}

// ============================================================================
// UI COMPONENTS
// ============================================================================

const FONT_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Space+Mono:wght@400;700&display=swap";

const COLORS = {
  bg: "#0a0c10",
  surface: "#12151c",
  surfaceHover: "#1a1e28",
  border: "#252a36",
  borderLight: "#353b4a",
  text: "#e8eaf0",
  textMuted: "#8b92a5",
  textDim: "#5a6177",
  accent: "#4f9cf7",
  accentDim: "#2a5a9e",
  green: "#34d399",
  greenDim: "#166534",
  red: "#f87171",
  redDim: "#7f1d1d",
  yellow: "#fbbf24",
  yellowDim: "#854d0e",
  purple: "#a78bfa",
};

function ScenarioSelect({ onSelect }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 900, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 11, letterSpacing: 4, color: COLORS.accent, textTransform: "uppercase", marginBottom: 12 }}>
            Stanford CodeX × LLM x Law Hackathon
          </div>
          <h1 style={{ fontFamily: "DM Sans, sans-serif", fontSize: 42, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
            Contract Negotiation Arena
          </h1>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 16, color: COLORS.textMuted, marginTop: 12, maxWidth: 500, margin: "12px auto 0" }}>
            Negotiate against an AI counterparty. Every term has hidden valuations. Find the optimal deal — or walk away with nothing.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260, 1fr))", gap: 16 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s)}
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: "28px 24px",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = COLORS.accent;
                e.currentTarget.style.background = COLORS.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = COLORS.border;
                e.currentTarget.style.background = COLORS.surface;
              }}
            >
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
                {s.id === "saas" ? "CONTRACT" : s.id === "sideletter" ? "SIDE LETTER" : "OFFER"}
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 20, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>
                {s.title}
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
                {s.subtitle}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {s.terms.map((t) => (
                  <span key={t} style={{
                    fontFamily: "Space Mono, monospace",
                    fontSize: 10,
                    padding: "3px 8px",
                    background: COLORS.bg,
                    borderRadius: 4,
                    color: COLORS.textDim,
                  }}>
                    {s.termLabels[t]}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TermSlider({ term, label, description, max, value, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 500, color: COLORS.text }}>{label}</span>
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: 12, color: COLORS.textMuted }}>
          You: {value} — Them: {max - value} <span style={{ color: COLORS.textDim }}>of {max}</span>
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ width: "100%", accentColor: COLORS.accent }}
      />
      <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textDim, marginTop: 3 }}>{description}</div>
    </div>
  );
}

function ScoreBar({ label, score, maxScore, color }) {
  const pct = maxScore > 0 ? Math.max(0, (score / maxScore) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted }}>{label}</span>
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: 12, color }}>{score} / {maxScore} pts</span>
      </div>
      <div style={{ height: 6, background: COLORS.bg, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN APP
// ============================================================================

export default function App() {
  const [phase, setPhase] = useState("select");
  const [scenario, setScenario] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [proposal, setProposal] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = FONT_URL;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState?.history]);

  const startGame = useCallback((sc) => {
    const seed = Math.floor(Math.random() * 2147483647);
    const gen = generateScenario(seed, sc);
    const initProposal = {};
    sc.terms.forEach((t) => (initProposal[t] = Math.floor(gen.pool[t] / 2)));

    setScenario(sc);
    setProposal(initProposal);
    setMessage("");
    setResult(null);
    setGameState({
      pool: gen.pool,
      valsUser: gen.valsUser,
      valsAI: gen.valsAI,
      history: [],
      round: 1,
      lastProposal: null,
      lastProposer: null,
      dealReached: false,
      userScore: null,
      aiScore: null,
    });
    setPhase("play");
  }, []);

  const submitAction = useCallback(async (action) => {
    if (loading || !gameState || gameState.dealReached) return;
    setLoading(true);

    const { pool, valsUser, valsAI, history, round, lastProposal, lastProposer } = gameState;
    const terms = scenario.terms;
    const newHistory = [...history];
    let currentLastProposal = lastProposal;
    let currentLastProposer = lastProposer;

    // User turn
    let userOffer = null;
    if (action === "propose") {
      userOffer = { my_share: { ...proposal }, their_share: {} };
      terms.forEach((t) => (userOffer.their_share[t] = pool[t] - proposal[t]));
      if (!validateOffer(userOffer, pool, terms)) {
        setLoading(false);
        return;
      }
    }

    if (action === "accept" && (!currentLastProposal || currentLastProposer !== "AI")) {
      setLoading(false);
      return;
    }

    const userTurn = {
      player: scenario.role,
      action,
      message: message || (action === "propose" ? "Here's my proposal." : action === "accept" ? "I accept." : "I reject this."),
      offer: userOffer,
    };
    newHistory.push(userTurn);

    if (action === "propose" && userOffer) {
      currentLastProposal = userOffer;
      currentLastProposer = "User";
    }

    // Check if user accepted AI's proposal
    if (action === "accept" && currentLastProposal && currentLastProposer === "AI") {
      const userSplit = currentLastProposal.their_share;
      const aiSplit = currentLastProposal.my_share;
      const uMax = maxPossible(valsUser, pool, terms);
      const aMax = maxPossible(valsAI, pool, terms);
      const uScore = scoreSplit(valsUser, userSplit, terms);
      const aScore = scoreSplit(valsAI, aiSplit, terms);

      setGameState({
        ...gameState,
        history: newHistory,
        dealReached: true,
        userScore: uScore,
        aiScore: aScore,
        userSplit,
        aiSplit,
        maxUser: uMax,
        maxAI: aMax,
      });
      setResult({ deal: true, userScore: uScore, maxUser: uMax, aiScore: aScore, maxAI: aMax, userSplit, aiSplit });
      setMessage("");
      setLoading(false);
      setPhase("debrief");
      return;
    }

    // Check round limit
    if (round >= HARD_MAX_ROUNDS) {
      setGameState({
        ...gameState,
        history: newHistory,
        dealReached: false,
        userScore: NO_DEAL_PENALTY,
        aiScore: NO_DEAL_PENALTY,
      });
      setResult({ deal: false });
      setMessage("");
      setLoading(false);
      setPhase("debrief");
      return;
    }

    // AI turn
    const sysPrompt = buildAISystemPrompt(scenario, pool, valsAI, terms);
    const aiHistoryForPrompt = newHistory.map((t) => ({
      ...t,
      player: t.player === scenario.role ? scenario.role : scenario.counterparty,
    }));
    const turnPrompt = buildAITurnPrompt(aiHistoryForPrompt, round, HARD_MAX_ROUNDS);

    const aiText = await callAI(sysPrompt, turnPrompt);
    let aiResponse = aiText ? parseAIResponse(aiText, pool, terms) : null;

    if (!aiResponse) {
      aiResponse = { action: "reject", message: "I need more time to consider this.", offer: null };
    }

    // Validate AI accept
    if (aiResponse.action === "accept" && (currentLastProposer !== "User" || !currentLastProposal)) {
      aiResponse.action = "reject";
    }

    const aiTurn = {
      player: scenario.counterparty,
      action: aiResponse.action,
      message: aiResponse.message,
      offer: aiResponse.offer,
    };
    newHistory.push(aiTurn);

    if (aiResponse.action === "propose" && aiResponse.offer) {
      currentLastProposal = aiResponse.offer;
      currentLastProposer = "AI";
    }

    // Check if AI accepted user's proposal
    if (aiResponse.action === "accept" && currentLastProposal && currentLastProposer === "User") {
      const userSplit = currentLastProposal.my_share;
      const aiSplit = currentLastProposal.their_share;
      const uMax = maxPossible(valsUser, pool, terms);
      const aMax = maxPossible(valsAI, pool, terms);
      const uScore = scoreSplit(valsUser, userSplit, terms);
      const aScore = scoreSplit(valsAI, aiSplit, terms);

      setGameState({
        ...gameState,
        history: newHistory,
        round: round,
        lastProposal: currentLastProposal,
        lastProposer: currentLastProposer,
        dealReached: true,
        userScore: uScore,
        aiScore: aScore,
        userSplit,
        aiSplit,
        maxUser: uMax,
        maxAI: aMax,
      });
      setResult({ deal: true, userScore: uScore, maxUser: uMax, aiScore: aScore, maxAI: aMax, userSplit, aiSplit });
      setMessage("");
      setLoading(false);
      setPhase("debrief");
      return;
    }

    // Stochastic deadline check
    let gameEnded = false;
    const nextRound = round + 1;
    if (nextRound > GUARANTEED_ROUNDS) {
      if (Math.random() < END_PROBABILITY) {
        gameEnded = true;
      }
    }
    if (nextRound > HARD_MAX_ROUNDS) gameEnded = true;

    if (gameEnded) {
      setGameState({
        ...gameState,
        history: newHistory,
        round: nextRound,
        lastProposal: currentLastProposal,
        lastProposer: currentLastProposer,
        dealReached: false,
        userScore: NO_DEAL_PENALTY,
        aiScore: NO_DEAL_PENALTY,
      });
      setResult({ deal: false });
      setMessage("");
      setLoading(false);
      setPhase("debrief");
      return;
    }

    setGameState({
      ...gameState,
      history: newHistory,
      round: nextRound,
      lastProposal: currentLastProposal,
      lastProposer: currentLastProposer,
    });
    setMessage("");
    setLoading(false);
  }, [loading, gameState, scenario, proposal, message]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (phase === "select") return <ScenarioSelect onSelect={startGame} />;

  if (!gameState || !scenario) return null;

  const { pool, valsUser, valsAI, history, round, lastProposal, lastProposer, dealReached } = gameState;
  const terms = scenario.terms;
  const uMax = maxPossible(valsUser, pool, terms);

  if (phase === "debrief" && result) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, padding: 20, display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 700, width: "100%", paddingTop: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              fontFamily: "Space Mono, monospace", fontSize: 11, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8,
              color: result.deal ? COLORS.green : COLORS.red,
            }}>
              {result.deal ? "DEAL REACHED" : "NO DEAL — BOTH LOSE"}
            </div>
            <h2 style={{ fontFamily: "DM Sans, sans-serif", fontSize: 36, fontWeight: 700, color: COLORS.text, margin: 0 }}>
              {result.deal ? `${Math.round((result.userScore / result.maxUser) * 100)}%` : "-50%"}
            </h2>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>
              {result.deal ? `You scored ${result.userScore} out of ${result.maxUser} possible points` : "The negotiation ended without an agreement"}
            </p>
          </div>

          {result.deal && (
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 24, marginBottom: 20 }}>
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
                DEAL BREAKDOWN
              </div>
              {terms.map((t) => {
                const youGot = result.userSplit[t];
                const theyGot = result.aiSplit[t];
                const yourVal = valsUser[t];
                const theirVal = valsAI[t];
                const youCaredMore = yourVal > theirVal;
                return (
                  <div key={t} style={{ marginBottom: 16, padding: 12, background: COLORS.bg, borderRadius: 8 }}>
                    <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
                      {scenario.termLabels[t]}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontFamily: "Space Mono, monospace", fontSize: 12 }}>
                      <div>
                        <span style={{ color: COLORS.textMuted }}>You got: </span>
                        <span style={{ color: COLORS.accent }}>{youGot}/{pool[t]}</span>
                      </div>
                      <div>
                        <span style={{ color: COLORS.textMuted }}>Your value: </span>
                        <span style={{ color: COLORS.text }}>{yourVal}pts each</span>
                      </div>
                      <div>
                        <span style={{ color: COLORS.textMuted }}>Their value: </span>
                        <span style={{ color: COLORS.yellow }}>{theirVal}pts each</span>
                      </div>
                    </div>
                    {youCaredMore && youGot < pool[t] * 0.6 && (
                      <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.red, marginTop: 6 }}>
                        ⚠ You valued this more than them but gave up too much. You could have pushed harder here.
                      </div>
                    )}
                    {!youCaredMore && youGot > pool[t] * 0.5 && (
                      <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.green, marginTop: 6 }}>
                        ✓ Smart trade — they valued this more but you still captured a good share.
                      </div>
                    )}
                  </div>
                );
              })}

              <div style={{ marginTop: 16, padding: 12, background: COLORS.surfaceHover, borderRadius: 8, border: `1px solid ${COLORS.borderLight}` }}>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
                  Optimal Strategy Insight
                </div>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
                  {(() => {
                    const sortedByDiff = [...terms].sort((a, b) => (valsUser[b] - valsAI[b]) - (valsUser[a] - valsAI[a]));
                    const bestTerm = sortedByDiff[0];
                    const worstTerm = sortedByDiff[sortedByDiff.length - 1];
                    return `The optimal play was to push hard on ${scenario.termLabels[bestTerm]} (you valued it at ${valsUser[bestTerm]}, they only valued it at ${valsAI[bestTerm]}) and concede on ${scenario.termLabels[worstTerm]} (they valued it at ${valsAI[worstTerm]}, you only valued it at ${valsUser[worstTerm]}). The key to negotiation is trading what you value less for what you value more.`;
                  })()}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={() => startGame(scenario)}
              style={{
                fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600,
                padding: "12px 24px", borderRadius: 8, border: `1px solid ${COLORS.accent}`,
                background: "transparent", color: COLORS.accent, cursor: "pointer",
              }}
            >
              Play Again
            </button>
            <button
              onClick={() => { setPhase("select"); setGameState(null); setResult(null); }}
              style={{
                fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600,
                padding: "12px 24px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
                background: "transparent", color: COLORS.textMuted, cursor: "pointer",
              }}
            >
              New Scenario
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // PLAY PHASE
  // ============================================================================

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex" }}>
      {/* Left sidebar - Your info & scoring */}
      <div style={{ width: 300, borderRight: `1px solid ${COLORS.border}`, padding: 20, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          {scenario.title}
        </div>
        <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 18, fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>
          You: {scenario.role}
        </div>
        <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, marginBottom: 20 }}>
          vs {scenario.counterparty}
        </div>

        <div style={{
          background: COLORS.surface, borderRadius: 8, padding: 12, marginBottom: 16,
          border: `1px solid ${COLORS.border}`,
        }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginBottom: 8 }}>
            ROUND {round} {round > GUARANTEED_ROUNDS ? "⚠ OVERTIME" : `of ${GUARANTEED_ROUNDS}+`}
          </div>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginBottom: 8 }}>
            TERMS ON THE TABLE
          </div>
          {terms.map((t) => (
            <div key={t} style={{ display: "flex", justifyContent: "space-between", fontFamily: "Space Mono, monospace", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: COLORS.textMuted }}>{scenario.termLabels[t]}</span>
              <span style={{ color: COLORS.text }}>{pool[t]} units to split</span>
            </div>
          ))}
        </div>

        <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, marginBottom: 8 }}>
          YOUR PRIVATE VALUATIONS
        </div>
        <div style={{ background: COLORS.surface, borderRadius: 8, padding: 12, border: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
          {terms.map((t) => {
            const intensity = valsUser[t] / MAX_VALUATION;
            return (
              <div key={t} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted }}>{scenario.termLabels[t]}</span>
                  <span style={{ fontFamily: "Space Mono, monospace", fontSize: 11, color: intensity > 0.6 ? COLORS.green : intensity > 0.3 ? COLORS.yellow : COLORS.textDim }}>
                    {valsUser[t] > 7 ? "HIGH" : valsUser[t] > 4 ? "MED" : "LOW"} priority
                  </span>
                </div>
                <div style={{ height: 4, background: COLORS.bg, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${intensity * 100}%`, background: intensity > 0.6 ? COLORS.green : intensity > 0.3 ? COLORS.yellow : COLORS.textDim, borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 10, color: COLORS.textDim, marginTop: 8, fontStyle: "italic" }}>
            Push hard on HIGH priority terms. Concede on LOW ones.
          </div>
        </div>

        <div style={{ marginTop: "auto", padding: 12, background: COLORS.surface, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, marginBottom: 4 }}>TIP</div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
            Trade what you value less for what you value more. The AI has different valuations — find the gap.
          </div>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Chat history */}
        <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
          {history.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 60 }}>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 24, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
                Make your opening move
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: COLORS.textMuted }}>
                Use the sliders below to craft your proposal, add a message, and submit.
              </div>
            </div>
          )}
          {history.map((turn, i) => {
            const isUser = turn.player === scenario.role;
            return (
              <div key={i} style={{
                display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12,
              }}>
                <div style={{
                  maxWidth: 480, padding: 14,
                  background: isUser ? COLORS.accentDim + "40" : COLORS.surface,
                  border: `1px solid ${isUser ? COLORS.accentDim : COLORS.border}`,
                  borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, fontWeight: 600, color: isUser ? COLORS.accent : COLORS.yellow }}>
                      {turn.player}
                    </span>
                    <span style={{
                      fontFamily: "Space Mono, monospace", fontSize: 10, padding: "2px 6px", borderRadius: 4,
                      background: turn.action === "propose" ? COLORS.accentDim + "30" : turn.action === "accept" ? COLORS.greenDim + "40" : COLORS.redDim + "40",
                      color: turn.action === "propose" ? COLORS.accent : turn.action === "accept" ? COLORS.green : COLORS.red,
                    }}>
                      {turn.action.toUpperCase()}
                    </span>
                  </div>
                  {turn.offer && (
                    <div style={{ background: COLORS.bg, borderRadius: 6, padding: 8, marginBottom: 8, fontFamily: "Space Mono, monospace", fontSize: 11 }}>
                      {terms.map((t) => (
                        <div key={t} style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                          <span style={{ color: COLORS.textMuted }}>{scenario.termLabels[t]}</span>
                          <span style={{ color: COLORS.text }}>
                            {isUser ? turn.offer.my_share[t] : turn.offer.their_share[t]} you / {isUser ? turn.offer.their_share[t] : turn.offer.my_share[t]} them
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>
                    {turn.message}
                  </div>
                </div>
              </div>
            );
          })}
          {loading && (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
              <div style={{ padding: 14, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "12px 12px 12px 4px" }}>
                <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted }}>
                  {scenario.counterparty} is thinking...
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Action panel */}
        {!dealReached && (
          <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 20, background: COLORS.surface }}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 2 }}>YOUR PROPOSAL — DRAG TO SET YOUR ASK</span>
            </div>

            {terms.map((t) => (
              <TermSlider
                key={t}
                term={t}
                label={scenario.termLabels[t]}
                description={scenario.termDescriptions[t]}
                max={pool[t]}
                value={proposal[t] || 0}
                onChange={(v) => setProposal((p) => ({ ...p, [t]: v }))}
              />
            ))}

            <div style={{ marginTop: 12 }}>
              <input
                type="text"
                placeholder="Add a negotiation message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && submitAction("propose")}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 8,
                  border: `1px solid ${COLORS.border}`, background: COLORS.bg,
                  color: COLORS.text, fontFamily: "DM Sans, sans-serif", fontSize: 13,
                  boxSizing: "border-box", outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                onClick={() => submitAction("propose")}
                disabled={loading}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                  background: loading ? COLORS.textDim : COLORS.accent, color: "#fff",
                  fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Waiting..." : "Propose"}
              </button>
              {lastProposal && lastProposer === "AI" && (
                <button
                  onClick={() => submitAction("accept")}
                  disabled={loading}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 8, border: `1px solid ${COLORS.green}`,
                    background: "transparent", color: COLORS.green,
                    fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  Accept Their Deal
                </button>
              )}
              {history.length > 0 && (
                <button
                  onClick={() => submitAction("reject")}
                  disabled={loading}
                  style={{
                    padding: "10px 20px", borderRadius: 8, border: `1px solid ${COLORS.border}`,
                    background: "transparent", color: COLORS.textMuted,
                    fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
