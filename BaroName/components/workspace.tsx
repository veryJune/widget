"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type {
  Brief,
  Candidate,
  GenerationPayload,
  GenerationResponse,
  LanguageMode,
  Project,
  Settings,
  StoredCandidate,
  Technique,
  Transformation,
  UiLanguage,
  VariationPayload
} from "@/lib/types";

const STORAGE_KEY = "baroname.projects.v1";
const UI_LANGUAGE_KEY = "baroname.ui-language.v1";
const COOLDOWN_MS = 8000;

const copy = {
  en: {
    privateWorkspace: "Private naming workspace",
    ready: "Ready",
    generating: "Generating",
    lock: "Lock",
    brief: "Brief",
    studio: "Studio",
    picks: "Picks",
    brandBrief: "Brand Brief",
    briefHelp: "English-first names, global readability.",
    generate: "Generate",
    namingStudio: "Naming Studio",
    studioTitle: "Generate, pick, and refine",
    studioSubtitle: "12 candidates per round · English-first · Global fit review",
    startBrief: "Start with a short brief.",
    emptyHelp: "Create global-first candidates with pronunciation, risks, and quick refinement actions.",
    sampleBrief: "Use sample brief",
    insight: "Insight",
    preference: "Preference signal",
    resetView: "Reset",
    promptOnly: "Prompt only",
    promptBuilder: "Prompt Builder",
    copyPrompt: "Copy prompt",
    generatedPrompt: "Generated prompt",
    autoEngines: "Auto engines",
    applySuggested: "Apply suggested",
    customTone: "Add tone and press Enter",
    customAvoid: "Add avoid tone and press Enter",
    creativityNotes: [
      "Plainspoken: clear before clever.",
      "Polished: familiar, but not flat.",
      "Brandable: fresh with a steady pulse.",
      "Bold: memorable with a little voltage.",
      "Wildcard: strange enough to earn a second look."
    ],
    viewDetails: "View details",
    moreLike: "More like this",
    shorter: "Shorter",
    premium: "Premium",
    copyName: "Copy",
    risk: "Risk",
    sound: "Sound",
    bestFor: "Best for",
    taglineSeeds: "Tagline seeds",
    variants: "Variants",
    memory: "Memory",
    distinct: "Distinct",
    expand: "Expand",
    global: "Global",
    workingLines: ["Reading the brief", "Shaping sound", "Filtering weak names"]
  },
  ko: {
    privateWorkspace: "Private naming workspace",
    ready: "Ready",
    generating: "Generating",
    lock: "Lock",
    brief: "Brief",
    studio: "Studio",
    picks: "Picks",
    brandBrief: "Brand Brief",
    briefHelp: "English-first names, explained for Korean judgment.",
    generate: "Generate",
    namingStudio: "Naming Studio",
    studioTitle: "Generate, pick, and refine",
    studioSubtitle: "12 candidates per round · Korean analysis · Global fit review",
    startBrief: "Start with a short brief.",
    emptyHelp: "영문 중심 후보를 만들고, 판단에 필요한 설명은 자연스럽게 한국어로 보여줍니다.",
    sampleBrief: "Use sample brief",
    insight: "Insight",
    preference: "Preference signal",
    resetView: "Reset",
    promptOnly: "Prompt only",
    promptBuilder: "Prompt Builder",
    copyPrompt: "Copy prompt",
    generatedPrompt: "Generated prompt",
    autoEngines: "Auto engines",
    applySuggested: "Apply suggested",
    customTone: "톤 입력 후 Enter",
    customAvoid: "피할 톤 입력 후 Enter",
    creativityNotes: [
      "담백한 직관형: 멋보다 이해가 먼저.",
      "정돈된 균형형: 익숙하지만 심심하진 않게.",
      "브랜드형: 설명 가능하면서도 새롭게.",
      "과감한 조어형: 기억에 걸리는 전압을 살짝.",
      "와일드카드형: 낯설지만 다시 보게 만드는 이름."
    ],
    viewDetails: "자세히",
    moreLike: "비슷하게",
    shorter: "더 짧게",
    premium: "프리미엄",
    copyName: "복사",
    risk: "리스크",
    sound: "어감",
    bestFor: "어울리는 용도",
    taglineSeeds: "태그라인 씨앗",
    variants: "변형",
    memory: "Memory",
    distinct: "Distinct",
    expand: "Expand",
    global: "Global",
    workingLines: ["브리프 읽는 중", "어감 다듬는 중", "약한 후보 걸러내는 중"]
  }
};

const categories = [
  "SaaS / Web App",
  "Mobile App",
  "Company",
  "Product",
  "Creator Channel",
  "Newsletter",
  "Community",
  "Store",
  "Other"
];

const tones: Array<{ value: string; ko: string }> = [
  { value: "Modern", ko: "모던" },
  { value: "Trustworthy", ko: "신뢰감" },
  { value: "Warm", ko: "따뜻함" },
  { value: "Premium", ko: "프리미엄" },
  { value: "Playful", ko: "위트" },
  { value: "Technical", ko: "기술적" },
  { value: "Minimal", ko: "미니멀" },
  { value: "Bold", ko: "대담함" },
  { value: "Calm", ko: "차분함" },
  { value: "Editorial", ko: "에디토리얼" },
  { value: "Human", ko: "사람다움" },
  { value: "Sharp", ko: "선명함" },
  { value: "Global", ko: "글로벌" },
  { value: "Elegant", ko: "우아함" },
  { value: "Friendly", ko: "친근함" },
  { value: "Inventive", ko: "창의적" }
];

const avoidTonePresets: Array<{ value: string; ko: string }> = [
  { value: "Too generic", ko: "너무 흔함" },
  { value: "Hard to pronounce", ko: "발음 어려움" },
  { value: "Childish", ko: "유치함" },
  { value: "Corporate jargon", ko: "회사 말투" },
  { value: "Too cute", ko: "과한 귀여움" },
  { value: "Too abstract", ko: "너무 추상적" },
  { value: "Overly trendy", ko: "유행어 느낌" },
  { value: "Luxury cliché", ko: "럭셔리 클리셰" },
  { value: "AI buzzword-heavy", ko: "AI buzzword 과함" },
  { value: "Korean-only feel", ko: "국내용 느낌" }
];

const engines: Array<{ value: Technique; label: string; description: string; cues: string[] }> = [
  {
    value: "blend",
    label: "Blend",
    description: "두 단어를 자연스럽게 합쳐 의미와 고유성을 함께 만드는 방식입니다.",
    cues: ["platform", "tool", "app", "ai", "fast", "creator", "maker"]
  },
  {
    value: "invented",
    label: "Invented",
    description: "완전히 새로운 조어를 만들어 검색성, 상표성, 글로벌 확장성을 노립니다.",
    cues: ["global", "new", "future", "saas", "startup", "brand"]
  },
  {
    value: "metaphor",
    label: "Metaphor",
    description: "제품의 감정, 세계관, 결과 상태를 상징적인 단어로 표현합니다.",
    cues: ["calm", "focus", "nature", "story", "community", "creative"]
  },
  {
    value: "phonetic",
    label: "Phonetic",
    description: "발음, 리듬, 음절감을 중심으로 기억하기 쉬운 이름을 만듭니다.",
    cues: ["simple", "short", "sound", "viral", "consumer", "channel"]
  },
  {
    value: "descriptive",
    label: "Descriptive",
    description: "무엇을 하는지 바로 이해되는 직관적인 이름을 만듭니다.",
    cues: ["local", "service", "utility", "clear", "simple"]
  },
  {
    value: "benefit_led",
    label: "Benefit-led",
    description: "사용자가 얻게 되는 이익이나 변화에 초점을 맞춥니다.",
    cues: ["save", "grow", "better", "boost", "easy", "help"]
  },
  {
    value: "persona_led",
    label: "Persona-led",
    description: "타깃 사용자의 정체성, 소속감, 커뮤니티 감각을 이름에 담습니다.",
    cues: ["founder", "creator", "mom", "team", "student", "community"]
  },
  {
    value: "story",
    label: "Story",
    description: "창업 배경, 철학, 장소, 시작 계기를 브랜드 스토리로 전환합니다.",
    cues: ["mission", "origin", "local", "founder", "why"]
  }
];

const defaultBrief: Brief = {
  category: "SaaS / Web App",
  oneLineDescription: "",
  keywords: [],
  audience: "",
  desiredTone: ["Modern", "Trustworthy", "Minimal"],
  avoidTone: "",
  mustInclude: [],
  bannedWords: []
};

const defaultSettings: Settings = {
  languageMode: "english_first",
  creativityLevel: 3,
  techniques: ["blend", "invented", "metaphor", "phonetic"],
  resultCount: 12,
  nameLengthPreference: "short_to_medium",
  globalMode: true
};

function createId(prefix = "id") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createProject(): Project {
  const now = new Date().toISOString();
  return {
    id: createId("project"),
    title: "Untitled naming sprint",
    createdAt: now,
    updatedAt: now,
    brief: defaultBrief,
    settings: defaultSettings,
    candidates: [],
    picks: [],
    lastInsight: "",
    generatedPrompt: ""
  };
}

function toStoredCandidate(candidate: Candidate, source: StoredCandidate["source"]): StoredCandidate {
  return {
    ...candidate,
    id: createId("candidate"),
    createdAt: new Date().toISOString(),
    source,
    isPicked: false,
    notes: ""
  };
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreAverage(candidate: StoredCandidate) {
  const scores = candidate.scores;
  return Math.round(
    (scores.memorability +
      scores.pronunciation +
      scores.distinctiveness +
      scores.scalability +
      scores.globalReadiness) /
      5
  );
}

function buildPreferenceSummary(picks: StoredCandidate[]) {
  if (picks.length === 0) {
    return "No picks yet. Prefer English-first, globally pronounceable names.";
  }

  const shortCount = picks.filter((pick) => pick.displayName.length <= 8).length;
  const inventedCount = picks.filter((pick) => pick.techniques.includes("invented")).length;
  const softEndingCount = picks.filter((pick) => /[aeiouay]$/i.test(pick.displayName)).length;
  const signals = [];

  if (shortCount >= Math.ceil(picks.length / 2)) signals.push("short names");
  if (inventedCount >= Math.ceil(picks.length / 2)) signals.push("invented names");
  if (softEndingCount >= Math.ceil(picks.length / 2)) signals.push("soft vowel endings");

  return signals.length
    ? `User seems to prefer ${signals.join(", ")}. Keep names English-first and globally readable.`
    : "User has mixed preferences. Keep the next round varied but globally readable.";
}

function buildPreferenceSummaryForLanguage(picks: StoredCandidate[], uiLanguage: UiLanguage) {
  if (uiLanguage === "en") {
    return buildPreferenceSummary(picks);
  }

  if (picks.length === 0) {
    return "아직 선택한 후보가 없습니다. 영문 우선, 글로벌 발음이 쉬운 이름을 기준으로 생성합니다.";
  }

  const shortCount = picks.filter((pick) => pick.displayName.length <= 8).length;
  const inventedCount = picks.filter((pick) => pick.techniques.includes("invented")).length;
  const softEndingCount = picks.filter((pick) => /[aeiouay]$/i.test(pick.displayName)).length;
  const signals = [];

  if (shortCount >= Math.ceil(picks.length / 2)) signals.push("짧은 이름");
  if (inventedCount >= Math.ceil(picks.length / 2)) signals.push("조어형 이름");
  if (softEndingCount >= Math.ceil(picks.length / 2)) signals.push("부드러운 모음 끝소리");

  return signals.length
    ? `선택 패턴상 ${signals.join(", ")}을 선호하는 흐름입니다.`
    : "선호가 아직 다양합니다. 다음 라운드는 글로벌 가독성을 유지하면서 폭넓게 제안합니다.";
}

function buildUserPrompt({
  brief,
  settings,
  techniques,
  uiLanguage,
  preferenceSummary
}: {
  brief: Brief;
  settings: Settings;
  techniques: Technique[];
  uiLanguage: UiLanguage;
  preferenceSummary: string;
}) {
  const analysisLanguage =
    uiLanguage === "ko"
      ? "이름 후보 자체는 글로벌 관점에서 자연스러운 언어로 만들고, 설명/평가/리스크/어감 분석은 자연스러운 한국어로 작성해 주세요. 필요한 영문 용어는 그대로 섞어도 됩니다."
      : "Write names and analysis in concise English, keeping a global-first brand perspective.";

  return [
    "Act as a senior global brand naming strategist.",
    "",
    "Create 12 high-quality name candidates using professional naming methods.",
    "",
    `Category: ${brief.category}`,
    `One-line brief: ${brief.oneLineDescription || "(not provided)"}`,
    `Keywords: ${brief.keywords.join(", ") || "(none)"}`,
    `Target audience: ${brief.audience || "(not specified)"}`,
    `Desired tone: ${brief.desiredTone.join(", ") || "(not specified)"}`,
    `Avoid tone: ${brief.avoidTone || "(none)"}`,
    `Must include: ${brief.mustInclude.join(", ") || "(none)"}`,
    `Banned words: ${brief.bannedWords.join(", ") || "(none)"}`,
    `Language direction: ${settings.languageMode}`,
    `Creativity level: ${settings.creativityLevel}/5`,
    `Naming methods to use: ${techniques.join(", ")}`,
    `Preference signal from picked names: ${preferenceSummary}`,
    "",
    analysisLanguage,
    "",
    "For each candidate, include:",
    "- Name",
    "- Pronunciation help",
    "- One-line AI take",
    "- Why it fits",
    "- Risk to check manually",
    "- Best use case",
    "",
    "Do not claim trademark, domain, or social handle availability."
  ].join("\n");
}

export function Workspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"brief" | "studio" | "picks">("studio");
  const [sortMode, setSortMode] = useState("recommended");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>("ko");
  const [focusedCandidateId, setFocusedCandidateId] = useState("");
  const [autoEngines, setAutoEngines] = useState(true);
  const [promptOnly, setPromptOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(UI_LANGUAGE_KEY);
    if (savedLanguage === "ko" || savedLanguage === "en") {
      setUiLanguage(savedLanguage);
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { projects: Project[]; currentId: string };
        if (parsed.projects?.length) {
          setProjects(parsed.projects);
          setCurrentId(parsed.currentId || parsed.projects[0].id);
          return;
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    const project = createProject();
    setProjects([project]);
    setCurrentId(project.id);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(UI_LANGUAGE_KEY, uiLanguage);
  }, [uiLanguage]);

  useEffect(() => {
    if (projects.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, currentId }));
    }
  }, [projects, currentId]);

  const project = projects.find((item) => item.id === currentId) || projects[0] || createProject();
  const pickedCandidates = useMemo(
    () => project.candidates.filter((candidate) => project.picks.includes(candidate.id)),
    [project]
  );
  const preferenceSummary = useMemo(
    () => buildPreferenceSummaryForLanguage(pickedCandidates, uiLanguage),
    [pickedCandidates, uiLanguage]
  );
  const recommendedEngines = useMemo(() => {
    const text = `${project.brief.oneLineDescription} ${project.brief.keywords.join(" ")} ${project.brief.audience}`.toLowerCase();
    return engines
      .map((engine) => ({
        value: engine.value,
        score: engine.cues.reduce((count, cue) => count + (text.includes(cue) ? 1 : 0), 0)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.value);
  }, [project.brief.audience, project.brief.keywords, project.brief.oneLineDescription]);
  const focusedCandidate = project.candidates.find((candidate) => candidate.id === focusedCandidateId);
  const t = copy[uiLanguage];
  const cooldownLeft = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));

  function updateProject(updater: (project: Project) => Project) {
    setProjects((items) =>
      items.map((item) =>
        item.id === currentId ? { ...updater(item), updatedAt: new Date().toISOString() } : item
      )
    );
  }

  function updateBrief(partial: Partial<Brief>) {
    updateProject((item) => ({ ...item, brief: { ...item.brief, ...partial } }));
  }

  function updateSettings(partial: Partial<Settings>) {
    updateProject((item) => ({ ...item, settings: { ...item.settings, ...partial } }));
  }

  function toggleTone(tone: string) {
    const desiredTone = project.brief.desiredTone.includes(tone)
      ? project.brief.desiredTone.filter((item) => item !== tone)
      : [...project.brief.desiredTone, tone];
    updateBrief({ desiredTone });
  }

  function addTone(value: string) {
    const tone = value.trim();
    if (!tone || project.brief.desiredTone.includes(tone)) return;
    updateBrief({ desiredTone: [...project.brief.desiredTone, tone] });
  }

  function toggleEngine(engine: Technique) {
    const techniques = project.settings.techniques.includes(engine)
      ? project.settings.techniques.filter((item) => item !== engine)
      : [...project.settings.techniques, engine];
    updateSettings({ techniques: techniques.length ? techniques : [engine] });
  }

  function handleKeyword(event: KeyboardEvent<HTMLInputElement>, field: "keywords" | "mustInclude" | "bannedWords") {
    if (event.key !== "Enter" && event.key !== ",") {
      return;
    }
    event.preventDefault();
    const input = event.currentTarget;
    const value = input.value.trim();
    if (!value) return;

    const current = project.brief[field];
    if (!current.includes(value) && current.length < 8) {
      updateBrief({ [field]: [...current, value] } as Partial<Brief>);
    }
    input.value = "";
  }

  function removeChip(field: "keywords" | "mustInclude" | "bannedWords", value: string) {
    updateBrief({ [field]: project.brief[field].filter((item) => item !== value) } as Partial<Brief>);
  }

  function toggleAvoidTone(tone: string) {
    const current = parseList(project.brief.avoidTone);
    const next = current.includes(tone) ? current.filter((item) => item !== tone) : [...current, tone];
    updateBrief({ avoidTone: next.join(", ") });
  }

  function applyRecommendedEngines() {
    if (recommendedEngines.length === 0) return;
    updateSettings({ techniques: recommendedEngines });
  }

  function resetView() {
    const clear = window.confirm(
      uiLanguage === "ko"
        ? "현재 화면의 후보를 지울까요?\n\n확인: 후보를 삭제하고 빈 화면으로 돌아갑니다.\n취소: 그대로 둡니다."
        : "Clear current candidates?\n\nOK clears the current view. Cancel keeps everything."
    );
    if (!clear) return;
    updateProject((item) => ({ ...item, candidates: [], picks: [], lastInsight: "" }));
    setMessage("");
    setFocusedCandidateId("");
  }

  function generatePromptOnly() {
    const techniques = autoEngines && recommendedEngines.length > 0 ? recommendedEngines : project.settings.techniques;
    const prompt = buildUserPrompt({
      brief: project.brief,
      settings: project.settings,
      techniques,
      uiLanguage,
      preferenceSummary
    });
    updateProject((item) => ({ ...item, generatedPrompt: prompt }));
    setMessage(uiLanguage === "ko" ? "프롬프트를 생성했습니다." : "Generated a reusable prompt.");
    return prompt;
  }

  async function generateNames() {
    if (!project.brief.oneLineDescription.trim()) {
      setMessage("Add a one-line brief first.");
      setActiveTab("brief");
      return;
    }

    if (loading || cooldownLeft > 0) {
      return;
    }

    const generatedPrompt = generatePromptOnly();
    if (promptOnly) {
      setActiveTab("studio");
      return;
    }

    setLoading(true);
    setMessage("Shaping naming directions...");
    setActiveTab("studio");

    const techniques = autoEngines && recommendedEngines.length > 0 ? recommendedEngines : project.settings.techniques;
    const payload: GenerationPayload = {
      projectId: project.id,
      mode: "generate",
      uiLanguage,
      brief: project.brief,
      settings: { ...project.settings, techniques },
      pickedContext: {
        pickedNames: pickedCandidates.map((candidate) => candidate.displayName),
        preferenceSummary
      }
    };

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await readJsonResponse(response)) as GenerationResponse & { message?: string };

      if (!response.ok) {
        throw new Error(data.message || "Name generation failed.");
      }

      const stored = data.candidates.map((candidate) => toStoredCandidate(candidate, "generation"));
      if (stored.length === 0) {
        throw new Error("No usable names were returned. Try Generate again with a slightly clearer brief.");
      }
      updateProject((item) => ({
        ...item,
        candidates: stored,
        picks: [],
        lastInsight: data.sessionInsight,
        generatedPrompt
      }));
      setMessage(data.cached ? `Loaded ${stored.length} cached candidates.` : `Generated ${stored.length} candidates.`);
      setActiveTab("studio");
      setCooldownUntil(Date.now() + COOLDOWN_MS);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Name generation failed.");
      setActiveTab("studio");
    } finally {
      setLoading(false);
    }
  }

  async function createVariation(candidate: StoredCandidate, transformation: Transformation) {
    if (loading) return;
    setLoading(true);
    setMessage(
      uiLanguage === "ko"
        ? `${candidate.displayName} 변주를 만드는 중...`
        : `Creating ${transformation.replaceAll("_", " ")} variations for ${candidate.displayName}...`
    );

    const payload: VariationPayload = {
      projectId: project.id,
      mode: "variation",
      uiLanguage,
      brief: project.brief,
      settings: project.settings,
      sourceCandidate: candidate,
      transformation
    };

    try {
      const response = await fetch("/api/variation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await readJsonResponse(response)) as { candidates?: Candidate[]; variationInsight?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.message || "Variation failed.");
      }

      const stored = (data.candidates || []).map((item) => toStoredCandidate(item, "variation"));
      updateProject((item) => ({
        ...item,
        candidates: [...stored, ...item.candidates].slice(0, 80),
        lastInsight: data.variationInsight || item.lastInsight
      }));
      setMessage(uiLanguage === "ko" ? `${stored.length}개 변주를 추가했습니다.` : `Added ${stored.length} variations.`);
      setActiveTab("studio");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Variation failed.");
      setActiveTab("studio");
    } finally {
      setLoading(false);
    }
  }

  function togglePick(candidateId: string) {
    updateProject((item) => {
      const picked = item.picks.includes(candidateId);
      const picks = picked
        ? item.picks.filter((id) => id !== candidateId)
        : item.picks.length >= 7
          ? item.picks
          : [...item.picks, candidateId];
      return {
        ...item,
        picks,
        candidates: item.candidates.map((candidate) =>
          candidate.id === candidateId ? { ...candidate, isPicked: !picked && item.picks.length < 7 } : candidate
        )
      };
    });
  }

  function newProject() {
    const next = createProject();
    setProjects((items) => [next, ...items]);
    setCurrentId(next.id);
  }

  function exportProject(format: "json" | "txt" | "csv") {
    const filename = `${project.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "baroname"}.${format}`;
    let content = "";
    let type = "text/plain";

    if (format === "json") {
      content = JSON.stringify(project, null, 2);
      type = "application/json";
    } else if (format === "csv") {
      const rows = [
        ["Name", "Pronunciation", "Global Fit", "Average", "Positioning", "Risks"],
        ...project.candidates.map((candidate) => [
          candidate.displayName,
          candidate.pronunciation,
          candidate.globalFit,
          String(scoreAverage(candidate)),
          candidate.positioning,
          candidate.risks.map((risk) => risk.note).join(" | ")
        ])
      ];
      content = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
      type = "text/csv";
    } else {
      content = [
        `BaroName Project: ${project.title}`,
        "",
        `Brief: ${project.brief.oneLineDescription}`,
        "",
        ...project.candidates.map((candidate) => {
          return `${candidate.displayName} (${candidate.pronunciation})\n${candidate.positioning}\nRisk: ${candidate.risks.map((risk) => risk.note).join(" | ")}\n`;
        })
      ].join("\n");
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result)) as Project;
        const next = {
          ...imported,
          id: createId("project"),
          title: `${imported.title || "Imported project"} copy`,
          updatedAt: new Date().toISOString()
        };
        setProjects((items) => [next, ...items]);
        setCurrentId(next.id);
        setMessage("Imported project JSON.");
      } catch {
        setMessage("This file is not a valid BaroName project JSON.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  const sortedCandidates = useMemo(() => {
    if (!project) return [];
    const items = [...project.candidates];
    if (sortMode === "memory") {
      return items.sort((a, b) => b.scores.memorability - a.scores.memorability);
    }
    if (sortMode === "sound") {
      return items.sort((a, b) => b.scores.pronunciation - a.scores.pronunciation);
    }
    if (sortMode === "global") {
      return items.sort((a, b) => b.scores.globalReadiness - a.scores.globalReadiness);
    }
    if (sortMode === "short") {
      return items.sort((a, b) => a.displayName.length - b.displayName.length);
    }
    return items.sort((a, b) => scoreAverage(b) - scoreAverage(a));
  }, [project, sortMode]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{t.privateWorkspace}</p>
          <h1>BaroName</h1>
        </div>
        <input
          className="project-title"
          value={project.title}
          onChange={(event) => updateProject((item) => ({ ...item, title: event.target.value }))}
          aria-label="Project title"
        />
        <div className="topbar-actions">
          <div className="analysis-toggle" aria-label="Analysis language">
            <span>Analysis</span>
            <button className={uiLanguage === "ko" ? "active" : ""} onClick={() => setUiLanguage("ko")}>
              KOR
            </button>
            <button className={uiLanguage === "en" ? "active" : ""} onClick={() => setUiLanguage("en")}>
              ENG
            </button>
          </div>
          <span className="status-pill">{loading ? t.generating : cooldownLeft > 0 ? `Ready in ${cooldownLeft}s` : t.ready}</span>
          <button className="ghost-button" onClick={resetView}>
            {t.resetView}
          </button>
          <button className="ghost-button" onClick={logout}>
            {t.lock}
          </button>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="Workspace sections">
        <button className={activeTab === "brief" ? "active" : ""} onClick={() => setActiveTab("brief")}>
          {t.brief}
        </button>
        <button className={activeTab === "studio" ? "active" : ""} onClick={() => setActiveTab("studio")}>
          {t.studio}
        </button>
        <button className={activeTab === "picks" ? "active" : ""} onClick={() => setActiveTab("picks")}>
          {t.picks} ({project.picks.length})
        </button>
      </nav>

      <section className="workspace-grid">
        <aside className={`panel brief-panel ${activeTab === "brief" ? "mobile-active" : ""}`}>
          <div className="panel-heading">
            <h2>{t.brandBrief}</h2>
            <p>{t.briefHelp}</p>
          </div>

          <label>
            Category
            <select value={project.brief.category} onChange={(event) => updateBrief({ category: event.target.value })}>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>

          <label>
            One-line brief
            <textarea
              value={project.brief.oneLineDescription}
              onChange={(event) => updateBrief({ oneLineDescription: event.target.value })}
              placeholder="An AI tool that helps solo founders create global brand names."
              rows={4}
            />
          </label>

          <ChipInput
            label="Keywords"
            values={project.brief.keywords}
            placeholder="Type and press Enter"
            onKeyDown={(event) => handleKeyword(event, "keywords")}
            onRemove={(value) => removeChip("keywords", value)}
          />

          <label>
            Audience
            <input
              value={project.brief.audience}
              onChange={(event) => updateBrief({ audience: event.target.value })}
              placeholder="solo founders, creators, indie makers"
            />
          </label>

          <div className="field-block">
            <span className="field-label">Tone</span>
            <div className="chip-grid">
              {tones.map((tone) => (
                <button
                  key={tone.value}
                  className={project.brief.desiredTone.includes(tone.value) ? "chip selected" : "chip"}
                  onClick={() => toggleTone(tone.value)}
                  type="button"
                >
                  {uiLanguage === "ko" ? tone.ko : tone.value}
                </button>
              ))}
            </div>
            <input
              className="soft-input"
              placeholder={t.customTone}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addTone(event.currentTarget.value);
                event.currentTarget.value = "";
              }}
            />
          </div>

          <label>
            Avoid tone
            <input
              value={project.brief.avoidTone}
              onChange={(event) => updateBrief({ avoidTone: event.target.value })}
              placeholder="childish, too corporate, hard to say"
            />
          </label>
          <div className="preset-grid" aria-label="Avoid tone templates">
            {avoidTonePresets.map((tone) => (
              <button
                key={tone.value}
                className={parseList(project.brief.avoidTone).includes(tone.value) ? "preset-chip selected" : "preset-chip"}
                onClick={() => toggleAvoidTone(tone.value)}
                type="button"
              >
                {uiLanguage === "ko" ? tone.ko : tone.value}
              </button>
            ))}
          </div>

          <div className="field-block">
            <div className="range-row">
              <span className="field-label">Creativity</span>
              <strong>{project.settings.creativityLevel}</strong>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={project.settings.creativityLevel}
              onChange={(event) => updateSettings({ creativityLevel: Number(event.target.value) })}
            />
            <div className="range-labels">
              <span>Clear</span>
              <span>Bold</span>
            </div>
            <p className="creative-note">{t.creativityNotes[project.settings.creativityLevel - 1]}</p>
          </div>

          <label>
            Language
            <select
              value={project.settings.languageMode}
              onChange={(event) => updateSettings({ languageMode: event.target.value as LanguageMode })}
            >
              <option value="english_first">English first</option>
              <option value="english_korean">English + Korean</option>
              <option value="korean_global">Korean, global-friendly</option>
              <option value="open_mix">Open mix</option>
            </select>
          </label>

          <div className="field-block">
            <div className="field-title-row">
              <span className="field-label">Naming engines</span>
              {recommendedEngines.length > 0 ? <span className="recommend-note">Suggested from brief</span> : null}
            </div>
            <div className="engine-mode-row">
              <button
                className={autoEngines ? "mode-pill active" : "mode-pill"}
                onClick={() => setAutoEngines((value) => !value)}
                type="button"
              >
                {t.autoEngines}
              </button>
              <button className="mode-pill" onClick={applyRecommendedEngines} disabled={recommendedEngines.length === 0} type="button">
                {t.applySuggested}
              </button>
            </div>
            <div className="chip-grid">
              {engines.map((engine) => (
                <button
                  key={engine.value}
                  className={[
                    "chip engine-chip",
                    project.settings.techniques.includes(engine.value) ? "selected" : "",
                    recommendedEngines.includes(engine.value) ? "recommended" : ""
                  ].join(" ")}
                  onClick={() => toggleEngine(engine.value)}
                  type="button"
                >
                  {engine.label}
                  <span className="engine-tooltip">{engine.description}</span>
                </button>
              ))}
            </div>
          </div>

          <ChipInput
            label="Must include"
            values={project.brief.mustInclude}
            placeholder="Optional words"
            onKeyDown={(event) => handleKeyword(event, "mustInclude")}
            onRemove={(value) => removeChip("mustInclude", value)}
          />

          <ChipInput
            label="Banned words"
            values={project.brief.bannedWords}
            placeholder="craft, labs"
            onKeyDown={(event) => handleKeyword(event, "bannedWords")}
            onRemove={(value) => removeChip("bannedWords", value)}
          />

          <div className="prompt-builder">
            <div className="prompt-row">
              <div>
                <strong>{t.promptBuilder}</strong>
                <p>Build a reusable AI prompt from this brief.</p>
              </div>
              <label className="switch-label">
                <input type="checkbox" checked={promptOnly} onChange={(event) => setPromptOnly(event.target.checked)} />
                {t.promptOnly}
              </label>
            </div>
            <button className="secondary-button" type="button" onClick={generatePromptOnly}>
              {t.generatedPrompt}
            </button>
            {project.generatedPrompt ? (
              <div className="prompt-preview">
                <textarea readOnly value={project.generatedPrompt} rows={7} />
                <button type="button" onClick={() => navigator.clipboard?.writeText(project.generatedPrompt || "")}>
                  {t.copyPrompt}
                </button>
              </div>
            ) : null}
          </div>

          <button className="primary-button" onClick={generateNames} disabled={loading || cooldownLeft > 0}>
            {loading ? t.generating : cooldownLeft > 0 ? `Ready in ${cooldownLeft}s` : t.generate}
          </button>
          {message ? <p className="inline-status" aria-live="polite">{message}</p> : null}
        </aside>

        <section className={`panel studio-panel ${activeTab === "studio" ? "mobile-active" : ""} ${loading ? "is-generating" : ""}`}>
          <div className="studio-toolbar">
            <div>
              <p className="eyebrow">{t.namingStudio}</p>
              <h2>{t.studioTitle}</h2>
              <p className="toolbar-subtitle">{t.studioSubtitle}</p>
            </div>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} aria-label="Sort candidates">
              <option value="recommended">Recommended</option>
              <option value="memory">Memory</option>
              <option value="sound">Sound</option>
              <option value="global">Global</option>
              <option value="short">Shortest</option>
            </select>
          </div>

          {message ? <div className="notice">{message}</div> : null}
          {project.lastInsight && !loading ? <div className="insight">{t.insight}: {project.lastInsight}</div> : null}

          {loading ? <GeneratingState uiLanguage={uiLanguage} /> : null}

          {project.candidates.length === 0 && !loading ? (
            <div className="empty-state">
              <h3>{t.startBrief}</h3>
              <p>{t.emptyHelp}</p>
              <button
                className="ghost-button"
                onClick={() => {
                  updateBrief({
                    oneLineDescription: "An AI tool that helps solo founders create global brand names.",
                    keywords: ["naming", "brand", "global"],
                    audience: "solo founders, creators, indie makers"
                  });
                  setActiveTab("brief");
                }}
              >
                {t.sampleBrief}
              </button>
            </div>
          ) : project.candidates.length > 0 ? (
            <div className="candidate-list">
              {sortedCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  picked={project.picks.includes(candidate.id)}
                  onPick={() => togglePick(candidate.id)}
                  onVariation={(transformation) => createVariation(candidate, transformation)}
                  uiLanguage={uiLanguage}
                  onFocus={() => setFocusedCandidateId(candidate.id)}
                />
              ))}
            </div>
          ) : null}
        </section>

        <aside className={`panel picks-panel ${activeTab === "picks" ? "mobile-active" : ""}`}>
          <div className="panel-heading">
            <h2>Picks</h2>
            <p>{project.picks.length} selected, max 7.</p>
          </div>

          <div className="pick-stack">
            {pickedCandidates.length === 0 ? (
              <p className="muted">Pick candidates to compare them here.</p>
            ) : (
              pickedCandidates.map((candidate) => (
                <div key={candidate.id} className="pick-card">
                  <div>
                    <strong>{candidate.displayName}</strong>
                    <span>{candidate.globalFit} · {scoreAverage(candidate)}</span>
                  </div>
                  <button onClick={() => togglePick(candidate.id)} aria-label={`Remove ${candidate.displayName}`}>
                    ×
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="preference-box">
            <p className="eyebrow">Preference signal</p>
            <p>{preferenceSummary}</p>
          </div>

          <div className="compare-box">
            <h3>Compare</h3>
            {pickedCandidates.length < 2 ? (
              <p className="muted">Pick at least two names to compare.</p>
            ) : (
              <div className="compare-table" role="table">
                <div className="compare-row compare-head" role="row">
                  <span>Name</span>
                  <span>Sound</span>
                  <span>Global</span>
                  <span>Risk</span>
                </div>
                {pickedCandidates.slice(0, 5).map((candidate) => (
                  <div className="compare-row" role="row" key={candidate.id}>
                    <span>{candidate.displayName}</span>
                    <span>{candidate.scores.pronunciation}</span>
                    <span>{candidate.scores.globalReadiness}</span>
                    <span>{candidate.risks[0]?.level || "medium"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="projects-box">
            <h3>Projects</h3>
            <button className="secondary-button" onClick={newProject}>
              New project
            </button>
            <select value={currentId} onChange={(event) => setCurrentId(event.target.value)} aria-label="Project list">
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div className="export-grid">
            <button onClick={() => exportProject("json")}>Export JSON</button>
            <button onClick={() => exportProject("txt")}>Export TXT</button>
            <button onClick={() => exportProject("csv")}>Export CSV</button>
            <button onClick={() => fileInputRef.current?.click()}>Import JSON</button>
            <input ref={fileInputRef} hidden type="file" accept="application/json,.json" onChange={importProject} />
          </div>
        </aside>
      </section>
      {focusedCandidate ? (
        <FocusMode
          candidate={focusedCandidate}
          uiLanguage={uiLanguage}
          picked={project.picks.includes(focusedCandidate.id)}
          onClose={() => setFocusedCandidateId("")}
          onPick={() => togglePick(focusedCandidate.id)}
          onVariation={(transformation) => createVariation(focusedCandidate, transformation)}
        />
      ) : null}
    </main>
  );
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: response.ok
        ? "The server returned a response BaroName could not read."
        : `Server returned ${response.status}. Check Vercel logs and environment variables.`
    };
  }
}

function ChipInput({
  label,
  values,
  placeholder,
  onKeyDown,
  onRemove
}: {
  label: string;
  values: string[];
  placeholder: string;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onRemove: (value: string) => void;
}) {
  return (
    <div className="field-block">
      <span className="field-label">{label}</span>
      <div className="chip-input">
        {values.map((value) => (
          <button className="chip selected" key={value} onClick={() => onRemove(value)} type="button">
            {value} ×
          </button>
        ))}
        <input placeholder={placeholder} onKeyDown={onKeyDown} />
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  picked,
  onPick,
  onVariation,
  uiLanguage,
  onFocus
}: {
  candidate: StoredCandidate;
  picked: boolean;
  onPick: () => void;
  onVariation: (transformation: Transformation) => void;
  uiLanguage: UiLanguage;
  onFocus: () => void;
}) {
  const avg = scoreAverage(candidate);
  const t = copy[uiLanguage];

  return (
    <article className={picked ? "candidate-card picked" : "candidate-card"}>
      <div className="candidate-meta">
        <span>{candidate.techniques[0]?.replace("_", "-") || "invented"}</span>
        <span>{candidate.language.replace("_", " + ")}</span>
        <span className={`fit fit-${candidate.globalFit}`}>{candidate.globalFit}</span>
        <button className="pick-button" onClick={onPick} aria-label={`Pick ${candidate.displayName}`}>
          {picked ? "★" : "☆"}
        </button>
      </div>

      <div className="candidate-main" onClick={onFocus} role="button" tabIndex={0} onKeyDown={(event) => {
        if (event.key === "Enter") onFocus();
      }}>
        <div>
          <h3>{candidate.displayName}</h3>
          <p className="pronunciation">{candidate.pronunciation}</p>
        </div>
        <span className="fit-score">{avg}</span>
      </div>

      <p className="ai-take">{candidate.aiTake || candidate.positioning}</p>
      <p className="positioning">{candidate.positioning}</p>

      <details className="candidate-details">
        <summary>{t.viewDetails}</summary>
        <div>
          <p className="rationale">{candidate.rationale}</p>
          <div className="risk-line">
            <strong>{t.risk}:</strong> {candidate.risks[0]?.note || "Manual check needed before final use."}
          </div>
          <p>
            <strong>{t.sound}:</strong> {candidate.soundProfile.rhythm}. {candidate.soundProfile.mouthfeel}.
          </p>
          <p>
            <strong>{t.bestFor}:</strong> {candidate.bestFor.join(", ")}
          </p>
          <p>
            <strong>{t.taglineSeeds}:</strong> {candidate.taglineSeeds.join(" / ")}
          </p>
          <p>
            <strong>{t.variants}:</strong> {candidate.variants.join(", ")}
          </p>
        </div>
      </details>

      <div className="card-actions">
        <button onClick={() => onVariation("more_like_this")}>{t.moreLike}</button>
        <button onClick={() => onVariation("shorter")}>{t.shorter}</button>
        <button onClick={() => onVariation("more_premium")}>{t.premium}</button>
        <button onClick={() => navigator.clipboard?.writeText(candidate.displayName)}>{t.copyName}</button>
      </div>
    </article>
  );
}

function GeneratingState({ uiLanguage }: { uiLanguage: UiLanguage }) {
  const t = copy[uiLanguage];
  const glyphs = ["/", "\\", "+", "-", "*", "name", "tone", "fit"];

  return (
    <div className="generating-state" aria-live="polite">
      <div className="glyph-stage" aria-hidden="true">
        {glyphs.map((glyph, index) => (
          <span key={`${glyph}-${index}`}>{glyph}</span>
        ))}
      </div>
      <div className="generating-copy">
        <strong>{t.generating}</strong>
        <div className="working-lines">
          {t.workingLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function FocusMode({
  candidate,
  uiLanguage,
  picked,
  onClose,
  onPick,
  onVariation
}: {
  candidate: StoredCandidate;
  uiLanguage: UiLanguage;
  picked: boolean;
  onClose: () => void;
  onPick: () => void;
  onVariation: (transformation: Transformation) => void;
}) {
  const t = copy[uiLanguage];
  const avg = scoreAverage(candidate);

  return (
    <div className="focus-backdrop" role="dialog" aria-modal="true" aria-label={`${candidate.displayName} focus mode`}>
      <button className="focus-scrim" onClick={onClose} aria-label="Close focus mode" />
      <article className="focus-panel">
        <header className="focus-header">
          <div>
            <p className="eyebrow">{candidate.techniques.join(" / ")} · {candidate.language.replace("_", " + ")}</p>
            <h2>{candidate.displayName}</h2>
            <p>{candidate.pronunciation}</p>
          </div>
          <div className="focus-actions">
            <span className="fit-score">{avg}</span>
            <button className="pick-button" onClick={onPick}>{picked ? "★" : "☆"}</button>
            <button className="ghost-button" onClick={onClose}>Close</button>
          </div>
        </header>
        <div className="focus-body">
          <section className="focus-main">
            <h3>{candidate.aiTake || candidate.positioning}</h3>
            <p>{candidate.positioning}</p>
            <p>{candidate.rationale}</p>
            <div className="risk-line">
              <strong>{t.risk}:</strong> {candidate.risks[0]?.note || "Manual check needed before final use."}
            </div>
          </section>
          <aside className="focus-side">
            <p><strong>{t.sound}</strong><br />{candidate.soundProfile.rhythm}. {candidate.soundProfile.mouthfeel}.</p>
            <p><strong>{t.bestFor}</strong><br />{candidate.bestFor.join(", ")}</p>
            <p><strong>{t.taglineSeeds}</strong><br />{candidate.taglineSeeds.join(" / ")}</p>
            <p><strong>{t.variants}</strong><br />{candidate.variants.join(", ")}</p>
          </aside>
        </div>
        <footer className="focus-footer">
          <button onClick={() => onVariation("more_like_this")}>{t.moreLike}</button>
          <button onClick={() => onVariation("shorter")}>{t.shorter}</button>
          <button onClick={() => onVariation("more_premium")}>{t.premium}</button>
          <button onClick={() => navigator.clipboard?.writeText(candidate.displayName)}>{t.copyName}</button>
        </footer>
      </article>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="score">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
