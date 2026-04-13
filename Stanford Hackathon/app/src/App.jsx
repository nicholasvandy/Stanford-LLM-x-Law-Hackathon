import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { analyzeLiveProposal, analyzeOutcome } from "./dealAnalysis";
import { getScenarioIntelligence } from "./legalIntelligence";
import {
  evaluatePlaybookPackage,
  getPlaybookMetadata,
  getSupportedJurisdictions,
  scenarioUsesPlaybook,
} from "./playbookEngine";

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
    subtitle: "You are the buyer negotiating with a vendor.",
    role: "Buyer",
    counterparty: "Vendor",
    terms: ["liability_cap", "termination_rights", "data_protection"],
    termLabels: {
      liability_cap: "Limitation of Liability",
      termination_rights: "Termination Rights",
      data_protection: "Data Protection",
    },
    termDescriptions: {
      liability_cap: "Each point pushes the cap and carve-out package further toward the buyer baseline.",
      termination_rights: "Each point buys more cure protection, convenience exit rights, and cleaner wind-down mechanics.",
      data_protection: "Each point strengthens use restrictions, deletion rights, breach notice, and subprocessor controls.",
    },
    counterpartyPersona:
      "You are experienced counsel for a SaaS vendor. You care most about protecting liability exposure and keeping privacy obligations operationally realistic, while remaining somewhat more flexible on termination mechanics. Never reveal your exact valuations. Use realistic commercial-contract language.",
  },
  {
    id: "sideletter",
    title: "Series A Side Letter",
    subtitle: "You are the LP negotiating with the GP.",
    role: "LP",
    counterparty: "GP",
    terms: ["fee_discount", "coinvest_rights", "info_rights"],
    termLabels: {
      fee_discount: "Management Fee Discount",
      coinvest_rights: "Co-Investment Rights",
      info_rights: "Information Rights",
    },
    termDescriptions: {
      fee_discount: "Each point buys another 10 bps of fee relief.",
      coinvest_rights: "Each point expands direct access to future co-investment.",
      info_rights: "Each point increases reporting and transparency obligations.",
    },
    counterpartyPersona:
      "You are an experienced GP negotiating a side letter with a prospective LP. You care most about preserving management fees and limiting precedent-heavy information rights. You are more flexible on co-investment rights because they can add capital. Never reveal your exact valuations. Use realistic VC language.",
  },
  {
    id: "employment",
    title: "Employment Offer",
    subtitle: "You are the candidate negotiating with the company.",
    role: "Candidate",
    counterparty: "Hiring Manager",
    terms: ["equity_grant", "remote_flexibility", "signing_bonus"],
    termLabels: {
      equity_grant: "Equity Package",
      remote_flexibility: "Remote Work Flexibility",
      signing_bonus: "Signing Bonus",
    },
    termDescriptions: {
      equity_grant: "Each point adds another 5K shares to the package.",
      remote_flexibility: "Each point adds another remote day to the weekly arrangement.",
      signing_bonus: "Each point adds another $5K in up-front cash.",
    },
    counterpartyPersona:
      "You are a hiring manager at a growth-stage tech company. You care most about limiting cash outflow and preserving in-office culture, while remaining more flexible on equity. Never reveal your exact valuations. Use realistic hiring and compensation language.",
  },
];

function seededRandom(seed) {
  let state = seed;
  return function next() {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function generateScenario(seed, scenario) {
  const random = seededRandom(seed);
  const terms = scenario.terms;
  const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const pool = {};
    terms.forEach((termKey) => {
      pool[termKey] = randomInt(3, 12);
    });

    const totalPool = terms.reduce((total, termKey) => total + pool[termKey], 0);
    if (totalPool > TARGET_VALUE) {
      continue;
    }

    const generateValuations = () => {
      for (let tryIndex = 0; tryIndex < 500; tryIndex += 1) {
        const valuations = {};
        terms.forEach((termKey) => {
          valuations[termKey] = 1;
        });

        let remaining = TARGET_VALUE - totalPool;
        const shuffledTerms = [...terms].sort(() => random() - 0.5);

        for (let index = 0; index < shuffledTerms.length - 1; index += 1) {
          const termKey = shuffledTerms[index];
          const maxAdd = pool[termKey] > 0 ? Math.floor(remaining / pool[termKey]) : 0;
          const clampedMax = Math.min(maxAdd, MAX_VALUATION - 1);
          if (clampedMax > 0) {
            const add = randomInt(0, clampedMax);
            valuations[termKey] += add;
            remaining -= add * pool[termKey];
          }
        }

        const lastTerm = shuffledTerms[shuffledTerms.length - 1];
        if (pool[lastTerm] > 0 && remaining % pool[lastTerm] === 0) {
          valuations[lastTerm] += remaining / pool[lastTerm];
          if (valuations[lastTerm] <= MAX_VALUATION) {
            const total = terms.reduce((score, termKey) => score + valuations[termKey] * pool[termKey], 0);
            if (total === TARGET_VALUE) {
              return valuations;
            }
          }
        }
      }

      return null;
    };

    const valsUser = generateValuations();
    const valsAI = generateValuations();

    if (valsUser && valsAI && !terms.every((termKey) => valsUser[termKey] === valsAI[termKey])) {
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
  return terms.every((termKey) => {
    const mine = offer.my_share?.[termKey] ?? -1;
    const theirs = offer.their_share?.[termKey] ?? -1;
    return mine >= 0 && theirs >= 0 && mine + theirs === pool[termKey];
  });
}

function scoreSplit(vals, split, terms) {
  return terms.reduce((score, termKey) => score + (vals?.[termKey] || 0) * (split?.[termKey] || 0), 0);
}

function maxPossible(vals, pool, terms) {
  return terms.reduce((score, termKey) => score + (vals?.[termKey] || 0) * (pool?.[termKey] || 0), 0);
}

async function callAI(systemPrompt, userMessage, pool, terms) {
  try {
    const response = await fetch("/api/negotiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt,
        userMessage,
        pool,
        terms,
      }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        data: null,
        error: data?.error || "The OpenAI negotiation service returned an error.",
      };
    }

    return { data, error: null };
  } catch (error) {
    console.error("API error:", error);
    return {
      data: null,
      error: "The OpenAI negotiation service is unreachable. Start the local API server and try again.",
    };
  }
}

function buildAISystemPrompt(scenario, pool, valsAI, terms) {
  const poolString = terms.map((termKey) => `${pool[termKey]} ${scenario.termLabels[termKey]}`).join(", ");
  const valuationString = terms.map((termKey) => `${scenario.termLabels[termKey]}: ${valsAI[termKey]} points each`).join(", ");

  return `${scenario.counterpartyPersona}

GAME CONTEXT:
You are the ${scenario.counterparty} in a structured negotiation. The pool contains: ${poolString}.
Your private valuations are: ${valuationString}.
Your maximum possible score is ${maxPossible(valsAI, pool, terms)} points.

RULES:
- Each proposal must allocate all units of every term.
- You can propose, accept, or reject.
- No deal gives both sides -0.5.
- Any deal beats no deal.
When you propose, allocate every unit across the full term set.
Keep the message under 150 words and use realistic legal or business language.`;
}

function buildAITurnPrompt(history, roundNum) {
  let prompt = "";
  if (roundNum > GUARANTEED_ROUNDS) {
    prompt += `OVERTIME (round ${roundNum}) - the negotiation could end after this turn with no deal.\n\n`;
  }
  if (history.length > 0) {
    prompt += "NEGOTIATION HISTORY:\n";
    history.forEach((turn) => {
      if (turn.action === "propose" && turn.offer) {
        prompt += `- ${turn.player} proposed ${JSON.stringify(turn.offer)}\n`;
      } else {
        prompt += `- ${turn.player} ${turn.action}ed the proposal\n`;
      }
      prompt += `  message: "${turn.message}"\n`;
    });
    prompt += "\n";
  }
  prompt += `Round ${roundNum}. Respond with your next move.`;
  return prompt;
}

function normalizeAIResponse(payload, pool, terms) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const action = ["propose", "accept", "reject"].includes(payload.action) ? payload.action : "reject";
  const message = typeof payload.message === "string" && payload.message.trim()
    ? payload.message.trim().substring(0, 300)
    : "I need more time to review this structure.";

  if (action !== "propose") {
    return { action, offer: null, message };
  }

  const offer = { my_share: {}, their_share: {} };
  terms.forEach((termKey) => {
    offer.my_share[termKey] = parseInt(payload.offer?.my_share?.[termKey] ?? 0, 10);
    offer.their_share[termKey] = parseInt(payload.offer?.their_share?.[termKey] ?? 0, 10);
  });

  if (!validateOffer(offer, pool, terms)) {
    return {
      action: "reject",
      offer: null,
      message: "I need to revise the allocation before I can respond.",
    };
  }

  return { action, offer, message };
}

const FONT_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap";

const COLORS = {
  bg: "#081018",
  surface: "#121c27",
  panelAlt: "#0d141f",
  border: "#253447",
  text: "#eaf1f8",
  textMuted: "#93a5bb",
  textDim: "#61748b",
  accent: "#4ea4ff",
  accentDim: "#1d4d82",
  green: "#38d39f",
  greenDim: "#154d3b",
  red: "#fb7c7c",
  redDim: "#642424",
  yellow: "#f2c457",
  yellowDim: "#614717",
  purple: "#b18cff",
  purpleDim: "#433066",
  blue: "#7cc7ff",
  blueDim: "#17384f",
};

const PLAYBOOK_METADATA = getPlaybookMetadata();
const SUPPORTED_JURISDICTIONS = getSupportedJurisdictions();

function getToneColors(tone) {
  switch (tone) {
    case "green":
      return { color: COLORS.green, background: `${COLORS.greenDim}55`, border: COLORS.greenDim };
    case "red":
      return { color: COLORS.red, background: `${COLORS.redDim}55`, border: COLORS.redDim };
    case "yellow":
      return { color: COLORS.yellow, background: `${COLORS.yellowDim}55`, border: COLORS.yellowDim };
    case "purple":
      return { color: COLORS.purple, background: `${COLORS.purpleDim}55`, border: COLORS.purpleDim };
    case "blue":
      return { color: COLORS.blue, background: `${COLORS.blueDim}55`, border: COLORS.blueDim };
    default:
      return { color: COLORS.textMuted, background: COLORS.panelAlt, border: COLORS.border };
  }
}

function StatusBadge({ label, tone = "green" }) {
  const palette = getToneColors(tone);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "3px 8px", borderRadius: 999, border: `1px solid ${palette.border}`, background: palette.background, color: palette.color, fontFamily: "Space Mono, monospace", fontSize: 10 }}>
      {label}
    </span>
  );
}

function LinkChip({ href, label, tone = "blue" }) {
  const palette = getToneColors(tone);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{ display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 999, border: `1px solid ${palette.border}`, background: palette.background, color: palette.color, textDecoration: "none", fontFamily: "Space Mono, monospace", fontSize: 10 }}
    >
      {label}
    </a>
  );
}

function MetricCard({ label, value, helper, tone = "green" }) {
  const palette = getToneColors(tone);
  return (
    <div style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 28, fontWeight: 700, color: palette.color }}>{value}</div>
      {helper ? <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 4 }}>{helper}</div> : null}
    </div>
  );
}

function ScoreBar({ label, score, color }) {
  const pct = Math.max(0, Math.min(score, 100));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted }}>{label}</span>
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: 11, color }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: COLORS.panelAlt, borderRadius: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 6, transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}

function JurisdictionSelect({ jurisdiction, onChange, compact = false }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase" }}>
        Playbook jurisdiction
      </span>
      <select
        value={jurisdiction}
        onChange={(event) => onChange(event.target.value)}
        style={{
          borderRadius: 10,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.panelAlt,
          color: COLORS.text,
          padding: compact ? "8px 10px" : "10px 12px",
          fontFamily: "DM Sans, sans-serif",
          fontSize: 13,
          outline: "none",
        }}
      >
        {SUPPORTED_JURISDICTIONS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlaybookPanel({ evaluation, title = "Contract playbook" }) {
  if (!evaluation) {
    return null;
  }

  return (
    <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
        <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase" }}>{title}</div>
        <StatusBadge label={evaluation.actionLabel} tone={evaluation.actionTone} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
        <MetricCard label="Rule score" value={`${evaluation.averageScore}%`} helper={evaluation.summary} tone={evaluation.actionTone} />
        <MetricCard label="Jurisdiction" value={evaluation.jurisdiction} helper={PLAYBOOK_METADATA.name} tone="purple" />
      </div>
      {evaluation.clauseResults.map((clause) => (
        <div key={clause.termKey} style={{ marginBottom: 10, padding: 10, background: COLORS.panelAlt, borderRadius: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.text }}>{clause.rule.name}</span>
            <StatusBadge label={`${clause.actionLabel} / ${clause.finalScore}%`} tone={clause.actionTone} />
          </div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textMuted, lineHeight: 1.55 }}>{clause.summary}</div>
        </div>
      ))}
    </div>
  );
}

function ScenarioSelect({ onSelect, jurisdiction, onJurisdictionChange }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(78,164,255,0.14), transparent 32%), radial-gradient(circle at bottom right, rgba(177,140,255,0.12), transparent 26%), #081018", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 1080 }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 11, letterSpacing: 4, color: COLORS.accent, textTransform: "uppercase", marginBottom: 14 }}>Stanford CodeX x LLM x Law</div>
          <h1 style={{ fontFamily: "DM Sans, sans-serif", fontSize: 48, fontWeight: 700, color: COLORS.text, margin: 0, lineHeight: 1.05 }}>Contract Negotiation Arena</h1>
          <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 16, color: COLORS.textMuted, maxWidth: 640, margin: "16px auto 0", lineHeight: 1.6 }}>
            Negotiate against an AI counterparty, then pressure-test the result against market benchmarks, public sources, and negotiation-law guardrails.
          </p>
          <div style={{ maxWidth: 320, margin: "24px auto 0" }}>
            <JurisdictionSelect jurisdiction={jurisdiction} onChange={onJurisdictionChange} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          {SCENARIOS.map((scenario) => {
            const intelligence = getScenarioIntelligence(scenario.id);
            return (
              <button key={scenario.id} onClick={() => onSelect(scenario)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: "28px 24px", cursor: "pointer", textAlign: "left" }}>
                <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
                  {scenario.id === "saas" ? "Commercial paper" : scenario.id === "sideletter" ? "Investor rights" : "Compensation package"}
                </div>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 22, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>{scenario.title}</div>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted, lineHeight: 1.55, marginBottom: 16 }}>{scenario.subtitle}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                  {scenario.terms.map((termKey) => (
                    <span key={termKey} style={{ fontFamily: "Space Mono, monospace", fontSize: 10, padding: "4px 8px", background: COLORS.panelAlt, borderRadius: 999, color: COLORS.textDim }}>
                      {scenario.termLabels[termKey]}
                    </span>
                  ))}
                </div>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.55 }}>{intelligence.summary}</div>
                {scenarioUsesPlaybook(scenario.id) ? (
                  <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textDim, lineHeight: 1.5, marginTop: 12 }}>
                    Uses the imported playbook for rule scores, recommendation routing, and jurisdiction modifiers.
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TermSlider({ label, description, max, value, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 500, color: COLORS.text }}>{label}</span>
        <span style={{ fontFamily: "Space Mono, monospace", fontSize: 11, color: COLORS.textMuted }}>You {value} / Them {max - value}</span>
      </div>
      <input type="range" min={0} max={max} value={value} onChange={(event) => onChange(parseInt(event.target.value, 10))} style={{ width: "100%", accentColor: COLORS.accent }} />
      <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>{description}</div>
    </div>
  );
}

function TermInsightCard({ insight }) {
  return (
    <div style={{ marginBottom: 16, padding: 16, background: COLORS.panelAlt, borderRadius: 14, border: `1px solid ${COLORS.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, fontWeight: 600, color: COLORS.text }}>{insight.label}</div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 4 }}>{insight.benchmarkText}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <StatusBadge label={insight.marketStatusLabel} tone={insight.tone} />
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 12, color: COLORS.accent, marginTop: 8 }}>You {insight.userShare}/{insight.totalUnits}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Market lane</div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted }}>Typical user-favored share: {insight.marketRangeLabel}</div>
        </div>
        <div>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Leverage read</div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted }}>{insight.leverageLabel}</div>
        </div>
      </div>
      <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.text, lineHeight: 1.6, marginBottom: 10 }}>{insight.tacticalAdvice}</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <StatusBadge label={`You ${insight.yourPriorityLabel}`} tone={insight.yourPriorityTone} />
        <StatusBadge label={`Them ${insight.theirPriorityLabel}`} tone={insight.theirPriorityTone} />
        {insight.playbookActionLabel ? <StatusBadge label={`${insight.playbookActionLabel} / ${insight.playbookScore}%`} tone={insight.playbookActionTone} /> : null}
      </div>
      {insight.playbookSummary ? (
        <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.55, marginBottom: 10 }}>
          <strong style={{ color: COLORS.text }}>Playbook read:</strong> {insight.playbookSummary}
          {insight.playbookJurisdictionNote ? ` ${insight.playbookJurisdictionNote}` : ""}
        </div>
      ) : null}
      {insight.playbookAuthority.length > 0 ? (
        <div style={{ marginBottom: 10 }}>
          {insight.playbookAuthority.map((authority) => (
            <div key={authority.citation} style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textDim, lineHeight: 1.55 }}>
              {authority.citation}: {authority.relevance}
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {insight.sourcebook.slice(0, 3).map((source) => (
          <LinkChip key={source.key} href={source.exact_url} label={source.source_name} tone="blue" />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {insight.caseAnchors.slice(0, 2).map((legalCase) => (
          <LinkChip key={legalCase.key} href={legalCase.exact_url} label={legalCase.citation} tone="purple" />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("select");
  const [scenario, setScenario] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [proposal, setProposal] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [systemNotice, setSystemNotice] = useState("");
  const [result, setResult] = useState(null);
  const [jurisdiction, setJurisdiction] = useState(PLAYBOOK_METADATA.default_jurisdiction || PLAYBOOK_METADATA.defaultJurisdiction);
  const [isNarrow, setIsNarrow] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 980 : false));
  const chatEndRef = useRef(null);
  const deferredProposal = useDeferredValue(proposal);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = FONT_URL;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState?.history]);

  useEffect(() => {
    const onResize = () => {
      setIsNarrow(window.innerWidth < 980);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startGame = useCallback((selectedScenario) => {
    const seed = Math.floor(Math.random() * 2147483647);
    const generated = generateScenario(seed, selectedScenario);
    const initialProposal = {};
    selectedScenario.terms.forEach((termKey) => {
      initialProposal[termKey] = Math.floor(generated.pool[termKey] / 2);
    });

    setScenario(selectedScenario);
    setProposal(initialProposal);
    setMessage("");
    setResult(null);
    setSystemNotice("");
    setGameState({
      seed,
      pool: generated.pool,
      valsUser: generated.valsUser,
      valsAI: generated.valsAI,
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

  const submitAction = useCallback(
    async (action) => {
      if (loading || !gameState || gameState.dealReached || !scenario) {
        return;
      }

      setSystemNotice("");
      setLoading(true);
      const { pool, valsUser, valsAI, history, round, lastProposal, lastProposer } = gameState;
      const terms = scenario.terms;
      const nextHistory = [...history];
      let currentLastProposal = lastProposal;
      let currentLastProposer = lastProposer;

      let userOffer = null;
      if (action === "propose") {
        userOffer = { my_share: { ...proposal }, their_share: {} };
        terms.forEach((termKey) => {
          userOffer.their_share[termKey] = pool[termKey] - proposal[termKey];
        });
        if (!validateOffer(userOffer, pool, terms)) {
          setLoading(false);
          return;
        }
      }

      if (action === "accept" && (!currentLastProposal || currentLastProposer !== "AI")) {
        setLoading(false);
        return;
      }

      nextHistory.push({
        player: scenario.role,
        action,
        message:
          message ||
          (action === "propose"
            ? "Here is my proposal."
            : action === "accept"
              ? "I accept these terms."
              : "I cannot accept this structure."),
        offer: userOffer,
      });

      if (action === "propose" && userOffer) {
        currentLastProposal = userOffer;
        currentLastProposer = "User";
      }

      if (action === "accept" && currentLastProposal && currentLastProposer === "AI") {
        const userSplit = currentLastProposal.their_share;
        const aiSplit = currentLastProposal.my_share;
        const maxUser = maxPossible(valsUser, pool, terms);
        const maxAI = maxPossible(valsAI, pool, terms);
        const userScore = scoreSplit(valsUser, userSplit, terms);
        const aiScore = scoreSplit(valsAI, aiSplit, terms);

        setGameState({ ...gameState, history: nextHistory, dealReached: true, userScore, aiScore, userSplit, aiSplit, maxUser, maxAI });
        setResult({ deal: true, userScore, aiScore, maxUser, maxAI, userSplit, aiSplit });
        setMessage("");
        setLoading(false);
        setPhase("debrief");
        return;
      }

      if (round >= HARD_MAX_ROUNDS) {
        setGameState({ ...gameState, history: nextHistory, dealReached: false, userScore: NO_DEAL_PENALTY, aiScore: NO_DEAL_PENALTY });
        setResult({ deal: false });
        setMessage("");
        setLoading(false);
        setPhase("debrief");
        return;
      }

      const aiPromptHistory = nextHistory.map((turn) => ({ ...turn, player: turn.player === scenario.role ? scenario.role : scenario.counterparty }));
      const aiResult = await callAI(
        buildAISystemPrompt(scenario, pool, valsAI, terms),
        buildAITurnPrompt(aiPromptHistory, round),
        pool,
        terms,
      );
      if (aiResult.error || !aiResult.data) {
        setSystemNotice(aiResult.error || "The OpenAI negotiation service did not return a usable response.");
        setLoading(false);
        return;
      }

      let aiResponse = normalizeAIResponse(aiResult.data, pool, terms);
      if (!aiResponse) {
        aiResponse = { action: "reject", offer: null, message: "I need more time to consider this structure." };
      }
      setSystemNotice("");
      if (aiResponse.action === "accept" && (!currentLastProposal || currentLastProposer !== "User")) {
        aiResponse = { action: "reject", offer: null, message: aiResponse.message || "I cannot accept that yet." };
      }

      nextHistory.push({ player: scenario.counterparty, action: aiResponse.action, message: aiResponse.message, offer: aiResponse.offer });

      if (aiResponse.action === "propose" && aiResponse.offer) {
        currentLastProposal = aiResponse.offer;
        currentLastProposer = "AI";
      }

      if (aiResponse.action === "accept" && currentLastProposal && currentLastProposer === "User") {
        const userSplit = currentLastProposal.my_share;
        const aiSplit = currentLastProposal.their_share;
        const maxUser = maxPossible(valsUser, pool, terms);
        const maxAI = maxPossible(valsAI, pool, terms);
        const userScore = scoreSplit(valsUser, userSplit, terms);
        const aiScore = scoreSplit(valsAI, aiSplit, terms);

        setGameState({
          ...gameState,
          history: nextHistory,
          round,
          lastProposal: currentLastProposal,
          lastProposer: currentLastProposer,
          dealReached: true,
          userScore,
          aiScore,
          userSplit,
          aiSplit,
          maxUser,
          maxAI,
        });
        setResult({ deal: true, userScore, aiScore, maxUser, maxAI, userSplit, aiSplit });
        setMessage("");
        setLoading(false);
        setPhase("debrief");
        return;
      }

      const nextRound = round + 1;
      const gameEnded = nextRound > HARD_MAX_ROUNDS || (nextRound > GUARANTEED_ROUNDS && Math.random() < END_PROBABILITY);
      if (gameEnded) {
        setGameState({
          ...gameState,
          history: nextHistory,
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

      setGameState({ ...gameState, history: nextHistory, round: nextRound, lastProposal: currentLastProposal, lastProposer: currentLastProposer });
      setMessage("");
      setLoading(false);
    },
    [gameState, loading, message, proposal, scenario],
  );

  if (phase === "select") {
    return <ScenarioSelect onSelect={startGame} jurisdiction={jurisdiction} onJurisdictionChange={setJurisdiction} />;
  }

  if (!scenario || !gameState) {
    return null;
  }

  const { pool, valsUser, valsAI, history, round, lastProposal, lastProposer, dealReached } = gameState;
  const playbookEnabled = scenarioUsesPlaybook(scenario.id);
  const liveAnalysis = analyzeLiveProposal({ scenario, pool, proposal: deferredProposal, valsUser, valsAI, history, jurisdiction });
  const debriefAnalysis = result ? analyzeOutcome({ scenario, pool, valsUser, valsAI, history, result, jurisdiction }) : null;
  const intelligence = getScenarioIntelligence(scenario.id);
  const maxUser = maxPossible(valsUser, pool, scenario.terms);
  const incomingOfferEvaluation =
    playbookEnabled && lastProposal && lastProposer === "AI"
      ? evaluatePlaybookPackage({ scenario, proposal: lastProposal.their_share, pool, jurisdiction })
      : null;

  if (phase === "debrief" && result && debriefAnalysis) {
    const heroTone = result.deal ? "green" : "red";
    return (
      <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(78,164,255,0.12), transparent 32%), radial-gradient(circle at top right, rgba(177,140,255,0.12), transparent 24%), #081018", padding: 24, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 1080 }}>
          <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 24 }}>
            <div style={{ marginBottom: 10 }}>
              <StatusBadge label={result.deal ? "Deal closed" : "No deal"} tone={heroTone} />
            </div>
            <h2 style={{ fontFamily: "DM Sans, sans-serif", fontSize: 48, fontWeight: 700, color: COLORS.text, margin: 0 }}>
              {result.deal ? `${debriefAnalysis.compositeScore}%` : "No deal"}
            </h2>
            <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 15, color: COLORS.textMuted, maxWidth: 760, margin: "12px auto 0", lineHeight: 1.6 }}>
              {debriefAnalysis.executiveSummary}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
            <MetricCard label="Composite score" value={`${debriefAnalysis.compositeScore}%`} helper="Weighted blend of outcome, market fit, playbook fit, process quality, and legal credibility." tone={heroTone} />
            <MetricCard label="Private value capture" value={`${debriefAnalysis.economicScore}%`} helper={`${debriefAnalysis.privateValueCaptured} of ${debriefAnalysis.privateValueMax} hidden-value points.`} tone="green" />
            <MetricCard label="Market fit" value={`${debriefAnalysis.marketScore}%`} helper="How closely the package tracks observed market lanes." tone="blue" />
            {debriefAnalysis.playbook ? (
              <MetricCard label="Playbook score" value={`${debriefAnalysis.playbook.averageScore}%`} helper={`${debriefAnalysis.playbook.actionLabel} under ${jurisdiction}.`} tone={debriefAnalysis.playbook.actionTone} />
            ) : null}
            <MetricCard label="Risk posture" value={`${debriefAnalysis.risk.score}%`} helper="Lower friction means fewer outlier asks and stronger benchmark support." tone={debriefAnalysis.risk.score >= 70 ? "green" : "yellow"} />
          </div>

          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 24, marginBottom: 20 }}>
            <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
              Evidence-backed readout
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 18 }}>
              <div>
                <ScoreBar label="Outcome capture" score={debriefAnalysis.economicScore} color={COLORS.green} />
                <ScoreBar label="Market fit" score={debriefAnalysis.marketScore} color={COLORS.blue} />
              </div>
              <div>
                <ScoreBar label="Process quality" score={debriefAnalysis.process.score} color={COLORS.accent} />
                <ScoreBar label="Legal credibility" score={debriefAnalysis.risk.score} color={COLORS.purple} />
                {debriefAnalysis.playbook ? <ScoreBar label="Playbook fit" score={debriefAnalysis.playbook.averageScore} color={COLORS.blue} /> : null}
              </div>
            </div>
            {debriefAnalysis.termInsights.map((insight) => (
              <TermInsightCard key={insight.termKey} insight={insight} />
            ))}
          </div>

          {debriefAnalysis.playbook ? <PlaybookPanel evaluation={debriefAnalysis.playbook} title="Rulebook disposition" /> : null}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 20 }}>
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 24 }}>
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
                Negotiation process and guardrails
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: COLORS.text, lineHeight: 1.65, marginBottom: 14 }}>
                {debriefAnalysis.process.summary}
              </div>
              {debriefAnalysis.process.strengths.length > 0 ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.green, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                    What held up
                  </div>
                  {debriefAnalysis.process.strengths.map((item) => (
                    <div key={item} style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 6 }}>
                      - {item}
                    </div>
                  ))}
                </div>
              ) : null}
              {debriefAnalysis.process.warnings.length > 0 ? (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.yellow, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                    What to tighten
                  </div>
                  {debriefAnalysis.process.warnings.map((item) => (
                    <div key={item} style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 6 }}>
                      - {item}
                    </div>
                  ))}
                </div>
              ) : null}
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.purple, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                Case-backed guardrails
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
                {debriefAnalysis.risk.summary}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {debriefAnalysis.risk.citedCases.slice(0, 4).map((legalCase) => (
                  <LinkChip key={legalCase.key} href={legalCase.exact_url} label={legalCase.citation} tone="purple" />
                ))}
              </div>
            </div>

            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 24 }}>
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
                Sourcebook used
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
                {intelligence.benchmark_method}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.blue, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                  Data sources
                </div>
                {debriefAnalysis.sources.map((source) => (
                  <div key={source.key} style={{ marginBottom: 10 }}>
                    <a href={source.exact_url} target="_blank" rel="noreferrer" style={{ color: COLORS.text, textDecoration: "none", fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600 }}>
                      {source.source_name}
                    </a>
                    <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 2 }}>
                      {source.negotiation_use}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.purple, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                  Legal anchors
                </div>
                {debriefAnalysis.cases.map((legalCase) => (
                  <div key={legalCase.key} style={{ marginBottom: 10 }}>
                    <a href={legalCase.exact_url} target="_blank" rel="noreferrer" style={{ color: COLORS.text, textDecoration: "none", fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600 }}>
                      {legalCase.case_name}
                    </a>
                    <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginTop: 2 }}>
                      {legalCase.primary_negotiation_relevance}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => startGame(scenario)} style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, padding: "12px 24px", borderRadius: 999, border: `1px solid ${COLORS.accent}`, background: "transparent", color: COLORS.accent, cursor: "pointer" }}>
              Replay scenario
            </button>
            <button onClick={() => { setPhase("select"); setScenario(null); setGameState(null); setResult(null); }} style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, padding: "12px 24px", borderRadius: 999, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textMuted, cursor: "pointer" }}>
              New scenario
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: isNarrow ? "block" : "flex", color: COLORS.text }}>
      <div style={{ width: isNarrow ? "100%" : 360, borderRight: isNarrow ? "none" : `1px solid ${COLORS.border}`, borderBottom: isNarrow ? `1px solid ${COLORS.border}` : "none", padding: 20, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>{scenario.title}</div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 20, fontWeight: 600, color: COLORS.text }}>{scenario.role} vs {scenario.counterparty}</div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted, marginTop: 6, lineHeight: 1.55 }}>{intelligence.summary}</div>
          {playbookEnabled ? <div style={{ marginTop: 14 }}><JurisdictionSelect jurisdiction={jurisdiction} onChange={setJurisdiction} compact /></div> : null}
        </div>

        <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: 16 }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Round state</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted }}>Round</span>
            <StatusBadge label={round > GUARANTEED_ROUNDS ? `Overtime ${round}` : `Round ${round}`} tone={round > GUARANTEED_ROUNDS ? "yellow" : "blue"} />
          </div>
          {scenario.terms.map((termKey) => (
            <div key={termKey} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted }}>{scenario.termLabels[termKey]}</span>
              <span style={{ fontFamily: "Space Mono, monospace", fontSize: 11, color: COLORS.text }}>{pool[termKey]} units</span>
            </div>
          ))}
        </div>

        <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: 16 }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Private leverage map</div>
          {scenario.terms.map((termKey) => {
            const intensity = valsUser[termKey] / MAX_VALUATION;
            const color = valsUser[termKey] >= 7 ? COLORS.green : valsUser[termKey] <= 4 ? COLORS.textDim : COLORS.yellow;
            const label = valsUser[termKey] >= 7 ? "HIGH" : valsUser[termKey] <= 4 ? "LOW" : "MED";
            return (
              <div key={termKey} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted }}>{scenario.termLabels[termKey]}</span>
                  <span style={{ fontFamily: "Space Mono, monospace", fontSize: 11, color }}>{label}</span>
                </div>
                <div style={{ height: 4, background: COLORS.panelAlt, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.max(10, intensity * 100)}%`, background: color, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textDim, marginTop: 6, lineHeight: 1.5 }}>
            Hidden valuations still drive the game, but the evidence layer now checks whether the package also clears real-world market scrutiny.
          </div>
        </div>

        <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: 16 }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Live market calibration</div>
          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
            <MetricCard label="Market fit" value={`${liveAnalysis.marketScore}%`} helper={liveAnalysis.summary} tone="blue" />
            <MetricCard label="Risk posture" value={`${liveAnalysis.riskScore}%`} helper="Lower if your live ask pushes too many terms outside the observed market lane." tone={liveAnalysis.riskScore >= 70 ? "green" : "yellow"} />
          </div>
          {liveAnalysis.termInsights.map((insight) => (
            <div key={insight.termKey} style={{ marginBottom: 10, padding: 10, background: COLORS.panelAlt, borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.text }}>{insight.label}</span>
                <StatusBadge label={insight.marketStatusLabel} tone={insight.tone} />
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5 }}>
                Typical user-favored lane: {insight.marketRangeLabel}. You are asking for {insight.userShare}/{insight.totalUnits}.
              </div>
            </div>
          ))}
        </div>

        {liveAnalysis.playbook ? <PlaybookPanel evaluation={liveAnalysis.playbook} title="Draft recommendation" /> : null}

        <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: 16 }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Evidence stack</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {liveAnalysis.topSources.map((source) => (
              <LinkChip key={source.key} href={source.exact_url} label={source.source_name} tone="blue" />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {liveAnalysis.topCases.map((legalCase) => (
              <LinkChip key={legalCase.key} href={legalCase.exact_url} label={legalCase.citation} tone="purple" />
            ))}
          </div>
          <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textMuted, lineHeight: 1.55 }}>{intelligence.benchmark_method}</div>
        </div>

        <div style={{ background: COLORS.surface, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: 16 }}>
          <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Negotiation guidance</div>
          {intelligence.talk_tracks.map((item) => (
            <div key={item} style={{ fontFamily: "DM Sans, sans-serif", fontSize: 11, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 8 }}>
              - {item}
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, padding: 22, overflowY: "auto" }}>
          {systemNotice ? (
            <div style={{ background: `${COLORS.redDim}66`, border: `1px solid ${COLORS.redDim}`, borderRadius: 14, padding: 14, maxWidth: 860, marginBottom: 16 }}>
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.red, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>
                OpenAI service issue
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>
                {systemNotice}
              </div>
            </div>
          ) : null}
          {history.length === 0 ? (
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 24, maxWidth: 860, marginBottom: 20 }}>
              <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Opening frame</div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 28, fontWeight: 600, color: COLORS.text, marginBottom: 10 }}>Make your first anchor</div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7, marginBottom: 12 }}>
                This scenario now scores your proposal in three ways: the hidden objective still tracks how much value you win, the evidence layer checks market custom, and the imported contract playbook decides whether the package should be accepted, flagged, countered, or escalated.
              </div>
              <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.text, lineHeight: 1.7 }}>Live readout: {liveAnalysis.summary}</div>
            </div>
          ) : null}

          {history.map((turn, index) => {
            const isUser = turn.player === scenario.role;
            return (
              <div key={`${turn.player}-${index}`} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14 }}>
                <div style={{ maxWidth: 640, padding: 16, background: isUser ? `${COLORS.accentDim}55` : COLORS.surface, border: `1px solid ${isUser ? COLORS.accentDim : COLORS.border}`, borderRadius: isUser ? "18px 18px 6px 18px" : "18px 18px 18px 6px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, fontWeight: 600, color: isUser ? COLORS.accent : COLORS.yellow }}>{turn.player}</span>
                    <StatusBadge label={turn.action.toUpperCase()} tone={turn.action === "accept" ? "green" : turn.action === "reject" ? "red" : "blue"} />
                  </div>
                  {turn.offer ? (
                    <div style={{ background: COLORS.panelAlt, borderRadius: 12, padding: 10, marginBottom: 10 }}>
                      {scenario.terms.map((termKey) => (
                        <div key={termKey} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted }}>{scenario.termLabels[termKey]}</span>
                          <span style={{ fontFamily: "Space Mono, monospace", fontSize: 11, color: COLORS.text }}>
                            {isUser ? turn.offer.my_share[termKey] : turn.offer.their_share[termKey]} you / {isUser ? turn.offer.their_share[termKey] : turn.offer.my_share[termKey]} them
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: COLORS.text, lineHeight: 1.6 }}>{turn.message}</div>
                </div>
              </div>
            );
          })}

          {loading ? (
            <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
              <div style={{ padding: 14, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: "16px 16px 16px 6px" }}>
                <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.textMuted }}>{scenario.counterparty} is reviewing the proposal...</span>
              </div>
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>

        {!dealReached ? (
          <div style={{ borderTop: `1px solid ${COLORS.border}`, padding: 20, background: COLORS.surface }}>
            <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>Set your proposal</div>
            {incomingOfferEvaluation ? (
              <div style={{ marginBottom: 16, padding: 14, borderRadius: 14, border: `1px solid ${getToneColors(incomingOfferEvaluation.actionTone).border}`, background: getToneColors(incomingOfferEvaluation.actionTone).background }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <div style={{ fontFamily: "Space Mono, monospace", fontSize: 10, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase" }}>Recommendation on their last offer</div>
                  <StatusBadge label={incomingOfferEvaluation.actionLabel} tone={incomingOfferEvaluation.actionTone} />
                </div>
                <div style={{ fontFamily: "DM Sans, sans-serif", fontSize: 13, color: COLORS.text, lineHeight: 1.6, marginBottom: 10 }}>
                  {incomingOfferEvaluation.summary}
                </div>
                {incomingOfferEvaluation.counterTargets.map((clause) => (
                  <div key={clause.termKey} style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.55, marginBottom: 6 }}>
                    {clause.rule.name}: {clause.counterText}
                  </div>
                ))}
              </div>
            ) : null}
            {scenario.terms.map((termKey) => (
              <TermSlider key={termKey} label={scenario.termLabels[termKey]} description={scenario.termDescriptions[termKey]} max={pool[termKey]} value={proposal[termKey] || 0} onChange={(value) => setProposal((current) => ({ ...current, [termKey]: value }))} />
            ))}
            <input
              type="text"
              placeholder="Add negotiation support, market context, or business rationale..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loading) {
                  submitAction("propose");
                }
              }}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.panelAlt, color: COLORS.text, fontFamily: "DM Sans, sans-serif", fontSize: 14, boxSizing: "border-box", outline: "none", marginTop: 6 }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button onClick={() => submitAction("propose")} disabled={loading} style={{ flex: 1, minWidth: 160, padding: "12px 0", borderRadius: 999, border: "none", background: loading ? COLORS.textDim : COLORS.accent, color: "#fff", fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
                {loading ? "Waiting..." : "Propose"}
              </button>
              {lastProposal && lastProposer === "AI" ? (
                <button onClick={() => submitAction("accept")} disabled={loading} style={{ flex: 1, minWidth: 160, padding: "12px 0", borderRadius: 999, border: `1px solid ${COLORS.green}`, background: "transparent", color: COLORS.green, fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
                  Accept their deal
                </button>
              ) : null}
              {history.length > 0 ? (
                <button onClick={() => submitAction("reject")} disabled={loading} style={{ padding: "12px 20px", borderRadius: 999, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textMuted, fontFamily: "DM Sans, sans-serif", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}>
                  Reject
                </button>
              ) : null}
            </div>
            <div style={{ marginTop: 12, fontFamily: "DM Sans, sans-serif", fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
              Hidden game score if this exact split closed now: {Math.round((scoreSplit(valsUser, proposal, scenario.terms) / maxUser) * 100)}% of your private maximum.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
