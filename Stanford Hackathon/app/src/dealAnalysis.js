import {
  getCaseByKey,
  getScenarioCases,
  getScenarioIntelligence,
  getScenarioSources,
  getSourceByKey,
} from "./legalIntelligence";
import { evaluatePlaybookPackage } from "./playbookEngine";

const HIGH_PRIORITY_THRESHOLD = 7;
const LOW_PRIORITY_THRESHOLD = 4;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function scoreSplit(vals, split, terms) {
  return terms.reduce((score, term) => score + (vals?.[term] || 0) * (split?.[term] || 0), 0);
}

function maxPossible(vals, pool, terms) {
  return terms.reduce((score, term) => score + (vals?.[term] || 0) * (pool?.[term] || 0), 0);
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatRange(range) {
  return `${formatPercent(range[0])}-${formatPercent(range[1])}`;
}

function getPriorityLabel(value) {
  if (value >= HIGH_PRIORITY_THRESHOLD) {
    return "HIGH";
  }
  if (value <= LOW_PRIORITY_THRESHOLD) {
    return "LOW";
  }
  return "MED";
}

function getPriorityTone(value) {
  if (value >= HIGH_PRIORITY_THRESHOLD) {
    return "green";
  }
  if (value <= LOW_PRIORITY_THRESHOLD) {
    return "dim";
  }
  return "yellow";
}

function evaluateMarketPosition(ratio, benchmark) {
  const [marketLow, marketHigh] = benchmark.marketRange;
  const [stretchLow, stretchHigh] = benchmark.stretchRange;
  const marketCenter = (marketLow + marketHigh) / 2;
  const marketRadius = Math.max((marketHigh - marketLow) / 2, 0.01);

  if (ratio >= marketLow && ratio <= marketHigh) {
    const normalizedDistance = Math.abs(ratio - marketCenter) / marketRadius;
    return {
      status: "market-aligned",
      label: "Inside market",
      tone: "green",
      score: Math.round(88 + (1 - Math.min(normalizedDistance, 1)) * 12),
    };
  }

  if (ratio > marketHigh && ratio <= stretchHigh) {
    const normalizedDistance = (ratio - marketHigh) / Math.max(stretchHigh - marketHigh, 0.01);
    return {
      status: "stretch-ask",
      label: "Stretch ask",
      tone: "yellow",
      score: Math.round(62 + (1 - Math.min(normalizedDistance, 1)) * 18),
    };
  }

  if (ratio >= stretchLow && ratio < marketLow) {
    const normalizedDistance = (marketLow - ratio) / Math.max(marketLow - stretchLow, 0.01);
    return {
      status: "counterparty-leaning",
      label: "Counterparty favored",
      tone: "purple",
      score: Math.round(58 + (1 - Math.min(normalizedDistance, 1)) * 18),
    };
  }

  if (ratio > stretchHigh) {
    return {
      status: "outlier-ask",
      label: "Outside market",
      tone: "red",
      score: Math.round(clamp(54 - (ratio - stretchHigh) * 140, 20, 54)),
    };
  }

  return {
    status: "soft-give",
    label: "Soft concession",
    tone: "blue",
    score: Math.round(clamp(56 - (stretchLow - ratio) * 110, 18, 56)),
  };
}

function buildTacticalAdvice(position, leverageDelta, benchmark) {
  if (position.status === "outlier-ask") {
    return `You are past the outer market lane. ${benchmark.negotiation_angle}`;
  }
  if (position.status === "stretch-ask") {
    if (leverageDelta >= 0) {
      return `This is a defensible stretch if you can support it with objective market data or workflow risk. ${benchmark.negotiation_angle}`;
    }
    return `This is a stretch on a term the other side values too. Trade into it instead of trying to win it clean.`;
  }
  if (position.status === "counterparty-leaning" || position.status === "soft-give") {
    if (leverageDelta > 0) {
      return "You are giving away a term that appears important to you. Hold this line longer or recover value elsewhere.";
    }
    return "This concession can be efficient if it buys movement on a term you value more.";
  }
  if (leverageDelta > 0) {
    return "Good calibration: you kept a priority term inside the market lane without overreaching.";
  }
  if (leverageDelta < 0) {
    return "Balanced outcome: you did not overpay to win a term the other side likely values more.";
  }
  return "Balanced outcome: this term sits in a credible range and does not consume unnecessary leverage.";
}

function buildTermInsight({ scenario, termKey, benchmark, pool, userShares, valsUser, valsAI, playbookClause }) {
  const totalUnits = pool[termKey] || 0;
  const userShare = userShares[termKey] || 0;
  const counterpartyShare = Math.max(totalUnits - userShare, 0);
  const ratio = totalUnits > 0 ? userShare / totalUnits : 0;
  const marketPosition = evaluateMarketPosition(ratio, benchmark);
  const yourValue = valsUser?.[termKey] || 0;
  const theirValue = valsAI?.[termKey] || 0;
  const leverageDelta = yourValue - theirValue;
  const sourcebook = (benchmark.sourceKeys || []).map((key) => ({ key, ...getSourceByKey(key) }));
  const caseAnchors = (benchmark.caseKeys || []).map((key) => ({ key, ...getCaseByKey(key) }));

  return {
    termKey,
    label: scenario.termLabels[termKey],
    description: scenario.termDescriptions[termKey],
    totalUnits,
    userShare,
    counterpartyShare,
    ratio,
    marketRangeLabel: formatRange(benchmark.marketRange),
    stretchRangeLabel: formatRange(benchmark.stretchRange),
    marketScore: marketPosition.score,
    marketStatus: marketPosition.status,
    marketStatusLabel: marketPosition.label,
    tone: marketPosition.tone,
    benchmarkText: benchmark.benchmark,
    negotiationAngle: benchmark.negotiation_angle,
    tacticalAdvice: buildTacticalAdvice(marketPosition, leverageDelta, benchmark),
    yourValue,
    theirValue,
    yourPriorityLabel: getPriorityLabel(yourValue),
    theirPriorityLabel: getPriorityLabel(theirValue),
    yourPriorityTone: getPriorityTone(yourValue),
    theirPriorityTone: getPriorityTone(theirValue),
    leverageDelta,
    leverageLabel:
      leverageDelta > 1
        ? "You value this more than they do"
        : leverageDelta < -1
          ? "They value this more than you do"
          : "This term is close to symmetric",
    sourcebook,
    caseAnchors,
    playbookScore: playbookClause?.finalScore ?? null,
    playbookAction: playbookClause?.recommendedAction ?? null,
    playbookActionLabel: playbookClause?.actionLabel ?? null,
    playbookActionTone: playbookClause?.actionTone ?? null,
    playbookSummary: playbookClause?.summary ?? null,
    playbookRuleName: playbookClause?.rule?.name ?? null,
    playbookMatchType: playbookClause?.matchType ?? null,
    playbookAuthority: playbookClause?.legalAuthority?.slice(0, 2) ?? [],
    playbookJurisdictionNote: playbookClause?.jurisdictionNote ?? null,
  };
}

function getUserProposalTurns(history, role) {
  return history.filter((turn) => turn.player === role && turn.action === "propose" && turn.offer);
}

function countKeywordHits(message) {
  if (!message) {
    return 0;
  }
  const keywords = ["market", "standard", "benchmark", "risk", "custom", "precedent", "budget", "scope", "security"];
  const lowered = message.toLowerCase();
  return keywords.filter((keyword) => lowered.includes(keyword)).length;
}

function analyzeProcess({ history, scenario, valsUser, result }) {
  const userProposals = getUserProposalTurns(history, scenario.role);

  if (!userProposals.length) {
    return {
      score: 35,
      summary: "No affirmative user proposal was recorded, so the platform cannot grade concession quality yet.",
      strengths: [],
      warnings: ["Make at least one explicit anchor to score negotiation quality."],
      metrics: { repeatedAnchors: 0, tradeMoves: 0, rationaleMoves: 0 },
    };
  }

  let score = 52;
  let repeatedAnchors = 0;
  let multiTermMoves = 0;
  let tradeMoves = 0;
  let harmfulConcessions = 0;
  let rationaleMoves = 0;

  userProposals.forEach((turn) => {
    const messageLength = (turn.message || "").trim().length;
    if (messageLength >= 30 || countKeywordHits(turn.message) >= 2) {
      rationaleMoves += 1;
    }
  });

  for (let index = 1; index < userProposals.length; index += 1) {
    const previous = userProposals[index - 1].offer.my_share;
    const current = userProposals[index].offer.my_share;
    const changedTerms = scenario.terms.filter((termKey) => previous[termKey] !== current[termKey]);

    if (!changedTerms.length) {
      repeatedAnchors += 1;
      continue;
    }

    if (changedTerms.length >= 2) {
      multiTermMoves += 1;
    }

    const lowValueConcessions = changedTerms.filter(
      (termKey) => current[termKey] < previous[termKey] && (valsUser?.[termKey] || 0) <= LOW_PRIORITY_THRESHOLD,
    );
    const highValueConcessions = changedTerms.filter(
      (termKey) => current[termKey] < previous[termKey] && (valsUser?.[termKey] || 0) >= HIGH_PRIORITY_THRESHOLD,
    );
    const heldOrImprovedHighValue = scenario.terms.filter((termKey) => {
      const priority = valsUser?.[termKey] || 0;
      return priority >= HIGH_PRIORITY_THRESHOLD && current[termKey] >= previous[termKey];
    });

    if (lowValueConcessions.length && heldOrImprovedHighValue.length) {
      tradeMoves += 1;
    }
    if (highValueConcessions.length && !lowValueConcessions.length) {
      harmfulConcessions += 1;
    }
  }

  score += Math.min(16, multiTermMoves * 4);
  score += Math.min(18, tradeMoves * 6);
  score += Math.min(8, rationaleMoves * 2);
  score -= repeatedAnchors * 8;
  score -= harmfulConcessions * 7;

  if (result?.deal) {
    score += 6;
  }

  score = clamp(score, 15, 95);

  const strengths = [];
  const warnings = [];

  if (tradeMoves > 0) {
    strengths.push("You traded across issues instead of trying to win every term head-on.");
  }
  if (rationaleMoves > 0) {
    strengths.push("You gave the counterparty at least some business rationale instead of sending silent anchors.");
  }
  if (!tradeMoves && userProposals.length > 1) {
    warnings.push("Your proposals moved, but they did not clearly trade lower-priority asks for higher-priority ones.");
  }
  if (repeatedAnchors > 0) {
    warnings.push("At least one round repeated the same position, which weakens bargaining credibility.");
  }
  if (harmfulConcessions > 0) {
    warnings.push("You conceded on high-priority terms without obviously reclaiming value elsewhere.");
  }

  let summary = "Process quality was mixed.";
  if (score >= 80) {
    summary = "You negotiated like a disciplined counterparty: movement was purposeful and tied to issue trading.";
  } else if (score >= 65) {
    summary = "Your process was credible, but a few moves still left leverage on the table.";
  } else if (score >= 50) {
    summary = "The process stayed workable, but your concessions and anchors were only partially strategic.";
  } else {
    summary = "The process undermined leverage. The platform saw repeated anchors, weak trade structure, or avoidable concessions.";
  }

  return {
    score,
    summary,
    strengths,
    warnings,
    metrics: { repeatedAnchors, tradeMoves, rationaleMoves },
  };
}

function analyzeRisk({ termInsights, process, result, playbook }) {
  let score = 100;
  const outlierTerms = termInsights.filter((term) => term.marketStatus === "outlier-ask").length;
  const stretchTerms = termInsights.filter((term) => term.marketStatus === "stretch-ask").length;

  score -= outlierTerms * 18;
  score -= stretchTerms * 8;
  score -= process.metrics.repeatedAnchors * 4;
  score -= playbook?.decisionCounts?.counter ? playbook.decisionCounts.counter * 4 : 0;
  score -= playbook?.decisionCounts?.escalate ? playbook.decisionCounts.escalate * 10 : 0;

  if (!result?.deal) {
    score -= 12;
  }

  score = clamp(score, 20, 98);

  let summary = "Low legal-friction package: most terms stay inside observable market custom.";
  if (outlierTerms > 0) {
    summary = "Several asks sit outside the outer market band. That can still be rational, but it needs explicit business justification and good process.";
  } else if (stretchTerms > 0) {
    summary = "Some asks are above standard market lanes, which is fine if you support them with custom, risk, or role-specific context.";
  } else if (playbook?.recommendedAction === "escalate") {
    summary = "The package may still be economically efficient, but the rulebook identifies at least one clause that should not be auto-accepted.";
  } else if (!result?.deal) {
    summary = "The package itself was not extreme, but process or timing still produced no deal friction.";
  }

  const citedCases = outlierTerms > 0 || stretchTerms > 0
    ? ["siga", "vacold", "brownCara", "unitedRentals", "cobbleHill"]
    : ["unitedRentals", "metricConstructors", "cobbleHill"];

  return {
    score,
    summary,
    citedCases: citedCases.map((key) => ({ key, ...getCaseByKey(key) })),
  };
}

function getLastUserShares(history, role, scenario, pool) {
  const userTurn = [...history].reverse().find(
    (turn) => turn.player === role && turn.action === "propose" && turn.offer,
  );

  if (userTurn) {
    return { ...userTurn.offer.my_share };
  }

  const fallback = {};
  scenario.terms.forEach((termKey) => {
    fallback[termKey] = Math.floor((pool[termKey] || 0) / 2);
  });
  return fallback;
}

function buildExecutiveSummary({ termInsights, process, risk, result, economicScore, marketScore, playbook }) {
  const strongestTerm = [...termInsights].sort((left, right) => right.marketScore - left.marketScore)[0];
  const riskiestTerm = [...termInsights].sort((left, right) => left.marketScore - right.marketScore)[0];
  const playbookSentence = playbook
    ? ` The rulebook recommendation is ${playbook.actionLabel.toLowerCase()} at ${playbook.averageScore}%.`
    : "";

  if (!result?.deal) {
    return `No deal. Your last package still showed ${economicScore}% private-value capture potential, but the market fit score sat at ${marketScore}% and the process readout suggests more deliberate issue trading was needed. The main pressure point was ${riskiestTerm.label}.${playbookSentence}`;
  }

  return `You closed the deal with ${economicScore}% capture of your private objective function. The strongest evidence-backed term was ${strongestTerm.label}; the main credibility pressure point was ${riskiestTerm.label}. ${process.summary} ${risk.summary}${playbookSentence}`;
}

function buildAnalysis({ scenario, pool, valsUser, valsAI, history, result, userShares, jurisdiction }) {
  const intelligence = getScenarioIntelligence(scenario.id);
  const playbook = evaluatePlaybookPackage({ scenario, proposal: userShares, pool, jurisdiction });
  const playbookByTerm = new Map(playbook?.clauseResults?.map((clause) => [clause.termKey, clause]) || []);
  const termInsights = scenario.terms.map((termKey) =>
    buildTermInsight({
      scenario,
      termKey,
      benchmark: intelligence.termBenchmarks[termKey],
      pool,
      userShares,
      valsUser,
      valsAI,
      playbookClause: playbookByTerm.get(termKey),
    }),
  );

  const marketScore = Math.round(average(termInsights.map((term) => term.marketScore)));
  const playbookScore = playbook?.averageScore ?? marketScore;
  const privateValueMax = maxPossible(valsUser, pool, scenario.terms);
  const privateValueCaptured = scoreSplit(valsUser, userShares, scenario.terms);
  const economicScore = privateValueMax > 0 ? Math.round((privateValueCaptured / privateValueMax) * 100) : 0;
  const process = analyzeProcess({ history, scenario, valsUser, result });
  const risk = analyzeRisk({ termInsights, process, result, playbook });
  const compositeScore = clamp(
    Math.round(
      economicScore * 0.35 +
        marketScore * 0.2 +
        playbookScore * 0.25 +
        process.score * 0.1 +
        risk.score * 0.1 -
        (result?.deal ? 0 : 10),
    ),
    0,
    100,
  );

  return {
    intelligence,
    userShares,
    marketScore,
    economicScore,
    privateValueCaptured,
    privateValueMax,
    process,
    risk,
    playbook,
    compositeScore,
    termInsights,
    sources: getScenarioSources(scenario.id),
    cases: getScenarioCases(scenario.id),
    executiveSummary: buildExecutiveSummary({
      scenario,
      termInsights,
      process,
      risk,
      result,
      economicScore,
      marketScore,
      playbook,
    }),
  };
}

export function analyzeLiveProposal({ scenario, pool, proposal, valsUser, valsAI, history, jurisdiction }) {
  const result = { deal: true };
  const analysis = buildAnalysis({
    scenario,
    pool,
    valsUser,
    valsAI,
    history,
    result,
    userShares: proposal,
    jurisdiction,
  });

  const alignedCount = analysis.termInsights.filter((term) => term.marketStatus === "market-aligned").length;
  const stretchCount = analysis.termInsights.filter(
    (term) => term.marketStatus === "stretch-ask" || term.marketStatus === "outlier-ask",
  ).length;

  let summary = `${alignedCount} of ${scenario.terms.length} terms sit inside the observed market lane.`;
  if (stretchCount > 0) {
    summary += ` ${stretchCount} term${stretchCount === 1 ? " is" : "s are"} a stretch or outlier ask.`;
  }

  return {
    marketScore: analysis.marketScore,
    riskScore: analysis.risk.score,
    playbook: analysis.playbook,
    termInsights: analysis.termInsights,
    summary,
    topSources: analysis.sources.slice(0, 4),
    topCases: analysis.cases.slice(0, 3),
  };
}

export function analyzeOutcome({ scenario, pool, valsUser, valsAI, history, result, jurisdiction }) {
  const userShares = result?.deal
    ? result.userSplit
    : getLastUserShares(history, scenario.role, scenario, pool);

  return buildAnalysis({
    scenario,
    pool,
    valsUser,
    valsAI,
    history,
    result,
    userShares,
    jurisdiction,
  });
}
