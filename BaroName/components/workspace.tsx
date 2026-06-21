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
  VariationPayload
} from "@/lib/types";

const STORAGE_KEY = "baroname.projects.v1";
const COOLDOWN_MS = 8000;

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

const tones = ["Modern", "Trustworthy", "Warm", "Premium", "Playful", "Technical", "Minimal", "Bold"];

const engines: Array<{ value: Technique; label: string }> = [
  { value: "blend", label: "Blend" },
  { value: "invented", label: "Invented" },
  { value: "metaphor", label: "Metaphor" },
  { value: "phonetic", label: "Phonetic" },
  { value: "descriptive", label: "Descriptive" },
  { value: "benefit_led", label: "Benefit-led" },
  { value: "persona_led", label: "Persona-led" },
  { value: "story", label: "Story" }
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
    lastInsight: ""
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

export function Workspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"brief" | "studio" | "picks">("studio");
  const [sortMode, setSortMode] = useState("recommended");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
    if (projects.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, currentId }));
    }
  }, [projects, currentId]);

  const project = projects.find((item) => item.id === currentId) || projects[0] || createProject();
  const pickedCandidates = useMemo(
    () => project.candidates.filter((candidate) => project.picks.includes(candidate.id)),
    [project]
  );
  const preferenceSummary = useMemo(() => buildPreferenceSummary(pickedCandidates), [pickedCandidates]);
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

  async function generateNames() {
    if (!project.brief.oneLineDescription.trim()) {
      setMessage("Add a one-line brief first.");
      setActiveTab("brief");
      return;
    }

    if (loading || cooldownLeft > 0) {
      return;
    }

    setLoading(true);
    setMessage("Shaping naming directions...");
    setActiveTab("studio");

    const payload: GenerationPayload = {
      projectId: project.id,
      mode: "generate",
      brief: project.brief,
      settings: project.settings,
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
        candidates: [...stored, ...item.candidates].slice(0, 80),
        lastInsight: data.sessionInsight
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
    setMessage(`Creating ${transformation.replaceAll("_", " ")} variations for ${candidate.displayName}...`);

    const payload: VariationPayload = {
      projectId: project.id,
      mode: "variation",
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
      setMessage(`Added ${stored.length} variations.`);
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
          <p className="eyebrow">Private naming workspace</p>
          <h1>BaroName</h1>
        </div>
        <input
          className="project-title"
          value={project.title}
          onChange={(event) => updateProject((item) => ({ ...item, title: event.target.value }))}
          aria-label="Project title"
        />
        <div className="topbar-actions">
          <span className="status-pill">{loading ? "Generating" : cooldownLeft > 0 ? `Ready in ${cooldownLeft}s` : "Ready"}</span>
          <button className="ghost-button" onClick={logout}>
            Lock
          </button>
        </div>
      </header>

      <nav className="mobile-tabs" aria-label="Workspace sections">
        <button className={activeTab === "brief" ? "active" : ""} onClick={() => setActiveTab("brief")}>
          Brief
        </button>
        <button className={activeTab === "studio" ? "active" : ""} onClick={() => setActiveTab("studio")}>
          Studio
        </button>
        <button className={activeTab === "picks" ? "active" : ""} onClick={() => setActiveTab("picks")}>
          Picks ({project.picks.length})
        </button>
      </nav>

      <section className="workspace-grid">
        <aside className={`panel brief-panel ${activeTab === "brief" ? "mobile-active" : ""}`}>
          <div className="panel-heading">
            <h2>Brand Brief</h2>
            <p>English-first names, global readability.</p>
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
                  key={tone}
                  className={project.brief.desiredTone.includes(tone) ? "chip selected" : "chip"}
                  onClick={() => toggleTone(tone)}
                  type="button"
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          <label>
            Avoid tone
            <input
              value={project.brief.avoidTone}
              onChange={(event) => updateBrief({ avoidTone: event.target.value })}
              placeholder="childish, too corporate, hard to say"
            />
          </label>

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
            <span className="field-label">Naming engines</span>
            <div className="chip-grid">
              {engines.map((engine) => (
                <button
                  key={engine.value}
                  className={project.settings.techniques.includes(engine.value) ? "chip selected" : "chip"}
                  onClick={() => toggleEngine(engine.value)}
                  type="button"
                >
                  {engine.label}
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

          <button className="primary-button" onClick={generateNames} disabled={loading || cooldownLeft > 0}>
            {loading ? "Generating" : cooldownLeft > 0 ? `Ready in ${cooldownLeft}s` : "Generate"}
          </button>
          {message ? <p className="inline-status" aria-live="polite">{message}</p> : null}
        </aside>

        <section className={`panel studio-panel ${activeTab === "studio" ? "mobile-active" : ""}`}>
          <div className="studio-toolbar">
            <div>
              <p className="eyebrow">Naming Studio</p>
              <h2>Generate, pick, and refine</h2>
              <p className="toolbar-subtitle">12 candidates per round · English-first · Global fit review</p>
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
          {project.lastInsight ? <div className="insight">Insight: {project.lastInsight}</div> : null}

          {project.candidates.length === 0 ? (
            <div className="empty-state">
              <h3>Start with a short brief.</h3>
              <p>
                Create global-first candidates with pronunciation, risks, and quick refinement actions.
              </p>
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
                Use sample brief
              </button>
            </div>
          ) : (
            <div className="candidate-list">
              {sortedCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  picked={project.picks.includes(candidate.id)}
                  onPick={() => togglePick(candidate.id)}
                  onVariation={(transformation) => createVariation(candidate, transformation)}
                />
              ))}
            </div>
          )}
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
  onVariation
}: {
  candidate: StoredCandidate;
  picked: boolean;
  onPick: () => void;
  onVariation: (transformation: Transformation) => void;
}) {
  const avg = scoreAverage(candidate);

  return (
    <article className={picked ? "candidate-card picked" : "candidate-card"}>
      <div className="candidate-meta">
        <span>{candidate.techniques[0]?.replace("_", "-") || "invented"}</span>
        <span>{candidate.language.replace("_", " + ")}</span>
        <span className={`fit fit-${candidate.globalFit}`}>Global fit: {candidate.globalFit}</span>
        <button className="pick-button" onClick={onPick} aria-label={`Pick ${candidate.displayName}`}>
          {picked ? "★" : "☆"}
        </button>
      </div>

      <div className="candidate-main">
        <div>
          <h3>{candidate.displayName}</h3>
          <p className="pronunciation">{candidate.pronunciation}</p>
        </div>
        <div className="avg-score">
          <strong>{avg}</strong>
          <span>avg</span>
        </div>
      </div>

      <p className="positioning">{candidate.positioning}</p>
      <p className="rationale">{candidate.rationale}</p>

      <div className="score-grid">
        <Score label="Memory" value={candidate.scores.memorability} />
        <Score label="Sound" value={candidate.scores.pronunciation} />
        <Score label="Distinct" value={candidate.scores.distinctiveness} />
        <Score label="Expand" value={candidate.scores.scalability} />
        <Score label="Global" value={candidate.scores.globalReadiness} />
      </div>

      <div className="risk-line">
        <strong>Risk:</strong> {candidate.risks[0]?.note || "Manual check needed before final use."}
      </div>

      <details className="candidate-details">
        <summary>Name anatomy</summary>
        <div>
          <p>
            <strong>Sound:</strong> {candidate.soundProfile.rhythm}. {candidate.soundProfile.mouthfeel}.
          </p>
          <p>
            <strong>Best for:</strong> {candidate.bestFor.join(", ")}
          </p>
          <p>
            <strong>Tagline seeds:</strong> {candidate.taglineSeeds.join(" / ")}
          </p>
          <p>
            <strong>Variants:</strong> {candidate.variants.join(", ")}
          </p>
        </div>
      </details>

      <div className="card-actions">
        <button onClick={() => onVariation("more_like_this")}>More like this</button>
        <button onClick={() => onVariation("shorter")}>Shorter</button>
        <button onClick={() => onVariation("more_premium")}>Premium</button>
        <button onClick={() => navigator.clipboard?.writeText(candidate.displayName)}>Copy</button>
      </div>
    </article>
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
