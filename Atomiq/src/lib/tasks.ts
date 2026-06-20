export type SplitMode = "fast" | "detailed";

export type TaskType = "research" | "decision" | "creation" | "setup" | "review";

export type Difficulty = "easy" | "medium" | "hard";

export type TaskStatus = "locked" | "active" | "done";

export type MicroTask = {
  id: string;
  title: string;
  type: TaskType;
  durationMinutes: number;
  difficulty: Difficulty;
  startTrigger: string;
  steps: string[];
  doneCriteria: string;
  notes?: string;
  status: TaskStatus;
};

export type TaskPlan = {
  goal: string;
  mode: SplitMode;
  dailyMinutes: number;
  summary: string;
  cards: MicroTask[];
};

export const demoPlan: TaskPlan = {
  goal: "한 달 안에 포트폴리오 웹사이트 만들기",
  mode: "fast",
  dailyMinutes: 30,
  summary: "목적을 먼저 좁히고, 보여줄 프로젝트를 고른 뒤, 작은 공개 버전까지 이동합니다.",
  cards: [
    {
      id: "demo-1",
      title: "포트폴리오의 대상 정하기",
      type: "decision",
      durationMinutes: 25,
      difficulty: "easy",
      startTrigger: "메모장에 이 포트폴리오를 볼 사람을 한 문장으로 적으세요.",
      steps: [
        "지원하거나 만나고 싶은 대상을 적는다.",
        "그 사람이 가장 궁금해할 정보를 세 가지 고른다.",
        "첫 화면에서 전달할 문장을 하나 만든다.",
      ],
      doneCriteria: "대상, 목적, 첫 문장이 각각 한 줄로 적혀 있다.",
      status: "active",
    },
    {
      id: "demo-2",
      title: "보여줄 프로젝트 2개 고르기",
      type: "decision",
      durationMinutes: 30,
      difficulty: "easy",
      startTrigger: "최근 작업물 목록을 열고 가장 설명하기 쉬운 것부터 표시하세요.",
      steps: [
        "완성도가 높은 작업을 모두 적는다.",
        "역할과 결과를 설명할 수 있는 작업에 별표를 친다.",
        "첫 버전에 넣을 프로젝트 2개만 남긴다.",
      ],
      doneCriteria: "포트폴리오에 넣을 프로젝트 2개와 제외할 항목이 정해져 있다.",
      status: "locked",
    },
    {
      id: "demo-3",
      title: "첫 화면 와이어프레임 만들기",
      type: "creation",
      durationMinutes: 30,
      difficulty: "medium",
      startTrigger: "종이에 상단 이름, 소개 문장, 프로젝트 영역만 박스로 그리세요.",
      steps: [
        "상단에 이름과 한 문장 소개를 둔다.",
        "프로젝트 2개가 보일 영역을 만든다.",
        "연락 버튼 위치를 표시한다.",
      ],
      doneCriteria: "첫 화면에 들어갈 세 구역의 위치가 정해져 있다.",
      status: "locked",
    },
  ],
};
