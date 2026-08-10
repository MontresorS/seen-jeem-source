import { createContext, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { CATEGORIES, type Category, type Question } from "@/data/questions";

export type TeamIndex = 0 | 1;
export type Points = 200 | 400 | 600;
export type LifelineKey = "phone" | "hole" | "double" | "trap" | "rest";

export const CHARADES_POINTS = 600;
export const CHARADES_MAX_USES = 2;
export const CHARADES_SECONDS = 60;

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
  charadesUsed: number;
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
  lifelines: Partial<Record<LifelineKey, TeamIndex>>;
}

export interface CharadesRound {
  team: TeamIndex;
  movie: string;
}

export interface GameState {
  phase: "setup" | "board" | "question" | "charades" | "results";
  gameName: string;
  teams: [Team, Team];
  turn: TeamIndex;
  catKeys: string[];
  cells: Cell[];
  active: ActiveQuestion | null;
  pendingHole: TeamIndex | null;
  history: { question: Question; winner: TeamIndex | null; points: number }[];
  charades: CharadesRound | null;
  /** أسئلة استُخدمت في هذه الجلسة (تبقى بعد «العب مرة ثانية») — الأقدم أولاً */
  usedIds: string[];
  /** true إذا اضطررنا لإعادة استخدام أسئلة قديمة في اللوحة الحالية */
  recycledOnBoard: boolean;
}

const freshTeam = (name: string): Team => ({
  name,
  score: 0,
  used: { phone: false, hole: false, double: false, trap: false, rest: false },
  charadesUsed: 0,
});

const initialState: GameState = {
  phase: "setup",
  gameName: "",
  teams: [freshTeam("الفريق الأول"), freshTeam("الفريق الثاني")],
  turn: 0,
  catKeys: [],
  cells: [],
  active: null,
  pendingHole: null,
  history: [],
  charades: null,
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
  | { type: "START"; gameName: string; names: [string, string]; catKeys: string[] }
  | { type: "OPEN"; cellId: string }
  | { type: "CLOSE" }
  | { type: "ARM_HOLE"; team: TeamIndex }
  | { type: "USE_LIFELINE"; key: LifelineKey; team: TeamIndex }
  | { type: "RESOLVE"; outcome: Outcome; pointsOverride?: number }
  | { type: "ADJUST"; team: TeamIndex; delta: number }
  | { type: "SET_TURN"; team: TeamIndex }
  | { type: "OPEN_CHARADES" }
  | { type: "SET_CHARADES_MOVIE"; movie: string }
  | { type: "CANCEL_CHARADES" }
  | { type: "RESOLVE_CHARADES"; guessed: boolean }
  | { type: "END" }
  | { type: "RESET" }
  | { type: "RESET_USED" }
  | { type: "LOAD_USED_IDS"; usedIds: string[] }
  | { type: "RESTORE_GAME"; state: GameState };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "START": {
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
      return {
        ...initialState,
        phase: "board",
        gameName: action.gameName.trim(),
        teams: [
          freshTeam(action.names[0].trim() || "الفريق الأول"),
          freshTeam(action.names[1].trim() || "الفريق الثاني"),
        ],
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
    case "OPEN": {
      const cell = state.cells.find((c) => c.id === action.cellId);
      if (!cell || cell.used) return state;
      const holeTeam = state.pendingHole;
      const teams = [...state.teams] as [Team, Team];
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
          lifelines: holeTeam !== null ? { hole: holeTeam } : {},
        },
      };
    }
    case "USE_LIFELINE": {
      // hole must be armed before opening a question (ARM_HOLE -> OPEN). Disallow using hole while a question is open.
      if (action.key === "hole") return state;
      if (!state.active) return state;
      const t = state.teams[action.team];
      if (t.used[action.key]) return state;
      const teams = [...state.teams] as [Team, Team];
      teams[action.team] = { ...t, used: { ...t.used, [action.key]: true } };
          const newActive: ActiveQuestion = {
            ...state.active,
            lifelines: { ...state.active.lifelines, [action.key]: action.team },
          };
          // Trap transfers the answering opportunity to the opposing team, but keep askingTeam as original owner.
          if (action.key === "trap") {
            newActive.trappedTo = action.team === 0 ? 1 : 0;
          }
          return {
            ...state,
            teams,
            active: newActive,
          };
        }
    case "CLOSE":
      return { ...state, phase: "board", active: null };
    case "RESOLVE": {
      if (!state.active) return state;
      const active = state.active;
      const cell = state.cells.find((c) => c.id === active.cellId);
      if (!cell) return state;
      const pts = action.pointsOverride ?? cell.points;
      const teams = [state.teams[0], state.teams[1]] as [Team, Team];
      const other = (t: TeamIndex): TeamIndex => (t === 0 ? 1 : 0);
      let winner: TeamIndex | null = null;

      if (action.outcome.kind === "correct") {
        winner = action.outcome.team;
        teams[winner] = { ...teams[winner], score: teams[winner].score + pts };
        if (active.hole && winner === active.askingTeam) {
          const o = other(winner);
          teams[o] = { ...teams[o], score: teams[o].score - pts };
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
        turn: other(active.askingTeam),
        phase: allUsed ? "results" : "board",
              history: [...state.history, { question: cell.question, winner, points: action.outcome.kind === "trap-wrong" ? -pts : pts }],
      };
    }
    case "OPEN_CHARADES": {
      if (state.teams[state.turn].charadesUsed >= CHARADES_MAX_USES) return state;
      return {
        ...state,
        phase: "charades",
        pendingHole: null,
        charades: { team: state.turn, movie: "" },
      };
    }
    case "SET_CHARADES_MOVIE":
      return state.charades
        ? { ...state, charades: { ...state.charades, movie: action.movie } }
        : state;
    case "CANCEL_CHARADES":
      return { ...state, phase: "board", charades: null };
    case "RESOLVE_CHARADES": {
      if (!state.charades) return state;
      const team = state.charades.team;
      const teams = [state.teams[0], state.teams[1]] as [Team, Team];
      teams[team] = {
        ...teams[team],
        charadesUsed: teams[team].charadesUsed + 1,
        score: teams[team].score + (action.guessed ? CHARADES_POINTS : 0),
      };
      return {
        ...state,
        teams,
        charades: null,
        phase: "board",
        turn: team === 0 ? 1 : 0,
      };
    }
    case "ADJUST": {
      const teams = [state.teams[0], state.teams[1]] as [Team, Team];
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
      return { ...state, phase: "results", active: null, charades: null };
    case "RESET":
      // «العب مرة ثانية» — نحتفظ بذاكرة الأسئلة المستخدمة داخل الجلسة
      return { ...initialState, usedIds: state.usedIds };
    case "RESET_USED":
      return { ...state, usedIds: [], recycledOnBoard: false };
    case "LOAD_USED_IDS":
      return { ...state, usedIds: action.usedIds };
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
          charades: state.charades,
          usedIds: state.usedIds,
          recycledOnBoard: state.recycledOnBoard,
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
            charades: state.charades,
            usedIds: state.usedIds,
            recycledOnBoard: state.recycledOnBoard,
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
