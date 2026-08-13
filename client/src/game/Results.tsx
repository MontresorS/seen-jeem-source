import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Trophy, RotateCcw, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGame } from "./state";
import { Logo } from "./ui";
import { cn } from "@/lib/utils";

export default function Results() {
  const { state, dispatch, totalRemaining, totalQuestions } = useGame();
  const sortedTeams = [...state.teams].sort((a, b) => b.score - a.score);
  const topScore = sortedTeams[0]?.score ?? 0;
  const winners = state.teams.filter((team) => team.score === topScore);
  const tie = winners.length !== 1;
  const winner = tie ? null : winners[0];
  const answered = state.history.filter((h) => h.winner !== null).length;

  useEffect(() => {
    if (tie) return;
    const colors = ["#F97316", "#FBBF24", "#152238", "#FFF7ED"];
    const shots = [0, 260, 520];
    const timers = shots.map((d) =>
      window.setTimeout(
        () =>
          confetti({
            particleCount: 90,
            spread: 78,
            origin: { y: 0.6 },
            colors,
            disableForReducedMotion: true,
          }),
        d,
      ),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [tie]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 text-center sm:pt-10">
      <header className="mb-8 flex justify-center">
        <Logo />
      </header>

      <div className="sj-pop rounded-3xl border-2 border-card-border bg-card p-6 sj-shadow-lg sm:p-10">
        {tie ? (
          <>
            <Handshake className="sj-float mx-auto mb-3 h-16 w-16 text-primary" />
            <h1 className="text-xl font-black text-secondary dark:text-foreground sm:text-2xl">
              تعادل! 🤝
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              الفريقان تساويا بنفس عدد النقاط — جولة فاصلة؟
            </p>
          </>
        ) : (
          <>
            <Trophy className="sj-float mx-auto mb-3 h-16 w-16 text-primary" />
            <p className="text-sm font-bold text-muted-foreground">الفريق الفائز</p>
            <h1
              data-testid="text-winner"
              className="mt-1 break-words text-2xl font-black text-primary sm:text-3xl"
            >
              {winner!.name} 🎉
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              بمجموع {winner!.score} نقطة — مبروك!
            </p>
          </>
        )}

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {state.teams.map((t, i) => (
            <div
              key={i}
              data-testid={`card-result-${i + 1}`}
              className={cn(
                "rounded-2xl border-2 p-4",
                !tie && winner === t
                  ? "border-primary bg-primary/12"
                  : "border-card-border bg-muted/50",
              )}
            >
                        <p className="truncate text-sm font-extrabold" style={{ color: "#3E2723" }}>
            {t.name}
              </p>
              <p className="sj-tick mt-1 text-3xl font-black text-primary">{t.score}</p>
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">نقطة</p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs font-semibold text-muted-foreground 2xl:text-lg" data-testid="text-summary">
          تم لعب {state.history.length} سؤال، أُجيب منها {answered} بشكل صحيح.
        </p>
        <p
          className="mt-1 text-xs font-semibold text-muted-foreground 2xl:text-lg"
          data-testid="text-remaining-bank"
        >
          ♻ اللعبة الجديدة بأسئلة مختلفة — متبقي في البنك {totalRemaining} من {totalQuestions} سؤال.
        </p>

        <Button
          data-testid="button-play-again"
          onClick={() => dispatch({ type: "RESET" })}
          className="sj-press mt-7 h-14 w-full rounded-2xl border-2 border-primary-border text-base font-black sj-shadow sm:text-lg 2xl:h-20 2xl:text-3xl"
        >
          <RotateCcw className="ml-1 h-5 w-5" /> العب مرة ثانية
        </Button>
      </div>
    </div>
  );
}
