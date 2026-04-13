const SOURCE_LIBRARY = {
  secEdgar: {
    source_name: "SEC EDGAR Search",
    exact_url: "https://www.sec.gov/edgar/search/",
    access_type: "Open",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["contract_text", "filings"],
    negotiation_use: "Executed contract exhibits and agreement benchmarking from public filings.",
    ingestion_priority: "Tier 1",
    notes: "Best raw source for real paper when you need public-company exhibits instead of commentary.",
  },
  justiaContracts: {
    source_name: "Justia Contracts",
    exact_url: "https://contracts.justia.com/",
    access_type: "Open",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["contract_text"],
    negotiation_use: "Searchable archive of public-company agreements and exhibits.",
    ingestion_priority: "Tier 1",
    notes: "Useful for fast clause comparisons across common commercial agreement types.",
  },
  onecleContracts: {
    source_name: "Onecle Contracts Archive",
    exact_url: "https://contracts.onecle.com/",
    access_type: "Open",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["contract_text"],
    negotiation_use: "Large public contract corpus for clause frequency and term benchmarking.",
    ingestion_priority: "Tier 1",
    notes: "Good breadth for market-language sampling and clause-range snapshots.",
  },
  lawInsider: {
    source_name: "Law Insider Contracts",
    exact_url: "https://www.lawinsider.com/contracts",
    access_type: "Commercial",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["contract_text", "clause_library"],
    negotiation_use: "Clause-level market language and benchmark variants.",
    ingestion_priority: "Tier 1",
    notes: "Best for richer clause libraries when license access is available.",
  },
  commonPaper: {
    source_name: "Common Paper Standards",
    exact_url: "https://commonpaper.com/standards/",
    access_type: "Open",
    scenario_fit: ["saas", "employment"],
    data_type: ["standard_forms"],
    negotiation_use: "Baseline standard paper for commercial contracts and procurement-style clauses.",
    ingestion_priority: "Tier 1",
    notes: "Useful anchor for what 'standard' means in startup and SaaS paper.",
  },
  iapp: {
    source_name: "IAPP Resources",
    exact_url: "https://iapp.org/resources/",
    access_type: "Mixed",
    scenario_fit: ["saas"],
    data_type: ["privacy_reference"],
    negotiation_use: "Reference material for DPA, privacy, and security-related negotiation terms.",
    ingestion_priority: "Tier 2",
    notes: "Helpful when data handling or deletion terms drive leverage in SaaS paper.",
  },
  cuad: {
    source_name: "CUAD",
    exact_url: "https://www.atticusprojectai.org/cuad",
    access_type: "Open",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["nlp_dataset", "clause_labels"],
    negotiation_use: "Automatic clause extraction and classification support.",
    ingestion_priority: "Tier 2",
    notes: "Useful once the platform ingests uploaded agreements and needs structured clause extraction.",
  },
  contractNli: {
    source_name: "ContractNLI",
    exact_url: "https://stanfordnlp.github.io/contract-nli/",
    access_type: "Open",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["nlp_dataset"],
    negotiation_use: "Clause inference and contradiction testing for contract analysis.",
    ingestion_priority: "Tier 2",
    notes: "Good fit for future explainability and contract-consistency checks.",
  },
  courtListener: {
    source_name: "CourtListener API",
    exact_url: "https://www.courtlistener.com/api/",
    access_type: "Open",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["case_law", "api"],
    negotiation_use: "Programmatic access to opinions and dockets for risk-backed explanations.",
    ingestion_priority: "Tier 1",
    notes: "Best first legal-research ingestion source when you need open citations.",
  },
  recap: {
    source_name: "RECAP Archive",
    exact_url: "https://www.courtlistener.com/recap/",
    access_type: "Open",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["docket_documents"],
    negotiation_use: "Federal docket filings and attachments for real dispute documents.",
    ingestion_priority: "Tier 1",
    notes: "Adds procedural texture when case outcomes alone are too abstract.",
  },
  nvca: {
    source_name: "NVCA Model Legal Documents",
    exact_url: "https://nvca.org/model-legal-documents/",
    access_type: "Open",
    scenario_fit: ["sideletter"],
    data_type: ["model_docs"],
    negotiation_use: "Baseline venture financing documents and rights architecture.",
    ingestion_priority: "Tier 1",
    notes: "The most direct open benchmark for investor-rights framing.",
  },
  seriesSeed: {
    source_name: "Series Seed",
    exact_url: "https://www.seriesseed.com/",
    access_type: "Open",
    scenario_fit: ["sideletter"],
    data_type: ["model_docs"],
    negotiation_use: "Startup financing baseline templates.",
    ingestion_priority: "Tier 1",
    notes: "Useful for simple, startup-native financing language and investor ask framing.",
  },
  ycDocs: {
    source_name: "Y Combinator Documents",
    exact_url: "https://www.ycombinator.com/documents",
    access_type: "Open",
    scenario_fit: ["sideletter"],
    data_type: ["model_docs"],
    negotiation_use: "SAFE and startup financing standard forms.",
    ingestion_priority: "Tier 1",
    notes: "Strong anchor for founder-leaning baseline paper.",
  },
  cartaData: {
    source_name: "Carta Data",
    exact_url: "https://carta.com/data/",
    access_type: "Commercial",
    scenario_fit: ["sideletter", "employment"],
    data_type: ["market_data"],
    negotiation_use: "Fundraising, cap table, and startup compensation trend data.",
    ingestion_priority: "Tier 1",
    notes: "Useful when you need current startup market context instead of form documents alone.",
  },
  cooleyGo: {
    source_name: "Cooley GO Venture Financing Report",
    exact_url: "https://www.cooleygo.com/venture-financing-report/",
    access_type: "Open",
    scenario_fit: ["sideletter"],
    data_type: ["market_report"],
    negotiation_use: "Published venture deal-term trend data.",
    ingestion_priority: "Tier 1",
    notes: "Good open signal for what institutional venture deals are actually doing.",
  },
  fenwickSurvey: {
    source_name: "Fenwick Venture Capital Survey",
    exact_url: "https://www.fenwick.com/insights/publications/venture-capital-survey",
    access_type: "Open",
    scenario_fit: ["sideletter"],
    data_type: ["market_report"],
    negotiation_use: "Published venture term survey and trend data.",
    ingestion_priority: "Tier 1",
    notes: "Best used to validate whether an ask is mainstream, stretch, or outlier.",
  },
  blsOews: {
    source_name: "BLS OEWS Tables",
    exact_url: "https://www.bls.gov/oes/tables.htm",
    access_type: "Open",
    scenario_fit: ["employment"],
    data_type: ["compensation_data"],
    negotiation_use: "Salary benchmarks by occupation and location.",
    ingestion_priority: "Tier 1",
    notes: "Grounds salary and role seniority ranges in public labor data.",
  },
  onet: {
    source_name: "O*NET Database",
    exact_url: "https://www.onetcenter.org/database.html",
    access_type: "Open",
    scenario_fit: ["employment"],
    data_type: ["job_taxonomy"],
    negotiation_use: "Normalize roles, job families, and skill groupings.",
    ingestion_priority: "Tier 1",
    notes: "Useful for mapping user-entered roles into compensation cohorts.",
  },
  uscisH1b: {
    source_name: "USCIS H-1B Employer Data Hub",
    exact_url: "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub",
    access_type: "Open",
    scenario_fit: ["employment"],
    data_type: ["wage_disclosure"],
    negotiation_use: "Employer-level salary proxy data for tech and professional roles.",
    ingestion_priority: "Tier 1",
    notes: "Helpful for employer-specific compensation reality checks.",
  },
  levelsFyi: {
    source_name: "Levels.fyi",
    exact_url: "https://www.levels.fyi/",
    access_type: "Public",
    scenario_fit: ["employment"],
    data_type: ["compensation_data"],
    negotiation_use: "Market reality checks for tech cash and equity packages.",
    ingestion_priority: "Tier 1",
    notes: "Strong practical counterweight to static government wage tables.",
  },
  casino: {
    source_name: "CaSiNo",
    exact_url: "https://github.com/kushalchawla/CaSiNo",
    access_type: "Open",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["negotiation_dialogue"],
    negotiation_use: "Concessions, anchoring, and bargaining behavior patterns.",
    ingestion_priority: "Tier 1",
    notes: "Useful for coaching negotiation process, not legal term truth.",
  },
  endToEndNegotiator: {
    source_name: "End-to-End Negotiator",
    exact_url: "https://github.com/facebookresearch/end-to-end-negotiator",
    access_type: "Open",
    scenario_fit: ["saas", "sideletter", "employment"],
    data_type: ["negotiation_dialogue"],
    negotiation_use: "Dialogue and strategic bargaining behavior patterns.",
    ingestion_priority: "Tier 1",
    notes: "Useful for process scoring and concession sequencing.",
  },
};

const CASE_LIBRARY = {
  siga: {
    case_name: "SIGA Technologies, Inc. v. PharmAthene, Inc.",
    exact_url: "https://app.midpage.ai/document/siga-technologies-inc-v-pharmathene-4967245",
    citation: "67 A.3d 330 (Del. 2013)",
    jurisdiction: "Delaware Supreme Court",
    primary_negotiation_relevance: "Express duty to negotiate in good faith under a term sheet; expectation damages if the deal would have closed but for bad faith.",
    scenario_fit: ["sideletter", "saas"],
    priority: "Tier 1",
    notes: "Best case anchor when one side uses process strategically after agreement-in-principle.",
  },
  vacold: {
    case_name: "VACOLD LLC v. Cerami",
    exact_url: "https://app.midpage.ai/document/vacold-llc-v-cerami-1196085",
    citation: "545 F.3d 114 (2d Cir. 2008)",
    jurisdiction: "Second Circuit",
    primary_negotiation_relevance: "Type II preliminary agreements can bind parties to negotiate open issues in good faith.",
    scenario_fit: ["saas", "sideletter", "employment"],
    priority: "Tier 1",
    notes: "Strong support for process-oriented coaching when parties claim open points excuse bad conduct.",
  },
  arcadian: {
    case_name: "Arcadian Phosphates, Inc. v. Arcadian Corporation",
    exact_url: "https://app.midpage.ai/document/arcadian-phosphates-inc-judas-azuelos-528451",
    citation: "884 F.2d 69 (2d Cir. 1989)",
    jurisdiction: "Second Circuit",
    primary_negotiation_relevance: "An incomplete agreement can still create mutual commitment to negotiate in good faith.",
    scenario_fit: ["saas", "sideletter", "employment"],
    priority: "Tier 1",
    notes: "Useful when explaining why process and documented assent still matter before final paper.",
  },
  brownCara: {
    case_name: "Brown v. Cara",
    exact_url: "https://app.midpage.ai/document/jeffrey-m-brown-and-jeffrey-791573",
    citation: "420 F.3d 148 (2d Cir. 2005)",
    jurisdiction: "Second Circuit",
    primary_negotiation_relevance: "Detailed Type I / Type II framework for assessing good-faith negotiation obligations.",
    scenario_fit: ["saas", "sideletter", "employment"],
    priority: "Tier 1",
    notes: "Helpful for guardrails around ambiguous deal-stage commitments.",
  },
  l7: {
    case_name: "L-7 v. Old Navy",
    exact_url: "https://app.midpage.ai/document/l-7-v-old-navy-217801",
    citation: "647 F.3d 419 (2d Cir. 2011)",
    jurisdiction: "Second Circuit",
    primary_negotiation_relevance: "Bad-faith negotiation can include delay, pretext, and nonconforming demands.",
    scenario_fit: ["saas", "employment"],
    priority: "Tier 1",
    notes: "Useful for explaining process credibility, especially when a party stalls while moving goalposts.",
  },
  murphy: {
    case_name: "Murphy v. Institute of International Education",
    exact_url: "https://app.midpage.ai/document/murphy-v-inst-of-int-6334903",
    citation: "32 F.4th 146 (2d Cir. 2022)",
    jurisdiction: "Second Circuit",
    primary_negotiation_relevance: "Modern discussion of Type II agreements and the duty to negotiate unresolved terms in good faith.",
    scenario_fit: ["sideletter", "employment"],
    priority: "Tier 2",
    notes: "Modern restatement of the same negotiation-duty line of cases.",
  },
  unitedRentals: {
    case_name: "United Rentals, Inc. v. RAM Holdings, Inc.",
    exact_url: "https://app.midpage.ai/document/united-rentals-inc-v-ram-2394299",
    citation: "937 A.2d 810 (Del. Ch. 2007)",
    jurisdiction: "Delaware Court of Chancery",
    primary_negotiation_relevance: "Business context, prior negotiations, and business custom can illuminate ambiguous commercial bargains.",
    scenario_fit: ["saas", "sideletter"],
    priority: "Tier 1",
    notes: "Excellent anchor for market-custom explanations.",
  },
  metricConstructors: {
    case_name: "Metric Constructors, Inc. v. NASA",
    exact_url: "https://app.midpage.ai/document/metric-constructors-inc-v-national-762193",
    citation: "169 F.3d 747 (Fed. Cir. 1999)",
    jurisdiction: "Federal Circuit",
    primary_negotiation_relevance: "Trade practice and custom illuminate the bargain struck and the reasonableness of later interpretations.",
    scenario_fit: ["saas", "sideletter"],
    priority: "Tier 1",
    notes: "Good support for benchmark-backed negotiation guidance.",
  },
  cobbleHill: {
    case_name: "Cobble Hill Nursing Home, Inc. v. Henry & Warren Corp.",
    exact_url: "https://app.midpage.ai/document/cobble-hill-nursing-home-inc-2583715",
    citation: "74 N.Y.2d 475 (N.Y. 1989)",
    jurisdiction: "New York Court of Appeals",
    primary_negotiation_relevance: "Commercial practice or trade usage can supply objective certainty for incomplete terms.",
    scenario_fit: ["saas", "sideletter", "employment"],
    priority: "Tier 1",
    notes: "Best case anchor when the platform explains why market custom matters.",
  },
};

export const SCENARIO_INTELLIGENCE = {
  saas: {
    summary: "Calibrate SaaS paper against real commercial contracts and trade usage before calling a position strong.",
    benchmark_method:
      "Ranges synthesize Common Paper standards, SEC exhibits, Justia and Onecle public agreements, privacy reference material, and open negotiation datasets.",
    talk_tracks: [
      "Anchor aggressive cap or deletion asks in security, data sensitivity, or implementation risk instead of framing them as pure preference.",
      "Trade cap movement against termination mechanics or data-processing flexibility rather than demanding every buyer-friendly clause at once.",
      "Use market custom and procurement norms to justify why your draft is commercially reasonable.",
    ],
    sources: ["secEdgar", "justiaContracts", "onecleContracts", "lawInsider", "commonPaper", "iapp", "courtListener", "casino", "endToEndNegotiator"],
    cases: ["unitedRentals", "metricConstructors", "cobbleHill", "l7"],
    termBenchmarks: {
      liability_cap: {
        marketRange: [0.34, 0.56],
        stretchRange: [0.2, 0.72],
        benchmark:
          "Buyer-favorable cap compression usually lands in the middle band unless security, privacy, or IP carve-outs justify more leverage.",
        negotiation_angle:
          "If you are asking for the lowest cap on the board, pair it with a narrower carve-out package or stronger uptime concessions.",
        sourceKeys: ["commonPaper", "secEdgar", "justiaContracts", "onecleContracts", "lawInsider"],
        caseKeys: ["unitedRentals", "cobbleHill"],
      },
      termination_rights: {
        marketRange: [0.4, 0.62],
        stretchRange: [0.24, 0.78],
        benchmark:
          "Balanced cure mechanics and a customer-side convenience exit are common, but one-sided termination packages usually trigger legal and commercial pushback.",
        negotiation_angle:
          "Termination structure is a classic trading chip. Use it to win leverage on the term you value most instead of spending all of your bargaining capital there.",
        sourceKeys: ["commonPaper", "secEdgar", "onecleContracts", "justiaContracts"],
        caseKeys: ["metricConstructors", "cobbleHill"],
      },
      data_protection: {
        marketRange: [0.48, 0.7],
        stretchRange: [0.34, 0.86],
        benchmark:
          "Privacy, deletion, breach notice, and subprocessor controls are easier to defend when the workflow is sensitive or regulated, but they still need to remain operationally executable.",
        negotiation_angle:
          "This is one of the strongest buyer-side clauses to push if the customer handles regulated or high-sensitivity data.",
        sourceKeys: ["commonPaper", "lawInsider", "secEdgar", "iapp"],
        caseKeys: ["unitedRentals", "metricConstructors"],
      },
    },
  },
  sideletter: {
    summary: "Series A side-letter scoring is strongest when you separate market-standard investor rights from precedent-sensitive asks.",
    benchmark_method:
      "Ranges synthesize NVCA, Series Seed, YC baseline docs, Carta, Cooley, Fenwick, and negotiation/process case law on good-faith bargaining.",
    talk_tracks: [
      "Co-invest rights are easier asks than fee discounts because they add capital without resetting the whole fee stack.",
      "Information rights and MFN-adjacent asks get more defensible when tied to check size, diligence burden, or governance need.",
      "Back fee and precedent-sensitive terms with market reports, not just aspiration.",
    ],
    sources: ["nvca", "seriesSeed", "ycDocs", "cartaData", "cooleyGo", "fenwickSurvey", "lawInsider", "courtListener", "casino", "endToEndNegotiator"],
    cases: ["siga", "vacold", "brownCara", "murphy", "unitedRentals"],
    termBenchmarks: {
      fee_discount: {
        marketRange: [0.18, 0.4],
        stretchRange: [0.08, 0.58],
        benchmark:
          "Fee reductions are one of the most precedent-sensitive asks in fund side letters, so the market lane is narrower than co-invest or reporting asks.",
        negotiation_angle:
          "If you are pressing hard on fees, trade away on a lower-cost operational term or support the ask with check size and market data.",
        sourceKeys: ["nvca", "cartaData", "cooleyGo", "fenwickSurvey"],
        caseKeys: ["siga", "vacold"],
      },
      coinvest_rights: {
        marketRange: [0.44, 0.72],
        stretchRange: [0.28, 0.86],
        benchmark:
          "Co-invest rights tend to absorb the most movement because they can add capital without immediately cutting economics.",
        negotiation_angle:
          "This is usually the best place to press for a visible win if you need to trade off fee or governance friction.",
        sourceKeys: ["nvca", "seriesSeed", "cooleyGo", "fenwickSurvey"],
        caseKeys: ["unitedRentals", "cobbleHill"],
      },
      info_rights: {
        marketRange: [0.28, 0.54],
        stretchRange: [0.16, 0.7],
        benchmark:
          "Reporting asks move with check size and diligence burden, but full control-style transparency demands quickly become precedent sensitive.",
        negotiation_angle:
          "Use your diligence burden and portfolio-monitoring rationale if you want to push this above the mid-market lane.",
        sourceKeys: ["nvca", "cartaData", "cooleyGo", "lawInsider"],
        caseKeys: ["brownCara", "murphy"],
      },
    },
  },
  employment: {
    summary: "Employment-offer scoring gets more credible when equity, cash, and flexibility are benchmarked separately against role and market reality.",
    benchmark_method:
      "Ranges synthesize BLS compensation data, O*NET role normalization, USCIS wage disclosures, Levels, Carta compensation context, and negotiation datasets.",
    talk_tracks: [
      "Push hardest on equity when the company is cash-constrained and the role is clearly senior.",
      "Use role normalization and labor-market data to justify flexibility or cash asks instead of framing them as personal preference alone.",
      "Trading bonus or remote flexibility against equity is usually easier than forcing the company to move on every compensation lever.",
    ],
    sources: ["blsOews", "onet", "uscisH1b", "levelsFyi", "cartaData", "courtListener", "casino", "endToEndNegotiator"],
    cases: ["vacold", "arcadian", "brownCara", "l7"],
    termBenchmarks: {
      equity_grant: {
        marketRange: [0.42, 0.66],
        stretchRange: [0.24, 0.82],
        benchmark:
          "Growth-stage companies usually have more room on equity than on immediate cash, especially for senior technical hires.",
        negotiation_angle:
          "If you need one aggressive ask, this is usually the cleanest lever because it avoids immediate cash burn.",
        sourceKeys: ["levelsFyi", "cartaData", "blsOews", "uscisH1b"],
        caseKeys: ["brownCara", "vacold"],
      },
      remote_flexibility: {
        marketRange: [0.28, 0.54],
        stretchRange: [0.14, 0.72],
        benchmark:
          "Remote flexibility often depends more on company operating model than title, so it usually sits in a moderate lane unless the company is already distributed.",
        negotiation_angle:
          "If the company is culture-sensitive, use equity or bonus concessions to fund flexibility instead of forcing a binary remote fight.",
        sourceKeys: ["onet", "blsOews", "uscisH1b", "levelsFyi"],
        caseKeys: ["l7", "brownCara"],
      },
      signing_bonus: {
        marketRange: [0.18, 0.44],
        stretchRange: [0.08, 0.62],
        benchmark:
          "Cash bonuses compress quickly once the rest of the package is in range, so this lane is narrower than equity.",
        negotiation_angle:
          "Use bonus as a tactical trade, not the centerpiece, unless you have relocation, forfeited compensation, or competing-offer evidence.",
        sourceKeys: ["blsOews", "uscisH1b", "levelsFyi", "cartaData"],
        caseKeys: ["vacold", "arcadian"],
      },
    },
  },
};

export function getScenarioIntelligence(scenarioId) {
  return SCENARIO_INTELLIGENCE[scenarioId];
}

export function getScenarioSources(scenarioId) {
  const intel = getScenarioIntelligence(scenarioId);
  return (intel?.sources || []).map((key) => ({ key, ...SOURCE_LIBRARY[key] }));
}

export function getScenarioCases(scenarioId) {
  const intel = getScenarioIntelligence(scenarioId);
  return (intel?.cases || []).map((key) => ({ key, ...CASE_LIBRARY[key] }));
}

export function getSourceByKey(key) {
  return SOURCE_LIBRARY[key];
}

export function getCaseByKey(key) {
  return CASE_LIBRARY[key];
}
