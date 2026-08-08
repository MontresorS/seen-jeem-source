import { Minus, Plus, Flag, Recycle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CATEGORY_BY_KEY } from "@/data/questions";
import {
  CHARADES_MAX_USES,
  CHARADES_POINTS,
  LIFELINES,
  useGame,
  type TeamIndex,
} from "./state";
import { HelpDialog, LifelineChip, Logo } from "./ui";
import { cn } from "@/lib/utils";

function TeamPanel({ index }: { index: TeamIndex }) {
  const { state, dispatch } = useGame();
  const team = state.teams[index];
  const isTurn = state.turn === index;
  const charadesLeft = CHARADES_MAX_USES - team.charadesUsed;
  return (
    <div
      data-testid={`panel-team-${index + 1}`}
      className={cn(
        "flex-1 rounded-2xl border-2 px-3 py-2 transition-colors 2xl:px-5 2xl:py-3",
        isTurn
          ? "border-primary bg-primary/12 sj-shadow"
          : "border-card-border bg-card opacity-90",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => dispatch({ type: "SET_TURN", team: index })}
          data-testid={`button-set-turn-${index + 1}`}
          className="min-w-0 text-right"
          title="اجعل الدور على هذا الفريق"
        >
          <p className="truncate text-base font-extrabold text-secondary dark:text-foreground sm:text-lg 2xl:text-3xl">
            {team.name}
          </p>
          <p className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground 2xl:text-lg">
            {isTurn && <span className="text-primary">الدور عليه الآن •</span>}
            <span data-testid={`text-charades-left-${index + 1}`}>
              🎬 ×{charadesLeft}
            </span>
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1 2xl:gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-full border-2 2xl:h-11 2xl:w-11"
            aria-label="خصم ١٠٠"
            data-testid={`button-minus-${index + 1}`}
            onClick={() => dispatch({ type: "ADJUST", team: index, delta: -100 })}
          >
            <Minus className="h-3.5 w-3.5 2xl:h-6 2xl:w-6" />
          </Button>
          <span
            data-testid={`text-score-${index + 1}`}
            className="sj-tick min-w-[3.5rem] rounded-lg bg-secondary px-2 py-0.5 text-center text-xl font-black text-secondary-foreground sm:text-2xl 2xl:min-w-[7rem] 2xl:rounded-2xl 2xl:text-5xl"
          >
            {team.score}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-full border-2 2xl:h-11 2xl:w-11"
            aria-label="إضافة ١٠٠"
            data-testid={`button-plus-${index + 1}`}
            onClick={() => dispatch({ type: "ADJUST", team: index, delta: 100 })}
          >
            <Plus className="h-3.5 w-3.5 2xl:h-6 2xl:w-6" />
          </Button>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {LIFELINES.map((l) => (
          <LifelineChip
            key={l.key}
            meta={l}
            compact
            used={team.used[l.key]}
            armed={l.key === "hole" && state.pendingHole === index}
            disabled={l.key !== "hole" || !isTurn}
            onClick={
              l.key === "hole" && isTurn
                ? () => dispatch({ type: "ARM_HOLE", team: index })
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

export default function Board() {
  const { state, dispatch, remaining } = useGame();
  const holeArmedBy = state.pendingHole;
  const turnTeam = state.teams[state.turn];
  const charadesLeft = CHARADES_MAX_USES - turnTeam.charadesUsed;

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-2 px-3 pb-8 pt-3 sm:px-4 lg:h-[100dvh] lg:overflow-hidden lg:pb-3 2xl:gap-3 2xl:px-6">
      {/* top bar — always visible */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <Logo />
        {state.gameName && (
          <p
            className="text-center text-sm font-extrabold text-primary 2xl:text-2xl"
            data-testid="text-game-name"
          >
            {state.gameName}
          </p>
        )}
        <div className="flex items-center gap-2">
          {state.recycledOnBoard && (
            <span
              data-testid="text-recycled-note"
              className="flex items-center gap-1 rounded-full border-2 border-amber-500 bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100 2xl:text-base"
            >
              <Recycle className="h-3.5 w-3.5" /> بعض الأسئلة معادة (♻) — خلص بنك الفئة
            </span>
          )}
          <span
            className="rounded-full border-2 border-card-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground 2xl:text-lg"
            data-testid="text-remaining"
          >
            باقي {remaining} سؤال
          </span>
          <HelpDialog />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="rounded-full border-2 font-bold 2xl:h-12 2xl:text-lg"
                data-testid="button-end-game"
              >
                <Flag className="ml-1 h-4 w-4" /> إنهاء اللعبة
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl" className="text-right">
              <AlertDialogHeader>
                <AlertDialogTitle>إنهاء اللعبة الآن؟</AlertDialogTitle>
                <AlertDialogDescription>
                  راح نعرض النتيجة النهائية والفريق الفائز.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:justify-start">
                <AlertDialogAction
                  data-testid="button-confirm-end"
                  onClick={() => dispatch({ type: "END" })}
                >
                  نعم، أنهِ اللعبة
                </AlertDialogAction>
                <AlertDialogCancel className="mt-0">رجوع</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      {/* scores + turn banner + بدون كلام */}
      <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-stretch">
        <TeamPanel index={0} />
        <div className="flex flex-col gap-2 lg:w-[22%] lg:shrink-0">
          <div
            className={cn(
              "flex flex-1 items-center justify-center rounded-2xl border-2 px-3 py-2 text-center text-sm font-extrabold 2xl:text-2xl",
              holeArmedBy !== null
                ? "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
                : "border-secondary/15 bg-secondary text-secondary-foreground",
            )}
            data-testid="text-turn-banner"
          >
            {holeArmedBy !== null ? (
              <>🕳️ الحفرة مفعّلة لـ{state.teams[holeArmedBy].name} — افتحوا السؤال!</>
            ) : (
              <>الدور على: {turnTeam.name}</>
            )}
          </div>
          <button
            type="button"
            data-testid="button-charades"
            disabled={charadesLeft <= 0}
            onClick={() => dispatch({ type: "OPEN_CHARADES" })}
            className={cn(
              "sj-press flex items-center justify-center gap-2 rounded-2xl border-2 px-3 py-2 text-sm font-black 2xl:py-4 2xl:text-2xl",
              charadesLeft > 0
                ? "border-accent-border bg-accent text-accent-foreground sj-shadow"
                : "cursor-not-allowed border-dashed border-border bg-muted text-muted-foreground/60",
            )}
          >
            🎬 بدون كلام — {CHARADES_POINTS} نقطة
            <span className="rounded-full bg-secondary/15 px-2 text-xs font-black 2xl:text-lg">
              ×{charadesLeft}
            </span>
          </button>
        </div>
        <TeamPanel index={1} />
      </div>

      {/* board — 6 columns across, fits the TV without scrolling */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6 2xl:gap-4">
        {state.catKeys.map((key) => {
          const cat = CATEGORY_BY_KEY[key];
          const cells = state.cells.filter((c) => c.catKey === key);
          return (
            <section
              key={key}
              data-testid={`column-category-${key}`}
              className="flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-card-border bg-card sj-shadow"
            >
              <div className="flex shrink-0 items-center gap-2 bg-secondary px-3 py-2 text-secondary-foreground 2xl:py-3">
                <span aria-hidden className="text-2xl leading-none 2xl:text-4xl">
                  {cat.emoji}
                </span>
                <h3 className="text-sm font-extrabold leading-tight 2xl:text-2xl">{cat.name}</h3>
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 gap-2 p-2 2xl:gap-3 2xl:p-3">
                {cells.map((cell) => (
                  <button
                    key={cell.id}
                    type="button"
                    data-testid={`button-cell-${cell.id}`}
                    disabled={cell.used}
                    onClick={() => dispatch({ type: "OPEN", cellId: cell.id })}
                    className={cn(
                      "sj-press sj-tick relative flex h-14 items-center justify-center rounded-xl border-2 text-xl font-black sm:text-2xl lg:h-auto lg:min-h-[3rem] 2xl:rounded-2xl 2xl:text-5xl",
                      cell.used
                        ? "cursor-not-allowed border-dashed border-border bg-muted text-muted-foreground/60"
                        : cell.points === 600
                          ? "border-primary-border bg-primary text-primary-foreground"
                          : cell.points === 400
                            ? "border-amber-500/70 bg-accent text-accent-foreground"
                            : "border-card-border bg-muted text-secondary dark:text-foreground",
                    )}
                  >
                    {cell.used ? "✓" : cell.points}
                    {!cell.used && cell.recycled && (
                      <span
                        title="سؤال معاد من جلسة سابقة"
                        className="absolute left-1 top-1 text-[10px] font-black opacity-70 2xl:text-base"
                      >
                        ♻
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
