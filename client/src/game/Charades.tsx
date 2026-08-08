import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Pause, Play, RotateCcw, Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOVIES } from "@/data/questions";
import { CHARADES_POINTS, CHARADES_SECONDS, useGame } from "./state";
import { CircleTimer } from "./ui";
import { cn } from "@/lib/utils";

function pick3(exclude: string[] = []): string[] {
  const pool = MOVIES.filter((m) => !exclude.includes(m));
  const out: string[] = [];
  while (out.length < 3 && pool.length) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

export default function Charades() {
  const { state, dispatch } = useGame();
  const round = state.charades;
  const [suggestions, setSuggestions] = useState<string[]>(() => pick3());
  const [custom, setCustom] = useState("");
  const [step, setStep] = useState<"pick" | "act">("pick");
  const [shown, setShown] = useState(false);
  const [seconds, setSeconds] = useState(CHARADES_SECONDS);
  const [running, setRunning] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!running || seconds <= 0) return;
    const id = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, seconds]);

  if (!round) return null;
  const actingTeam = state.teams[round.team];
  const pickingTeam = state.teams[round.team === 0 ? 1 : 0];
  const movie = round.movie;

  const choose = (name: string) => {
    const v = name.trim();
    if (!v) return;
    dispatch({ type: "SET_CHARADES_MOVIE", movie: v });
    setStep("act");
    if (!startedRef.current) {
      startedRef.current = true;
      setRunning(true);
    }
  };

  const timerTone = seconds <= 10 ? "danger" : "primary";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col justify-center px-4 pb-10 pt-4 lg:min-h-[100dvh] lg:pb-4 2xl:max-w-[1500px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="rounded-full border-2 font-bold 2xl:h-12 2xl:text-lg"
          data-testid="button-charades-cancel"
          onClick={() => dispatch({ type: "CANCEL_CHARADES" })}
        >
          <ArrowRight className="ml-1 h-4 w-4" /> رجوع للوحة (بدون استخدام)
        </Button>
        <span className="rounded-full border-2 border-card-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground 2xl:text-lg">
          يمثّل: {actingTeam.name}
        </span>
      </div>

      <div className="sj-pop overflow-hidden rounded-3xl border-2 border-card-border bg-card sj-shadow-lg">
        <div className="flex items-center justify-between gap-2 bg-secondary px-4 py-3 text-secondary-foreground 2xl:px-8 2xl:py-5">
          <span className="flex items-center gap-2 text-base font-extrabold 2xl:text-3xl">
            <span aria-hidden className="text-2xl 2xl:text-4xl">
              🎬
            </span>
            بدون كلام — تمثيل صامت
          </span>
          <span
            className="sj-tick rounded-full bg-primary px-3 py-1 text-base font-black text-primary-foreground 2xl:px-5 2xl:text-3xl"
            data-testid="text-charades-points"
          >
            {CHARADES_POINTS}
          </span>
        </div>

        <div className="px-4 py-6 sm:px-8 2xl:px-14 2xl:py-10">
          {step === "pick" ? (
            <div className="space-y-5">
              <p
                className="text-center text-lg font-extrabold leading-relaxed text-secondary dark:text-foreground 2xl:text-4xl"
                data-testid="text-charades-instructions"
              >
                {pickingTeam.name} يختارون اسم فيلم أو مسلسل — و{actingTeam.name} يمثّلونه بدون كلام
                في ٦٠ ثانية.
              </p>
              <p className="text-center text-sm font-bold text-muted-foreground 2xl:text-2xl">
                اختاروا من الاقتراحات أو اكتبوا اسمًا من عندكم:
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    data-testid={`button-suggestion-${s}`}
                    onClick={() => choose(s)}
                    className="sj-press rounded-2xl border-2 border-card-border bg-muted px-3 py-4 text-base font-black text-secondary hover:border-primary dark:text-foreground 2xl:py-8 2xl:text-3xl"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  data-testid="button-more-suggestions"
                  onClick={() => setSuggestions(pick3(suggestions))}
                  className="rounded-full border-2 font-bold 2xl:h-14 2xl:text-xl"
                >
                  <Shuffle className="ml-1 h-4 w-4" /> اقتراحات تانية
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  data-testid="input-custom-movie"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && choose(custom)}
                  placeholder="اكتبوا اسم فيلم أو مسلسل…"
                  className="rounded-xl border-2 text-right 2xl:h-16 2xl:text-2xl"
                />
                <Button
                  data-testid="button-use-custom-movie"
                  disabled={!custom.trim()}
                  onClick={() => choose(custom)}
                  className="rounded-xl border-2 border-primary-border font-black 2xl:h-16 2xl:px-8 2xl:text-2xl"
                >
                  استخدموا هذا الاسم
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <p className="mb-2 text-sm font-bold text-muted-foreground 2xl:text-2xl">
                  الاسم المطلوب تمثيله (يشوفه المُمثّل فقط)
                </p>
                <button
                  type="button"
                  data-testid="button-toggle-movie"
                  onClick={() => setShown((s) => !s)}
                  className={cn(
                    "sj-press mx-auto flex items-center gap-3 rounded-2xl border-2 px-6 py-4 text-2xl font-black 2xl:px-12 2xl:py-8 2xl:text-6xl",
                    shown
                      ? "border-primary bg-primary/10 text-secondary dark:text-foreground"
                      : "border-dashed border-border bg-muted text-muted-foreground",
                  )}
                >
                  {shown ? (
                    <>
                      <EyeOff className="h-6 w-6 2xl:h-10 2xl:w-10" />
                      <span data-testid="text-charades-movie">{movie}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-6 w-6 2xl:h-10 2xl:w-10" /> اضغط لإظهار الاسم 🙈
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-col items-center gap-3">
                <CircleTimer
                  seconds={seconds}
                  total={CHARADES_SECONDS}
                  label={`٦٠ ثانية تمثيل — ${actingTeam.name}`}
                  tone={timerTone}
                />
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full border-2 font-bold 2xl:h-14 2xl:text-xl"
                    data-testid="button-charades-toggle-timer"
                    onClick={() => setRunning((r) => !r)}
                    disabled={seconds === 0}
                  >
                    {running ? <Pause className="ml-1 h-4 w-4" /> : <Play className="ml-1 h-4 w-4" />}
                    {running ? "إيقاف مؤقت" : "استمرار"}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full border-2 font-bold 2xl:h-14 2xl:text-xl"
                    data-testid="button-charades-reset-timer"
                    onClick={() => {
                      setSeconds(CHARADES_SECONDS);
                      setRunning(true);
                    }}
                  >
                    <RotateCcw className="ml-1 h-4 w-4" /> إعادة الوقت
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full border-2 font-bold 2xl:h-14 2xl:text-xl"
                    data-testid="button-charades-change-movie"
                    onClick={() => setStep("pick")}
                  >
                    <Shuffle className="ml-1 h-4 w-4" /> تغيير الاسم
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {step === "act" && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button
            data-testid="button-charades-correct"
            onClick={() => dispatch({ type: "RESOLVE_CHARADES", guessed: true })}
            className="sj-press h-16 rounded-2xl border-2 border-emerald-700 bg-emerald-600 text-base font-black text-white hover:bg-emerald-600/90 2xl:h-24 2xl:text-3xl"
          >
            خمّنوها صح +{CHARADES_POINTS}
          </Button>
          <Button
            variant="outline"
            data-testid="button-charades-failed"
            onClick={() => dispatch({ type: "RESOLVE_CHARADES", guessed: false })}
            className="sj-press h-16 rounded-2xl border-2 text-base font-black 2xl:h-24 2xl:text-3xl"
          >
            <X className="ml-1 h-5 w-5" /> معرفوش
          </Button>
        </div>
      )}
    </div>
  );
}
