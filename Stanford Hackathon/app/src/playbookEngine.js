import contractPlaybook from "./contractPlaybook.json";

const ACTION_META = {
  auto_accept: { label: "Auto-accept", tone: "green" },
  accept_with_flag: { label: "Accept with flag", tone: "blue" },
  counter: { label: "Counter", tone: "yellow" },
  escalate: { label: "Escalate", tone: "red" },
  manual_review: { label: "Manual review", tone: "purple" },
};

const RULES_BY_ID = Object.fromEntries(contractPlaybook.rules.map((rule) => [rule.rule_id, rule]));

const SCENARIO_RULE_MAP = {
  saas: {
    liability_cap: {
      ruleId: "LOL-001",
      standardRange: [0.42, 0.58],
      acceptableRange: [0.26, 0.74],
      lowUnacceptableId: "LOL-001-U2",
      highSideSummary: "You are asking for a very buyer-favorable liability profile. It may still be worth pushing, but expect resistance unless you have a security or data-risk rationale.",
      standardCounterText: "Reset the cap to the last-12-month-fees structure with carve-outs for gross negligence, indemnity, confidentiality, and IP."
    },
    termination_rights: {
      ruleId: "TERM-001",
      standardRange: [0.4, 0.62],
      acceptableRange: [0.24, 0.8],
      lowUnacceptableId: "TERM-001-U1",
      highSideSummary: "This is more flexibility than the baseline playbook expects. It is fine if the counterparty agreed, but tie it to transition mechanics so the paper remains durable.",
      standardCounterText: "Restore balanced termination rights with a cure period and a customer-side convenience exit."
    },
    data_protection: {
      ruleId: "DATA-001",
      standardRange: [0.48, 0.7],
      acceptableRange: [0.34, 0.86],
      lowUnacceptableId: "DATA-001-U2",
      highSideSummary: "This is stronger than the baseline playbook on privacy and security. That is acceptable, but make sure the security obligations are still operationally executable.",
      standardCounterText: "Return to documented-use restrictions, breach notice, deletion rights, and bounded subprocessor controls."
    },
  },
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function getJurisdictionContext(rule, jurisdiction) {
  const variant = rule.jurisdiction_variants?.[jurisdiction];
  return {
    modifier: variant?.enforceability_modifier ?? 1,
    note: variant?.rule ?? null,
  };
}

function getSeverityBucket(distance, maxDistance, bucketCount) {
  if (!bucketCount || maxDistance <= 0) {
    return 0;
  }
  const normalized = clamp(distance / maxDistance, 0, 0.999);
  return Math.min(bucketCount - 1, Math.floor(normalized * bucketCount));
}

function getActionMeta(action) {
  return ACTION_META[action] || ACTION_META.manual_review;
}

function scoreClausePosition({ scenarioId, termKey, userShare, totalUnits, jurisdiction }) {
  const mapping = SCENARIO_RULE_MAP[scenarioId]?.[termKey];
  if (!mapping) {
    return null;
  }

  const rule = RULES_BY_ID[mapping.ruleId];
  const ratio = totalUnits > 0 ? userShare / totalUnits : 0;
  const [standardLow, standardHigh] = mapping.standardRange;
  const [acceptableLow, acceptableHigh] = mapping.acceptableRange;
  const { modifier, note } = getJurisdictionContext(rule, jurisdiction);

  let matchedPosition = null;
  let matchType = "manual_review";
  let baseScore = contractPlaybook.scoring_config.unknown_position_score;
  let recommendedAction = contractPlaybook.scoring_config.unknown_action;
  let summary = "The platform could not match this clause to a playbook lane.";

  if (ratio < acceptableLow) {
    matchedPosition =
      rule.unacceptable_deviations.find((item) => item.id === mapping.lowUnacceptableId) ||
      rule.unacceptable_deviations[0] ||
      null;
    matchType = "unacceptable";
    baseScore = matchedPosition?.score ?? contractPlaybook.scoring_config.unacceptable_score;
    recommendedAction = matchedPosition?.action === "reject_and_escalate" ? "escalate" : "counter";
    summary = `This clause falls below the minimum acceptable playbook lane for ${rule.name.toLowerCase()}.`;
  } else if (ratio < standardLow) {
    const distance = standardLow - ratio;
    const bucket = getSeverityBucket(distance, standardLow - acceptableLow, rule.acceptable_deviations.length);
    matchedPosition = rule.acceptable_deviations[Math.min(rule.acceptable_deviations.length - 1, bucket)];
    matchType = "acceptable_deviation";
    baseScore = matchedPosition?.score ?? 60;
    recommendedAction = baseScore >= contractPlaybook.scoring_config.auto_accept_threshold ? "accept_with_flag" : "counter";
    summary = `The clause is workable but below your preferred standard. ${matchedPosition?.notes || rule.guidance}`;
  } else if (ratio <= standardHigh) {
    matchedPosition = rule.standard_position;
    matchType = "standard_position";
    baseScore = rule.standard_position.score;
    recommendedAction = rule.auto_negotiate ? "auto_accept" : "escalate";
    summary = `The clause sits inside the baseline playbook lane for ${rule.name.toLowerCase()}.`;
  } else if (ratio <= acceptableHigh) {
    matchedPosition = rule.acceptable_deviations[0] || rule.standard_position;
    matchType = "better_than_standard";
    baseScore = Math.min(100, (matchedPosition?.score ?? 90) + 5);
    recommendedAction = rule.auto_negotiate ? "auto_accept" : "escalate";
    summary = `The clause is better than your baseline playbook position. ${matchedPosition?.notes || rule.guidance}`;
  } else {
    matchedPosition = rule.acceptable_deviations[0] || rule.standard_position;
    matchType = "aggressive_outlier";
    baseScore = 92;
    recommendedAction = rule.auto_negotiate ? "accept_with_flag" : "escalate";
    summary = mapping.highSideSummary;
  }

  if (!rule.auto_negotiate) {
    recommendedAction = "escalate";
  }

  const finalScore = baseScore === null ? null : clamp(Math.round(baseScore * modifier), 0, 100);
  const actionMeta = getActionMeta(recommendedAction);

  return {
    termKey,
    rule,
    matchedPosition,
    matchType,
    baseScore,
    finalScore,
    recommendedAction,
    actionLabel: actionMeta.label,
    actionTone: actionMeta.tone,
    summary,
    standardRange: mapping.standardRange,
    acceptableRange: mapping.acceptableRange,
    ratio,
    jurisdiction,
    jurisdictionNote: note,
    legalAuthority: rule.legal_authority || [],
    guidance: rule.guidance,
    counterText: mapping.standardCounterText,
    totalUnits,
    userShare,
  };
}

function summarizePackage({ recommendedAction, averageScore, clauseResults }) {
  if (!clauseResults.length) {
    return "No mapped playbook clauses were found for this scenario.";
  }

  const actionMeta = getActionMeta(recommendedAction);
  const unacceptableCount = clauseResults.filter((clause) => clause.matchType === "unacceptable").length;
  const standardCount = clauseResults.filter((clause) => clause.matchType === "standard_position").length;

  if (recommendedAction === "escalate") {
    return `${actionMeta.label}: at least one clause falls outside the acceptable lane or requires manual approval.`;
  }
  if (recommendedAction === "counter") {
    return `${actionMeta.label}: the package averages ${averageScore}% and at least one clause still sits below your preferred standard.`;
  }
  if (recommendedAction === "accept_with_flag") {
    return `${actionMeta.label}: the package is broadly workable at ${averageScore}%, but it still contains edge-case positions worth reviewing.`;
  }

  if (unacceptableCount === 0 && standardCount === clauseResults.length) {
    return `Auto-accept: every mapped clause lands inside the baseline playbook lane at ${averageScore}%.`;
  }

  return `Auto-accept: the package clears the rulebook with an average playbook score of ${averageScore}%.`;
}

export function scenarioUsesPlaybook(scenarioId) {
  return Boolean(SCENARIO_RULE_MAP[scenarioId]);
}

export function getPlaybookMetadata() {
  return contractPlaybook.playbook_metadata;
}

export function getSupportedJurisdictions() {
  return contractPlaybook.playbook_metadata.supported_jurisdictions;
}

export function getPlaybookActionMeta(action) {
  return getActionMeta(action);
}

export function evaluatePlaybookPackage({ scenario, proposal, pool, jurisdiction }) {
  if (!scenarioUsesPlaybook(scenario.id)) {
    return null;
  }

  const clauseResults = scenario.terms
    .map((termKey) =>
      scoreClausePosition({
        scenarioId: scenario.id,
        termKey,
        userShare: proposal?.[termKey] || 0,
        totalUnits: pool?.[termKey] || 0,
        jurisdiction,
      }),
    )
    .filter(Boolean);

  const averageScore = Math.round(average(clauseResults.map((clause) => clause.finalScore ?? 0)));
  const triggers = [];

  if (clauseResults.some((clause) => clause.matchType === "unacceptable")) {
    triggers.push("unacceptable_match");
  }
  if (scenario.terms.some((termKey) => !SCENARIO_RULE_MAP[scenario.id]?.[termKey])) {
    triggers.push("missing_required_clause");
  }
  if (clauseResults.some((clause) => clause.recommendedAction === "manual_review")) {
    triggers.push("unknown");
  }

  let recommendedAction = "auto_accept";
  if (triggers.includes("unacceptable_match")) {
    recommendedAction = clauseResults.some((clause) => clause.recommendedAction === "escalate") ? "escalate" : "counter";
  } else if (clauseResults.some((clause) => clause.recommendedAction === "escalate")) {
    recommendedAction = "escalate";
  } else if (averageScore < 60) {
    recommendedAction = "counter";
  } else if (averageScore < contractPlaybook.scoring_config.auto_accept_threshold) {
    recommendedAction = "accept_with_flag";
  }

  const actionMeta = getActionMeta(recommendedAction);
  const decisionCounts = {
    auto_accept: clauseResults.filter((clause) => clause.recommendedAction === "auto_accept").length,
    accept_with_flag: clauseResults.filter((clause) => clause.recommendedAction === "accept_with_flag").length,
    counter: clauseResults.filter((clause) => clause.recommendedAction === "counter").length,
    escalate: clauseResults.filter((clause) => clause.recommendedAction === "escalate").length,
  };

  return {
    jurisdiction,
    averageScore,
    recommendedAction,
    actionLabel: actionMeta.label,
    actionTone: actionMeta.tone,
    summary: summarizePackage({ recommendedAction, averageScore, clauseResults }),
    triggers,
    clauseResults,
    decisionCounts,
    counterTargets: clauseResults
      .filter((clause) => clause.recommendedAction === "counter" || clause.recommendedAction === "escalate")
      .sort((left, right) => (left.finalScore ?? 0) - (right.finalScore ?? 0))
      .slice(0, 2),
  };
}
