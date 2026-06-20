"use client";

import { useEffect, useMemo, useState } from "react";
import { demoPlan, type MicroTask, type SplitMode, type TaskPlan } from "@/lib/tasks";

const examples = [
  "유튜브 채널 개설해서 첫 영상 올리기",
  "한 달 안에 포트폴리오 웹사이트 만들기",
  "3주 동안 재무제표 읽는 법 배우기",
];

const loadingLines = [
  "목표를 읽고 있어요",
  "핵심 줄기를 찾는 중입니다",
  "오늘 시작할 첫 행동을 만들고 있어요",
  "작업 카드를 정리하고 있어요",
];

function minutesLabel(minutes: number) {
  return `${minutes}분`;
}

function difficultyLabel(difficulty: MicroTask["difficulty"]) {
  return {
    easy: "쉬움",
    medium: "보통",
    hard: "어려움",
  }[difficulty];
}

function typeLabel(type: MicroTask["type"]) {
  return {
    research: "조사",
    decision: "결정",
    creation: "제작",
    setup: "준비",
    review: "검토",
  }[type];
}

function buildMarkdown(plan: TaskPlan) {
  const lines = [
    `# ${plan.goal}`,
    "",
    plan.summary,
    "",
    `- 모드: ${plan.mode === "fast" ? "빠른 경로" : "꼼꼼한 경로"}`,
    `- 하루 가용 시간: ${plan.dailyMinutes}분`,
    "",
    "## 실행 카드",
    "",
  ];

  plan.cards.forEach((card, index) => {
    lines.push(
      `### ${index + 1}. ${card.title}`,
      `- 예상 시간: ${card.durationMinutes}분`,
      `- 난이도: ${difficultyLabel(card.difficulty)}`,
      `- 첫 5분: ${card.startTrigger}`,
      `- 완료 기준: ${card.doneCriteria}`,
      "",
      ...card.steps.map((step) => `- ${step}`),
      "",
    );
  });

  return lines.join("\n");
}

export default function Home() {
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState<SplitMode>("fast");
  const [dailyMinutes, setDailyMinutes] = useState(30);
  const [plan, setPlan] = useState<TaskPlan | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      const saved = window.localStorage.getItem("atomiq-plan");
      return saved ? (JSON.parse(saved) as TaskPlan) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIndex, setLoadingIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [exampleCardId, setExampleCardId] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    window.localStorage.setItem("atomiq-plan", JSON.stringify(plan));
  }, [plan]);

  useEffect(() => {
    if (!isLoading) return;
    const timer = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingLines.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const doneCount = plan?.cards.filter((card) => card.status === "done").length ?? 0;
  const activeCard = plan?.cards.find((card) => card.status === "active");
  const nextCard = plan?.cards.find((card) => card.status === "locked");
  const progress = plan ? Math.round((doneCount / plan.cards.length) * 100) : 0;

  const timeline = useMemo(() => {
    if (!plan) return [];
    return plan.cards.slice(0, Math.max(doneCount + 3, 4));
  }, [doneCount, plan]);

  async function createPlan() {
    const cleanGoal = goal.trim();
    if (!cleanGoal) {
      setMessage("목표를 먼저 입력해 주세요.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    setLoadingIndex(0);

    try {
      const response = await fetch("/api/deconstruct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: cleanGoal, mode, dailyMinutes }),
      });

      if (!response.ok) {
        const demo = {
          ...demoPlan,
          goal: cleanGoal,
          mode,
          dailyMinutes,
        };
        setPlan(demo);
        setMessage("Gemini 키가 없어서 데모 카드로 열었습니다.");
        return;
      }

      const nextPlan = (await response.json()) as TaskPlan;
      setPlan(nextPlan);
    } catch {
      setPlan({ ...demoPlan, goal: cleanGoal, mode, dailyMinutes });
      setMessage("연결이 불안정해서 데모 카드로 열었습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  function completeCard(cardId: string) {
    if (!plan) return;

    const nextCards = plan.cards.map((card) =>
      card.id === cardId ? { ...card, status: "done" as const } : card,
    );
    const firstLocked = nextCards.findIndex((card) => card.status === "locked");
    if (firstLocked >= 0) {
      nextCards[firstLocked] = { ...nextCards[firstLocked], status: "active" };
    }

    setPlan({ ...plan, cards: nextCards });
    setExampleCardId(null);
  }

  function splitCard(cardId: string) {
    if (!plan) return;

    const targetIndex = plan.cards.findIndex((card) => card.id === cardId);
    const target = plan.cards[targetIndex];
    if (!target) return;

    const replacement: MicroTask[] = [
      {
        ...target,
        id: `${target.id}-a`,
        title: `${target.title} 준비하기`,
        durationMinutes: Math.max(10, Math.floor(target.durationMinutes / 2)),
        startTrigger: "빈 문서나 메모장을 열고 필요한 재료를 세 줄로 적으세요.",
        steps: target.steps.slice(0, 3),
        doneCriteria: "작업에 필요한 정보와 재료가 한곳에 모여 있다.",
        status: "active",
      },
      {
        ...target,
        id: `${target.id}-b`,
        title: `${target.title} 마무리하기`,
        durationMinutes: Math.max(10, Math.ceil(target.durationMinutes / 2)),
        startTrigger: "방금 준비한 메모에서 가장 쉬운 항목 하나를 바로 처리하세요.",
        doneCriteria: target.doneCriteria,
        status: "locked",
      },
    ];

    setPlan({
      ...plan,
      cards: [
        ...plan.cards.slice(0, targetIndex),
        ...replacement,
        ...plan.cards.slice(targetIndex + 1),
      ],
    });
  }

  function rewriteCard(cardId: string) {
    if (!plan) return;
    setPlan({
      ...plan,
      cards: plan.cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              startTrigger: "타이머를 5분으로 맞추고, 이 카드의 결과물을 가장 작은 형태로 적으세요.",
              steps: [
                "결과물의 이름을 하나 정한다.",
                "지금 가진 자료만으로 첫 줄을 만든다.",
                "부족한 부분은 괄호로 표시하고 넘어간다.",
              ],
            }
          : card,
      ),
    });
  }

  function resetPlan() {
    setPlan(null);
    setGoal("");
    setMessage("");
    window.localStorage.removeItem("atomiq-plan");
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-5 sm:px-8">
        <header className="flex h-14 items-center justify-between border-b border-[var(--line)]">
          <button
            className="text-xl font-semibold"
            type="button"
            onClick={resetPlan}
            title="새 목표"
          >
            Atomiq
          </button>
          {plan ? (
            <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <span>{doneCount} / {plan.cards.length}</span>
              <div className="h-2 w-28 overflow-hidden rounded-sm bg-[var(--line)]">
                <div className="h-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <span className="text-sm text-[var(--muted)]">Atomic tasks. Instant action.</span>
          )}
        </header>

        {!plan ? (
          <section className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-3xl">
              <p className="mb-4 text-sm font-medium text-[var(--accent)]">First move</p>
              <h1 className="mb-8 max-w-2xl text-4xl font-semibold leading-tight sm:text-6xl">
                어떤 목표를 작게 쪼갤까요?
              </h1>

              <div className="border border-[var(--line)] bg-[var(--surface)] p-3">
                <textarea
                  className="min-h-32 w-full resize-none bg-transparent p-3 text-2xl outline-none placeholder:text-[var(--muted)]"
                  placeholder="예: 유튜브 채널 개설해서 첫 영상 올리기"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                />

                <div className="flex flex-col gap-4 border-t border-[var(--line)] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {(["fast", "detailed"] as SplitMode[]).map((item) => (
                      <button
                        key={item}
                        className={`h-10 border px-4 text-sm ${
                          mode === item
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--line)] text-[var(--muted)]"
                        }`}
                        type="button"
                        onClick={() => setMode(item)}
                      >
                        {item === "fast" ? "빠른 경로" : "꼼꼼한 경로"}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[15, 30, 60].map((minutes) => (
                      <button
                        key={minutes}
                        className={`h-10 border px-3 text-sm ${
                          dailyMinutes === minutes
                            ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                            : "border-[var(--line)] text-[var(--muted)]"
                        }`}
                        type="button"
                        onClick={() => setDailyMinutes(minutes)}
                      >
                        {minutesLabel(minutes)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  className="h-12 bg-[var(--accent)] px-5 font-medium text-white disabled:opacity-60"
                  type="button"
                  onClick={createPlan}
                  disabled={isLoading}
                >
                  {isLoading ? loadingLines[loadingIndex] : "실행 카드 만들기"}
                </button>
                {message ? <p className="text-sm text-[var(--warning)]">{message}</p> : null}
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    className="border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]"
                    type="button"
                    onClick={() => setGoal(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className="grid flex-1 gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              <div>
                <p className="mb-2 text-sm font-medium text-[var(--accent)]">{plan.summary}</p>
                <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">{plan.goal}</h1>
              </div>

              {message ? <p className="text-sm text-[var(--warning)]">{message}</p> : null}

              {activeCard ? (
                <article className="border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
                  <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
                    <span className="bg-[var(--chip)] px-2 py-1">{typeLabel(activeCard.type)}</span>
                    <span>{minutesLabel(activeCard.durationMinutes)}</span>
                    <span>{difficultyLabel(activeCard.difficulty)}</span>
                  </div>

                  <h2 className="mb-5 text-3xl font-semibold leading-tight">{activeCard.title}</h2>

                  <div className="mb-6 border-l-4 border-[var(--accent)] bg-white p-4">
                    <p className="mb-1 text-sm font-medium text-[var(--accent)]">첫 5분</p>
                    <p className="text-lg leading-8">{activeCard.startTrigger}</p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <p className="mb-3 text-sm font-medium text-[var(--muted)]">단계</p>
                      <ol className="space-y-3">
                        {activeCard.steps.map((step, index) => (
                          <li key={step} className="flex gap-3 leading-7">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[var(--chip)] text-sm">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <p className="mb-3 text-sm font-medium text-[var(--muted)]">완료 기준</p>
                      <p className="leading-8">{activeCard.doneCriteria}</p>
                      {exampleCardId === activeCard.id ? (
                        <p className="mt-4 bg-[var(--soft)] p-4 leading-7">
                          예: 결과물이 완벽하지 않아도 됩니다. 지금은 제목, 첫 문장, 빈칸 표시만 있으면 다음 카드로 넘어갈 수 있어요.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2">
                    <button
                      className="h-11 bg-[var(--accent)] px-5 font-medium text-white"
                      type="button"
                      onClick={() => completeCard(activeCard.id)}
                    >
                      완료
                    </button>
                    <button className="h-11 border border-[var(--line)] px-4" type="button" onClick={() => splitCard(activeCard.id)}>
                      더 작게
                    </button>
                    <button
                      className="h-11 border border-[var(--line)] px-4"
                      type="button"
                      onClick={() => setExampleCardId(exampleCardId === activeCard.id ? null : activeCard.id)}
                    >
                      예시 보기
                    </button>
                    <button className="h-11 border border-[var(--line)] px-4" type="button" onClick={() => rewriteCard(activeCard.id)}>
                      다시 쓰기
                    </button>
                  </div>
                </article>
              ) : (
                <div className="border border-[var(--line)] bg-[var(--surface)] p-8">
                  <h2 className="mb-3 text-3xl font-semibold">오늘 분량을 마쳤습니다</h2>
                  <p className="text-[var(--muted)]">새 목표를 만들거나 Markdown으로 내보낼 수 있습니다.</p>
                </div>
              )}
            </div>

            <aside className="flex flex-col gap-4">
              {nextCard ? (
                <div className="border border-[var(--line)] bg-white p-4">
                  <p className="mb-2 text-sm font-medium text-[var(--muted)]">다음 카드</p>
                  <h3 className="mb-3 text-lg font-semibold">{nextCard.title}</h3>
                  <p className="text-sm leading-6 text-[var(--muted)]">{nextCard.startTrigger}</p>
                </div>
              ) : null}

              <div className="border border-[var(--line)] bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--muted)]">흐름</p>
                  <button
                    className="text-sm text-[var(--accent)]"
                    type="button"
                    onClick={() => navigator.clipboard.writeText(buildMarkdown(plan))}
                  >
                    Markdown
                  </button>
                </div>
                <div className="space-y-3">
                  {timeline.map((card, index) => (
                    <div key={card.id} className="flex gap-3">
                      <span
                        className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center text-xs ${
                          card.status === "done"
                            ? "bg-[var(--accent)] text-white"
                            : card.status === "active"
                              ? "bg-[var(--ink)] text-white"
                              : "bg-[var(--chip)] text-[var(--muted)]"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className={card.status === "locked" ? "text-[var(--muted)]" : ""}>{card.title}</p>
                        <p className="text-xs text-[var(--muted)]">{minutesLabel(card.durationMinutes)}</p>
                      </div>
                    </div>
                  ))}
                  {plan.cards.length > timeline.length ? (
                    <p className="text-sm text-[var(--muted)]">나중 카드 {plan.cards.length - timeline.length}개</p>
                  ) : null}
                </div>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
