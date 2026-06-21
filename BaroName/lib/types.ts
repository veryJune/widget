export type Technique =
  | "descriptive"
  | "blend"
  | "metaphor"
  | "invented"
  | "benefit_led"
  | "persona_led"
  | "phonetic"
  | "story";

export type LanguageMode =
  | "english_first"
  | "english_korean"
  | "korean_global"
  | "open_mix";

export type CandidateLanguage =
  | "english"
  | "english_korean"
  | "korean"
  | "open_mix";

export type Transformation =
  | "more_like_this"
  | "shorter"
  | "more_premium"
  | "more_playful"
  | "more_minimal"
  | "english_only"
  | "korean_friendly"
  | "more_invented"
  | "more_descriptive";

export type RiskLevel = "low" | "medium" | "high";
export type GlobalFit = "strong" | "good" | "caution" | "weak";
export type UiLanguage = "ko" | "en";

export type Brief = {
  category: string;
  oneLineDescription: string;
  keywords: string[];
  audience: string;
  desiredTone: string[];
  avoidTone: string;
  mustInclude: string[];
  bannedWords: string[];
};

export type Settings = {
  languageMode: LanguageMode;
  creativityLevel: number;
  techniques: Technique[];
  resultCount: number;
  nameLengthPreference: "short" | "short_to_medium" | "open";
  globalMode: boolean;
};

export type Candidate = {
  idHint: string;
  name: string;
  displayName: string;
  pronunciation: string;
  aiTake?: string;
  language: CandidateLanguage;
  techniques: Technique[];
  globalFit: GlobalFit;
  positioning: string;
  rationale: string;
  soundProfile: {
    syllables: number;
    rhythm: string;
    mouthfeel: string;
  };
  scores: {
    memorability: number;
    pronunciation: number;
    distinctiveness: number;
    scalability: number;
    globalReadiness: number;
  };
  risks: Array<{
    level: RiskLevel;
    label: string;
    note: string;
  }>;
  bestFor: string[];
  avoidIf: string[];
  taglineSeeds: string[];
  variants: string[];
  recommendedTransformations: Transformation[];
};

export type StoredCandidate = Candidate & {
  id: string;
  createdAt: string;
  source: "generation" | "variation" | "import";
  isPicked: boolean;
  notes: string;
};

export type GenerationPayload = {
  projectId: string;
  mode: "generate";
  uiLanguage?: UiLanguage;
  brief: Brief;
  settings: Settings;
  pickedContext: {
    pickedNames: string[];
    preferenceSummary: string;
  };
};

export type VariationPayload = {
  projectId: string;
  mode: "variation";
  uiLanguage?: UiLanguage;
  brief: Brief;
  settings: Settings;
  sourceCandidate: Candidate;
  transformation: Transformation;
};

export type GenerationResponse = {
  briefSummary: string;
  strategy: {
    primaryDirection: string;
    languageGuidance: string;
    creativityInterpretation: string;
  };
  candidates: Candidate[];
  sessionInsight: string;
  suggestedNextActions: string[];
  cached?: boolean;
};

export type Project = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  brief: Brief;
  settings: Settings;
  candidates: StoredCandidate[];
  picks: string[];
  lastInsight: string;
  generatedPrompt?: string;
};
