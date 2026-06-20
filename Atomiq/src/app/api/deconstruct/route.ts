import { NextResponse } from "next/server";
import type { MicroTask, SplitMode, TaskPlan, TaskStatus } from "@/lib/tasks";

const taskSchema = {
  type: "object",
  properties: {
    goal: { type: "string" },
    mode: { type: "string", enum: ["fast", "detailed"] },
    dailyMinutes: { type: "integer" },
    summary: { type: "string" },
    cards: {
      type: "array",
      minItems: 5,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          type: {
            type: "string",
            enum: ["research", "decision", "creation", "setup", "review"],
          },
          durationMinutes: { type: "integer" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          startTrigger: { type: "string" },
          steps: { type: "array", minItems: 3, maxItems: 5, items: { type: "string" } },
          doneCriteria: { type: "string" },
          notes: { type: "string" },
          status: { type: "string", enum: ["locked", "active", "done"] },
        },
        required: [
          "id",
          "title",
          "type",
          "durationMinutes",
          "difficulty",
          "startTrigger",
          "steps",
          "doneCriteria",
          "status",
        ],
      },
    },
  },
  required: ["goal", "mode", "dailyMinutes", "summary", "cards"],
};

function normalizePlan(plan: TaskPlan, goal: string, mode: SplitMode, dailyMinutes: number): TaskPlan {
  const cards = plan.cards.map((card: MicroTask, index: number) => {
    const status: TaskStatus = index === 0 ? "active" : "locked";

    return {
      ...card,
      id: card.id || `task-${index + 1}`,
      status,
      durationMinutes: Math.min(Math.max(card.durationMinutes || dailyMinutes, 5), dailyMinutes),
    };
  });

  return {
    goal: plan.goal || goal,
    mode,
    dailyMinutes,
    summary: plan.summary || "목표를 지금 실행 가능한 카드 흐름으로 나눴습니다.",
    cards,
  };
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    goal?: string;
    mode?: SplitMode;
    dailyMinutes?: number;
  };

  const goal = body.goal?.trim();
  const mode = body.mode === "detailed" ? "detailed" : "fast";
  const dailyMinutes = Number(body.dailyMinutes || 30);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!goal) {
    return NextResponse.json({ error: "목표를 입력해 주세요." }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY가 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const prompt = `
You are Atomiq, an AI task deconstruction engine.
Break the user's large goal into immediately actionable micro-task cards.

Rules:
- Respond in Korean.
- The first card must be startable within 5 minutes.
- Every card must fit within ${dailyMinutes} minutes.
- Prefer concrete physical actions over abstract planning.
- Show only 5 to 8 cards for fast mode, 8 to 12 cards for detailed mode.
- Set only the first card to "active"; all others must be "locked".
- Use short, practical wording.

User goal: ${goal}
Mode: ${mode}
Daily available minutes: ${dailyMinutes}
`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseFormat: {
            text: {
              mimeType: "application/json",
              schema: taskSchema,
            },
          },
        },
      }),
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: "Gemini 응답을 가져오지 못했습니다." },
      { status: response.status },
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return NextResponse.json({ error: "비어 있는 응답을 받았습니다." }, { status: 502 });
  }

  try {
    const plan = JSON.parse(text) as TaskPlan;
    return NextResponse.json(normalizePlan(plan, goal, mode, dailyMinutes));
  } catch {
    return NextResponse.json({ error: "응답을 카드 형식으로 읽지 못했습니다." }, { status: 502 });
  }
}
