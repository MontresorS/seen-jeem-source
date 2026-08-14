import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { CATEGORIES, type Category, type Question } from "@/data/questions";

export type TeamIndex = number;
export type Points = 200 | 400 | 600;
export type LifelineKey = "phone" | "hole" | "double" | "trap" | "rest" | "choices2";

export const CHARADES_POINTS = 400;
export const CHARADES_SECONDS = 60;

export interface CharadesRound {
  team: TeamIndex;
  movie: string;
}

export const TWO_TEAM_CATEGORY_OPTIONS = [6, 9, 12] as const;
export const THREE_TEAM_CATEGORY_COUNT = 9;

export function isValidSetup(teamCount: number, categoryCount: number): teamCount is 2 | 3 {
  if (teamCount === 2) return TWO_TEAM_CATEGORY_OPTIONS.includes(categoryCount as (typeof TWO_TEAM_CATEGORY_OPTIONS)[number]);
  if (teamCount === 3) return categoryCount === THREE_TEAM_CATEGORY_COUNT;
  return false;
}

export function nextTeamIndex(current: TeamIndex, totalTeams: number): TeamIndex {
  if (totalTeams <= 0) return 0;
  return (current + 1) % totalTeams;
}

export interface LifelineMeta {
  key: LifelineKey;
  name: string;
  desc: string;
  when: "before" | "after";
  icon: string;
  tone: string; // tailwind classes for the chip
  isNew?: boolean;
}

export const LIFELINES: LifelineMeta[] = [
  {
    key: "phone",
    name: "اتصال بصديق",
    desc: "صديقك اللي يعرف كل شي هذا وقته دق عليه! عندك ٣٠ ثانية مكالمة إضافية.",
    when: "after",
    icon: "phone",
    tone: "text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-200 dark:bg-emerald-900/50 dark:border-emerald-700",
  },
  {
    key: "hole",
    name: "الحفرة",
    desc: "احفر لهم! جاوب صح، واخصم عدد النقاط اللي فزت فيها من نقاط الفريق الثاني. لازم تستخدمها قبل فتح السؤال.",
    when: "before",
    icon: "swap",
    tone: "text-amber-900 bg-amber-100 border-amber-800/40 dark:text-amber-100 dark:bg-amber-900/50 dark:border-amber-700",
  },
  {
    key: "double",
    name: "جاوب جوابين",
    desc: "متردد بجوابين؟ هذه لك. جاوب بالاثنين عشان تضمن النقاط.",
    when: "after",
    icon: "double",
    tone: "text-sky-700 bg-sky-100 border-sky-300 dark:text-sky-200 dark:bg-sky-900/50 dark:border-sky-700",
  },
  {
    key: "choices2",
    name: "اختيارين بس",
    desc: "نشيل لك اختيار واحد غلط من الاختيارات المتاحة (مرة واحدة لكل فريق).",
    when: "after",
    icon: "choices2",
    tone: "text-indigo-700 bg-indigo-100 border-indigo-300 dark:text-indigo-200 dark:bg-indigo-900/50 dark:border-indigo-700",
    isNew: true,
  },
  {
    key: "trap",
    name: "الفخ",
    desc: "ماعرفت الجواب؟ عط السؤال للفريق الثاني! وإذا جاوب غلط راح ينقص نقاط السؤال من رصيده.",
    when: "after",
    icon: "bomb",
    tone: "text-yellow-800 bg-yellow-100 border-yellow-400 dark:text-yellow-100 dark:bg-yellow-800/50 dark:border-yellow-600",
    isNew: true,
  },
  {
    key: "rest",
    name: "استريح",
    desc: "اختار أكثر شخص مثقف ضدك، وخله يستريح شوي عن المشاركة في إجابة هالسؤال.",
    when: "after",
    icon: "hand",
    tone: "text-rose-700 bg-rose-100 border-rose-300 dark:text-rose-200 dark:bg-rose-900/50 dark:border-rose-700",
  },
];

export const LIFELINE_BY_KEY = Object.fromEntries(LIFELINES.map((l) => [l.key, l])) as Record<
  LifelineKey,
  LifelineMeta
>;

export interface Team {
  name: string;
  score: number;
  used: Record<LifelineKey, boolean>;
}

export interface Cell {
  id: string;
  catKey: string;
  points: Points;
  slot: 0 | 1;
  question: Question;
  used: boolean;
  recycled?: boolean;
}

export interface ActiveQuestion {
  cellId: string;
  askingTeam: TeamIndex;
  /** If a trap was used, the answering opportunity is transferred here. Keep askingTeam as the original owner. */
  trappedTo?: TeamIndex | null;
  hole: boolean;
  holeTarget: TeamIndex | null;
  lifelines: Partial<Record<LifelineKey, TeamIndex>>;
}

export interface GameState {
  phase: "setup" | "board" | "question" | "results";
  gameName: string;
  teams: Team[];
  turn: TeamIndex;
  catKeys: string[];
  cells: Cell[];
  active: ActiveQuestion | null;
  pendingHole: TeamIndex | null;
  charades: CharadesRound | null;
  history: { question: Question; winner: TeamIndex | null; points: number }[];
  /** أسئلة استُخدمت في هذه الجلسة (تبقى بعد «العب مرة ثانية») — الأقدم أولاً */
  usedIds: string[];
  /** true إذا اضطررنا لإعادة استخدام أسئلة قديمة في اللوحة الحالية */
  recycledOnBoard: boolean;
  /** Timer state: timestamp when the current main/second timer will end (for QR mode restoration) */
  timerEndTimestamp?: number;
  /** Call timer state: timestamp when the 30-second call timer will end */
  callEndTimestamp?: number;
}

const freshTeam = (name: string): Team => ({
  name,
  score: 0,
  used: { phone: false, hole: false, double: false, trap: false, rest: false, choices2: false },
});

export const initialState: GameState = {
  phase: "setup",
  gameName: "",
  teams: [freshTeam("الفريق الأول"), freshTeam("الفريق الثاني")],
  turn: 0,
  catKeys: [],
  cells: [],
  active: null,
  pendingHole: null,
  charades: null,
  history: [],
  usedIds: [],
  recycledOnBoard: false,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build 6 cells (2 per point value) for a category, sampling only questions that
 * were never used in this session. If a pool is exhausted we borrow from another
 * point level, and only as a last resort recycle the *oldest* used question
 * (marked with ♻).
 */
function buildCells(
  cat: Category,
  usedSet: Set<string>,
  usedOrder: Map<string, number>,
  takenNow: Set<string>,
): Cell[] {
  // «وضح شوية»: كل الخانات تبدأ بـ600 وتقل القيمة مع كل ضغطة توضيح
  if (cat.key === "wadda7") {
    const freshAll = shuffle(cat.questions.filter((q) => !usedSet.has(q.id) && !takenNow.has(q.id)));
    const recyclable = shuffle(cat.questions.filter((q) => !takenNow.has(q.id))).sort(
      (a, b) => (usedOrder.get(a.id) ?? -1) - (usedOrder.get(b.id) ?? -1),
    );
    const cells: Cell[] = [];
    for (let i = 0; i < 6; i++) {
      const q = freshAll.shift() ?? recyclable.find((r) => !takenNow.has(r.id)) ?? cat.questions[0];
      const recycled = usedSet.has(q.id);
      takenNow.add(q.id);
      cells.push({
        id: `${cat.key}-600-${i}`,
        catKey: cat.key,
        points: 600,
        slot: (i % 2) as 0 | 1,
        question: q,
        used: false,
        recycled,
      });
    }
    return cells;
  }
  const fresh = (p: Points) =>
    shuffle(cat.questions.filter((q) => q.points === p && !usedSet.has(q.id)));
  const pools: Record<Points, Question[]> = { 200: fresh(200), 400: fresh(400), 600: fresh(600) };
  const freshSpare = shuffle(cat.questions.filter((q) => !usedSet.has(q.id)));

  const pick = (p: Points): { q: Question; recycled: boolean } => {
    const pool = pools[p];
    while (pool.length) {
      const q = pool.shift()!;
      if (!takenNow.has(q.id)) {
        takenNow.add(q.id);
        return { q, recycled: false };
      }
    }
    for (const q of freshSpare) {
      if (!takenNow.has(q.id)) {
        takenNow.add(q.id);
        return { q, recycled: false };
      }
    }
    // recycle: oldest used first, prefer matching point value
    const recyclable = cat.questions
      .filter((q) => !takenNow.has(q.id))
      .sort((a, b) => {
        const pa = a.points === p ? 0 : 1;
        const pb = b.points === p ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (usedOrder.get(a.id) ?? -1) - (usedOrder.get(b.id) ?? -1);
      });
    const q = recyclable[0] ?? cat.questions[0];
    takenNow.add(q.id);
    return { q, recycled: true };
  };

  const cells: Cell[] = [];
  ([200, 400, 600] as Points[]).forEach((p) => {
    ([0, 1] as const).forEach((slot) => {
      const { q, recycled } = pick(p);
      cells.push({
        id: `${cat.key}-${p}-${slot}`,
        catKey: cat.key,
        points: p,
        slot,
        question: q,
        used: false,
        recycled,
      });
    });
  });
  return cells;
}

export type Outcome =
  | { kind: "correct"; team: TeamIndex }
  | { kind: "none" }
  | { kind: "trap-wrong"; team?: TeamIndex };

type Action =
  | { type: "START"; gameName: string; names: string[]; catKeys: string[]; teamCount: 2 | 3 }
  | { type: "OPEN"; cellId: string }
  | { type: "START_CHARADES"; team: TeamIndex }
  | { type: "SET_CHARADES_MOVIE"; movie: string }
  | { type: "CANCEL_CHARADES" }
  | { type: "RESOLVE_CHARADES"; guessed: boolean }
  | { type: "CLOSE" }
  | { type: "ARM_HOLE"; team: TeamIndex }
  | { type: "USE_LIFELINE"; key: LifelineKey; team: TeamIndex }
  | { type: "RESOLVE"; outcome: Outcome; pointsOverride?: number }
  | { type: "ADJUST"; team: TeamIndex; delta: number }
  | { type: "SET_TURN"; team: TeamIndex }
  | { type: "END" }
  | { type: "RESET" }
  | { type: "RESET_USED" }
  | { type: "LOAD_USED_IDS"; usedIds: string[] }
  | { type: "SET_TIMER"; timerEndTimestamp?: number; callEndTimestamp?: number }
  | { type: "RESTORE_GAME"; state: GameState };

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START": {
      if (!isValidSetup(action.teamCount, action.catKeys.length)) return state;
      const cats = action.catKeys
        .map((k) => CATEGORIES.find((c) => c.key === k))
        .filter(Boolean) as Category[];
      const usedSet = new Set(state.usedIds);
      const usedOrder = new Map(state.usedIds.map((id, i) => [id, i]));
      const takenNow = new Set<string>();
      const cells = cats.flatMap((c) => buildCells(c, usedSet, usedOrder, takenNow));
      const freshIds = cells.filter((c) => !c.recycled).map((c) => c.question.id);
      const recycledIds = cells.filter((c) => c.recycled).map((c) => c.question.id);
      // recycled ids move to the end of the queue so they become "newest used"
      const usedIds = [...state.usedIds.filter((id) => !recycledIds.includes(id)), ...freshIds, ...recycledIds];
      // Clear snapshot when starting a new game
      try {
        localStorage.removeItem("seen-jeem-active-game-v1");
      } catch {
        // Silently ignore
      }
      const defaultNames =
        action.teamCount === 3
          ? ["الفريق الأول", "الفريق الثاني", "الفريق الثالث"]
          : ["الفريق الأول", "الفريق الثاني"];
      const teams = defaultNames.map((fallback, idx) => freshTeam(action.names[idx]?.trim() || fallback));
      return {
        ...initialState,
        phase: "board",
        gameName: action.gameName.trim(),
        teams,
        catKeys: cats.map((c) => c.key),
        cells,
        usedIds,
        recycledOnBoard: recycledIds.length > 0,
      };
    }
    case "ARM_HOLE": {
      if (state.teams[action.team].used.hole) return state;
      return { ...state, pendingHole: state.pendingHole === action.team ? null : action.team };
    }
    case "START_CHARADES": {
      if (state.phase !== "board" || !state.teams[action.team]) return state;
      return {
        ...state,
        phase: "question",
        charades: { team: action.team, movie: "" },
        active: null,
        pendingHole: null,
        timerEndTimestamp: undefined,
        callEndTimestamp: undefined,
      };
    }
    case "SET_CHARADES_MOVIE": {
      if (!state.charades) return state;
      return { ...state, charades: { ...state.charades, movie: action.movie } };
    }
    case "CANCEL_CHARADES":
      return {
        ...state,
        phase: "board",
        charades: null,
        active: null,
        timerEndTimestamp: undefined,
        callEndTimestamp: undefined,
      };
    case "RESOLVE_CHARADES": {
      if (!state.charades) return state;
      const teams = [...state.teams];
      const actingTeam = state.charades.team;
      if (action.guessed) {
        teams[actingTeam] = {
          ...teams[actingTeam],
          score: teams[actingTeam].score + CHARADES_POINTS,
        };
      }
      return {
        ...state,
        teams,
        phase: "board",
        charades: null,
        active: null,
        turn: nextTeamIndex(actingTeam, teams.length),
        timerEndTimestamp: undefined,
        callEndTimestamp: undefined,
      };
    }
    case "OPEN": {
      const cell = state.cells.find((c) => c.id === action.cellId);
      if (!cell || cell.used) return state;
      const holeTeam = state.pendingHole;
      const teams = [...state.teams];
      if (holeTeam !== null) {
        teams[holeTeam] = { ...teams[holeTeam], used: { ...teams[holeTeam].used, hole: true } };
      }
      return {
        ...state,
        phase: "question",
        teams,
        pendingHole: null,
        active: {
          cellId: cell.id,
          askingTeam: state.turn,
          hole: holeTeam === state.turn,
          holeTarget: holeTeam === state.turn ? nextTeamIndex(state.turn, state.teams.length) : null,
          lifelines: holeTeam !== null ? { hole: holeTeam } : {},
        },
        // A newly opened question must never inherit a previous question's timer.
        timerEndTimestamp: undefined,
        callEndTimestamp: undefined,
      };
    }
    case "USE_LIFELINE": {
      // hole must be armed before opening a question (ARM_HOLE -> OPEN). Disallow using hole while a question is open.
      if (action.key === "hole") return state;
      if (!state.active) return state;
      const t = state.teams[action.team];
      if (t.used[action.key]) return state;
      const teams = [...state.teams];
      teams[action.team] = { ...t, used: { ...t.used, [action.key]: true } };
          const newActive: ActiveQuestion = {
            ...state.active,
            lifelines: { ...state.active.lifelines, [action.key]: action.team },
          };
          // Trap transfers the answering opportunity to the opposing team, but keep askingTeam as original owner.
          if (action.key === "trap") {
            newActive.trappedTo = nextTeamIndex(action.team, state.teams.length);
          }
          return {
            ...state,
            teams,
            active: newActive,
          };
        }
    case "CLOSE":
      return { ...state, phase: "board", active: null, timerEndTimestamp: undefined, callEndTimestamp: undefined };
    case "RESOLVE": {
      if (!state.active) return state;
      const active = state.active;
      const cell = state.cells.find((c) => c.id === active.cellId);
      if (!cell) return state;
      const pts = action.pointsOverride ?? cell.points;
      const teams = [...state.teams];
      let winner: TeamIndex | null = null;

      if (action.outcome.kind === "correct") {
        winner = action.outcome.team;
        teams[winner] = { ...teams[winner], score: teams[winner].score + pts };
        if (active.hole && winner === active.askingTeam && active.holeTarget !== null) {
          teams[active.holeTarget] = { ...teams[active.holeTarget], score: teams[active.holeTarget].score - pts };
        }
      } else if (action.outcome.kind === "trap-wrong") {
        // Deduct points from the team that actually had the answering opportunity (trappedTo),
        // otherwise fall back to whatever team the action specified or the original asking team.
        const victim = action.outcome.team ?? (active.trappedTo !== undefined && active.trappedTo !== null ? active.trappedTo : active.askingTeam);
        teams[victim] = { ...teams[victim], score: teams[victim].score - pts };
      }

      const cells = state.cells.map((c) => (c.id === cell.id ? { ...c, used: true } : c));
      const allUsed = cells.every((c) => c.used);
      return {
        ...state,
        teams,
        cells,
        active: null,
        timerEndTimestamp: undefined,
        callEndTimestamp: undefined,
        turn: nextTeamIndex(active.askingTeam, teams.length),
        phase: allUsed ? "results" : "board",
              history: [...state.history, { question: cell.question, winner, points: action.outcome.kind === "trap-wrong" ? -pts : pts }],
      };
    }
    case "ADJUST": {
      const teams = [...state.teams];
      teams[action.team] = {
        ...teams[action.team],
        score: teams[action.team].score + action.delta,
      };
      return { ...state, teams };
    }
    case "SET_TURN":
      return { ...state, turn: action.team };
    case "END":
      // Clear snapshot when ending game
      try {
        localStorage.removeItem("seen-jeem-active-game-v1");
      } catch {
        // Silently ignore
      }
      return { ...state, phase: "results", active: null };
    case "RESET":
      // «العب مرة ثانية» — نحتفظ بذاكرة الأسئلة المستخدمة داخل الجلسة
      return { ...initialState, usedIds: state.usedIds };
    case "RESET_USED":
      return { ...state, usedIds: [], recycledOnBoard: false };
    case "LOAD_USED_IDS":
      return { ...state, usedIds: action.usedIds };
    case "SET_TIMER":
      return { ...state, timerEndTimestamp: action.timerEndTimestamp, callEndTimestamp: action.callEndTimestamp };
    case "RESTORE_GAME":
      return action.state;
    default:
      return state;
  }
}

export interface CategoryStat {
  total: number;
  remaining: number;
}

interface Ctx {
  state: GameState;
  dispatch: React.Dispatch<Action>;
  activeCell: Cell | null;
  remaining: number;
  usedSet: Set<string>;
  stats: Record<string, CategoryStat>;
  totalRemaining: number;
  totalQuestions: number;
}

const GameContext = createContext<Ctx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrationComplete, setHydrationComplete] = useState(false);
  
  // Load usedIds from localStorage on mount (hydration phase)
  useEffect(() => {
    const stored = localStorage.getItem("seen-jeem-used-question-ids-v1");
    if (stored) {
      try {
        const usedIds = JSON.parse(stored);
        if (Array.isArray(usedIds)) {
          dispatch({ type: "LOAD_USED_IDS", usedIds });
        }
      } catch {
        // Silently ignore malformed data
      }
    }
    // Mark hydration as complete
    setHydrationComplete(true);
  }, []);

  // Save usedIds to localStorage only AFTER hydration completes
  useEffect(() => {
    if (hydrationComplete) {
      localStorage.setItem("seen-jeem-used-question-ids-v1", JSON.stringify(state.usedIds));
    }
  }, [state.usedIds, hydrationComplete]);

  // Save game snapshot on state changes (for AirPlay/mobile resume)
  useEffect(() => {
    // Only save if we're actively in a game (not setup/results)
    if (hydrationComplete && state.phase !== "setup" && state.phase !== "results") {
      try {
        const snapshot = {
          version: 1,
          phase: state.phase,
          gameName: state.gameName,
          teams: state.teams,
          turn: state.turn,
          catKeys: state.catKeys,
          cells: state.cells,
          active: state.active,
          pendingHole: state.pendingHole,
          history: state.history,
          usedIds: state.usedIds,
          recycledOnBoard: state.recycledOnBoard,
          timerEndTimestamp: state.timerEndTimestamp,
          callEndTimestamp: state.callEndTimestamp,
          timestamp: Date.now(),
        };
        localStorage.setItem("seen-jeem-active-game-v1", JSON.stringify(snapshot));
      } catch {
        // Silently ignore if too large or other errors
      }
    }
  }, [state, hydrationComplete]);

  // Save snapshot on visibility change and pagehide
  useEffect(() => {
    const saveSnapshot = () => {
      if (state.phase !== "setup" && state.phase !== "results") {
        try {
          const snapshot = {
            version: 1,
            phase: state.phase,
            gameName: state.gameName,
            teams: state.teams,
            turn: state.turn,
            catKeys: state.catKeys,
            cells: state.cells,
            active: state.active,
            pendingHole: state.pendingHole,
            history: state.history,
            usedIds: state.usedIds,
            recycledOnBoard: state.recycledOnBoard,
            timerEndTimestamp: state.timerEndTimestamp,
            callEndTimestamp: state.callEndTimestamp,
            timestamp: Date.now(),
          };
          localStorage.setItem("seen-jeem-active-game-v1", JSON.stringify(snapshot));
        } catch {
          // Silently ignore if error
        }
      }
    };
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveSnapshot();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", saveSnapshot);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", saveSnapshot);
    };
  }, [state]);

  const value = useMemo<Ctx>(() => {
    const activeCell = state.active
      ? state.cells.find((c) => c.id === state.active!.cellId) ?? null
      : null;
    const usedSet = new Set(state.usedIds);
    const stats: Record<string, CategoryStat> = {};
    let totalRemaining = 0;
    let totalQuestions = 0;
    for (const c of CATEGORIES) {
      const remainingCount = c.questions.filter((q) => !usedSet.has(q.id)).length;
      stats[c.key] = { total: c.questions.length, remaining: remainingCount };
      totalRemaining += remainingCount;
      totalQuestions += c.questions.length;
    }
    return {
      state,
      dispatch,
      activeCell,
      remaining: state.cells.filter((c) => !c.used).length,
      usedSet,
      stats,
      totalRemaining,
      totalQuestions,
    };
  }, [state]);
  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
