import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, Pause, Play, RotateCcw, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_BY_KEY } from "@/data/questions";
import { LIFELINES, useGame, type LifelineKey, type Outcome } from "./state";
import { CircleTimer, LifelineChip, LifelineIcon } from "./ui";
import { cn } from "@/lib/utils";

const MAIN = 60;
const SECOND = 10;
const CALL = 30;
const MAX_AUDIO_PLAYS = 2; // تشغيلة أولى + إعادة واحدة فقط
const WADDA7_STEPS = [600, 400, 200] as const;

/** hash ثابت من نص — لتوليد عشوائية ثابتة لكل سؤال */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const LOGO_MASKS: { left: number; top: number; w: number; h: number }[][] = [
  [
    { left: 0, top: 0, w: 58, h: 58 },
    { left: 55, top: 55, w: 45, h: 45 },
  ],
  [
    { left: 45, top: 0, w: 55, h: 62 },
    { left: 0, top: 58, w: 52, h: 42 },
  ],
  [
    { left: 18, top: 0, w: 62, h: 48 },
    { left: 0, top: 55, w: 48, h: 45 },
  ],
  [
    { left: 0, top: 22, w: 52, h: 56 },
    { left: 58, top: 0, w: 42, h: 48 },
  ],
];

export default function QuestionView() {
  const { state, dispatch, activeCell } = useGame();
  const active = state.active;
  const [revealed, setRevealed] = useState(false);
  const [stage, setStage] = useState<"main" | "second" | "over">("main");
  const [seconds, setSeconds] = useState(MAIN);
  const [running, setRunning] = useState(true);
  const [call, setCall] = useState<number | null>(null);
  const [plays, setPlays] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [clarify, setClarify] = useState(0); // وضح شوية: 0→600، 1→400، 2→200
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!running || revealed) return;
    const id = window.setInterval(() => {
      if (call !== null) {
        setCall((c) => {
          if (c === null) return c;
          if (c <= 1) return null;
          return c - 1;
        });
        return;
      }
      setSeconds((s) => {
        if (s > 1) return s - 1;
        if (stageRef.current === "main") {
          setStage("second");
          return SECOND;
        }
        setStage("over");
        setRunning(false);
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, revealed, call]);

  if (!active || !activeCell) return null;
  const cat = CATEGORY_BY_KEY[activeCell.catKey];
  const asking = state.teams[active.askingTeam];
  const otherIdx = active.askingTeam === 0 ? 1 : 0;
  const other = state.teams[otherIdx];
  const usedLifelines = Object.keys(active.lifelines) as LifelineKey[];
  const catKey = activeCell.catKey;
  const isReversed = catKey === "reversed";
  const isWadda7 = catKey === "wadda7";
  const isZoom = catKey === "zoom";
  const isLogos = catKey === "logos";
  const isFirstLetter = catKey === "firstletter";
  const isMoving = catKey === "moving";
  const hasImage = Boolean(activeCell.question.image);
  const qhash = hashStr(activeCell.question.id);

  // قيمة السؤال الفعلية (وضح شوية تقل مع كل توضيح)
  const effectivePoints = isWadda7 ? WADDA7_STEPS[clarify] : activeCell.points;
  const resolve = (outcome: Outcome) =>
    dispatch({ type: "RESOLVE", outcome, pointsOverride: isWadda7 ? effectivePoints : undefined });

  // زوم: مقدار التقريب حسب النقاط + نقطة ارتكاز ثابتة لكل سؤال
  const zoomScale = activeCell.points === 200 ? 4 : activeCell.points === 400 ? 6 : 8;
  const zoomOrigin = `${25 + (qhash % 50)}% ${25 + ((qhash >> 3) % 50)}%`;
  const logoMask = LOGO_MASKS[qhash % LOGO_MASKS.length];
  const movingLetters = isMoving
    ? activeCell.question.a.replace(/\s+/g, "").split("")
    : [];

  const playAudio = () => {
    if (plays >= MAX_AUDIO_PLAYS || playing) return;
    if (!audioRef.current) {
      const el = new Audio(`./audio/reversed/${activeCell.question.id}.mp3`);
      el.onended = () => setPlaying(false);
      el.onerror = () => setPlaying(false);
      audioRef.current = el;
    }
    setPlaying(true);
    setPlays((p) => p + 1);
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => setPlaying(false));
  };

  const total = call !== null ? CALL : stage === "main" ? MAIN : SECOND;
  const shown = call !== null ? call : seconds;
  const label =
    call !== null
      ? `مكالمة صديق — ${asking.name}`
      : stage === "main"
        ? `دقيقة كاملة لـ${asking.name}`
        : stage === "second"
          ? `١٠ ثواني لـ${other.name}`
          : "انتهى الوقت!";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col justify-center px-4 pb-10 pt-4 sm:pt-6 lg:min-h-[100dvh] lg:pb-4 lg:pt-4 2xl:max-w-[1560px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          variant="outline"
          className="rounded-full border-2 font-bold 2xl:h-12 2xl:text-lg"
          data-testid="button-back-to-board"
          onClick={() => dispatch({ type: "CLOSE" })}
        >
          <ArrowRight className="ml-1 h-4 w-4" /> تخطي / رجوع للوحة
        </Button>
        <span className="rounded-full border-2 border-card-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground 2xl:text-xl">
          الدور على: {asking.name}
        </span>
      </div>

      <div className="sj-pop overflow-hidden rounded-3xl border-2 border-card-border bg-card sj-shadow-lg">
        <div className="flex items-center justify-between gap-2 bg-secondary px-4 py-3 text-secondary-foreground">
          <span className="flex items-center gap-2 text-sm font-extrabold sm:text-base 2xl:text-3xl">
            <span aria-hidden className="text-xl 2xl:text-4xl">
              {cat.emoji}
            </span>
            {cat.name}
          </span>
          <span
            className="sj-tick rounded-full bg-primary px-3 py-1 text-base font-black text-primary-foreground 2xl:px-5 2xl:text-3xl"
            data-testid="text-points"
          >
            {effectivePoints}
          </span>
        </div>

        <div className="px-4 py-6 sm:px-8 sm:py-8 2xl:px-14 2xl:py-10">
          {isReversed ? (
            <div className="flex flex-col items-center gap-3" data-testid="block-reversed-audio">
              <p
                dir="rtl"
                className="break-words text-center text-2xl font-extrabold leading-relaxed text-secondary dark:text-foreground sm:text-3xl 2xl:text-5xl"
              >
                🎧 اسمعوا كويس… وخمّنوا الكلمة!
              </p>
              <p className="text-center text-sm font-bold text-muted-foreground 2xl:text-2xl">
                الحروف منطوقة حرف حرف بالعكس — رتّبوها في دماغكوم
              </p>
              <Button
                data-testid="button-play-audio"
                onClick={playAudio}
                disabled={plays >= MAX_AUDIO_PLAYS || playing}
                className="sj-press h-16 rounded-full border-2 border-primary-border px-8 text-lg font-black sj-shadow 2xl:h-24 2xl:px-14 2xl:text-3xl"
              >
                <Volume2 className="ml-2 h-6 w-6 2xl:h-9 2xl:w-9" />
                {playing ? "بيشتغل…" : plays === 0 ? "شغّل الصوت" : "إعادة الصوت"}
              </Button>
              <p className="text-xs font-extrabold text-muted-foreground 2xl:text-xl" data-testid="text-plays-left">
                {plays >= MAX_AUDIO_PLAYS
                  ? "خلصت الإعادة!"
                  : plays === 0
                    ? "تشغيلة واحدة + إعادة واحدة بس"
                    : "متبقي إعادة واحدة"}
              </p>
            </div>
          ) : (
            <p
              data-testid="text-question"
              dir="rtl"
              className={cn(
                "break-words text-center font-extrabold leading-relaxed text-secondary dark:text-foreground",
                hasImage ? "text-xl sm:text-2xl 2xl:text-4xl" : "text-2xl sm:text-3xl 2xl:text-6xl",
              )}
            >
              {activeCell.question.q}
            </p>
          )}

          {isFirstLetter && (
            <div className="mt-4 flex items-center justify-center gap-2" data-testid="block-first-letter">
              <span className="text-sm font-bold text-muted-foreground 2xl:text-2xl">أول حرف من الإجابة:</span>
              <span className="sj-pop flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-primary bg-primary/10 text-4xl font-black text-primary 2xl:h-24 2xl:w-24 2xl:text-6xl">
                {activeCell.question.letter}
              </span>
            </div>
          )}

          {isMoving && (
            <div
              className="relative mx-auto mt-4 h-44 w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-dashed border-card-border bg-muted/50 2xl:h-64"
              data-testid="block-moving-letters"
            >
              {movingLetters.map((ch, i) => {
                const h = hashStr(`${activeCell.question.id}-${i}`);
                const left = 8 + (h % 78);
                const top = 10 + ((h >> 4) % 62);
                const dur = 2.6 + ((h >> 8) % 26) / 10;
                const delay = -((h >> 5) % 30) / 10;
                return (
                  <span
                    key={i}
                    className="sj-drift absolute text-4xl font-black text-secondary dark:text-foreground 2xl:text-6xl"
                    style={{ left: `${left}%`, top: `${top}%`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          )}

          {hasImage && (isWadda7 || isZoom) && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="overflow-hidden rounded-2xl border-4 border-card-border bg-muted sj-shadow">
                <img
                  src={activeCell.question.image}
                  alt="صورة السؤال"
                  loading="eager"
                  data-testid="img-question"
                  className="h-auto max-h-[34vh] w-auto max-w-[340px] object-contain transition-all duration-700 ease-out sm:max-w-[440px] lg:max-h-[38vh] 2xl:max-w-[620px]"
                  style={
                    isWadda7
                      ? { filter: revealed ? "blur(0)" : `blur(${[26, 12, 5][clarify]}px)` }
                      : {
                          transform: revealed ? "scale(1)" : `scale(${zoomScale})`,
                          transformOrigin: zoomOrigin,
                        }
                  }
                />
              </div>
              {isWadda7 && !revealed && (
                <Button
                  variant="outline"
                  data-testid="button-clarify"
                  disabled={clarify >= WADDA7_STEPS.length - 1}
                  onClick={() => setClarify((c) => Math.min(c + 1, WADDA7_STEPS.length - 1))}
                  className="sj-press rounded-full border-2 border-primary font-black text-primary 2xl:h-14 2xl:px-8 2xl:text-2xl"
                >
                  🌫️ وضّح شوية — تنزل لـ{clarify === 0 ? "٤٠٠" : "٢٠٠"}
                  <span className="mr-2 rounded-full bg-primary/10 px-2 text-xs font-black 2xl:text-lg">
                    ×{WADDA7_STEPS.length - 1 - clarify}
                  </span>
                </Button>
              )}
            </div>
          )}

          {hasImage && isLogos && (
            <div className="mt-4 flex justify-center">
              <div className="relative flex h-56 w-72 items-center justify-center overflow-hidden rounded-2xl border-4 border-card-border bg-white p-6 sj-shadow sm:h-64 sm:w-80 2xl:h-96 2xl:w-[30rem]">
                <img
                  src={activeCell.question.image}
                  alt="شعار"
                  loading="eager"
                  data-testid="img-question"
                  className="h-full w-full object-contain"
                />
                {!revealed &&
                  logoMask.map((m, i) => (
                    <div
                      key={i}
                      className="absolute flex items-center justify-center rounded-xl bg-secondary text-3xl font-black text-secondary-foreground 2xl:text-5xl"
                      style={{ left: `${m.left}%`, top: `${m.top}%`, width: `${m.w}%`, height: `${m.h}%` }}
                    >
                      ؟
                    </div>
                  ))}
              </div>
            </div>
          )}

          {hasImage && !isWadda7 && !isZoom && !isLogos && (
            <div className="mt-4 flex justify-center">
              <img
                src={activeCell.question.image}
                alt="صورة السؤال"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                loading="eager"
                data-testid="img-question"
                className="h-auto max-h-[30vh] w-auto max-w-[300px] rounded-2xl border-4 border-card-border bg-muted object-contain sj-shadow sm:max-w-[400px] lg:max-h-[34vh] 2xl:max-w-[560px]"
              />
            </div>
          )}

          {active.hole && (
            <p
              className="mx-auto mt-4 w-fit rounded-full border-2 border-amber-500 bg-amber-100 px-3 py-1 text-xs font-extrabold text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
              data-testid="badge-hole"
            >
              🕳️ الحفرة مفعّلة: إذا جاوب {asking.name} صح، ينقص {effectivePoints} من {other.name}
            </p>
          )}

          {!revealed && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <CircleTimer
                seconds={shown}
                total={total}
                label={label}
                tone={call !== null ? "call" : stage === "second" ? "danger" : "primary"}
              />
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-full border-2 font-bold"
                  data-testid="button-toggle-timer"
                  onClick={() => setRunning((r) => !r)}
                  disabled={stage === "over" && call === null}
                >
                  {running ? <Pause className="ml-1 h-4 w-4" /> : <Play className="ml-1 h-4 w-4" />}
                  {running ? "إيقاف مؤقت" : "استمرار"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full border-2 font-bold"
                  data-testid="button-reset-timer"
                  onClick={() => {
                    setStage("main");
                    setSeconds(MAIN);
                    setCall(null);
                    setRunning(true);
                  }}
                >
                  <RotateCcw className="ml-1 h-4 w-4" /> إعادة الوقت
                </Button>
                {stage === "main" && (
                  <Button
                    variant="outline"
                    className="rounded-full border-2 font-bold"
                    data-testid="button-skip-to-second"
                    onClick={() => {
                      setStage("second");
                      setSeconds(SECOND);
                      setRunning(true);
                    }}
                  >
                    انتقل لوقت {other.name}
                  </Button>
                )}
              </div>
            </div>
          )}

          {revealed && (
            <div className="sj-pop mt-6 rounded-2xl border-2 border-primary bg-primary/10 p-5 text-center">
              <p className="mb-1 text-xs font-bold text-primary">الإجابة الصحيحة</p>
              <p
                data-testid="text-answer"
                className="break-words text-2xl font-black leading-relaxed text-secondary dark:text-foreground sm:text-3xl 2xl:text-6xl"
              >
                {activeCell.question.a}
              </p>
            </div>
          )}
        </div>

        {/* lifelines */}
        <div className="border-t-2 border-card-border bg-muted/60 px-4 py-3">
          <p className="mb-2 text-xs font-extrabold text-muted-foreground">
            وسائل المساعدة — {asking.name}
          </p>
          <div className="flex flex-wrap gap-2">
            {LIFELINES.filter((l) => l.when === "after").map((l) => (
              <LifelineChip
                key={l.key}
                meta={l}
                used={asking.used[l.key]}
                onClick={() => {
                  dispatch({ type: "USE_LIFELINE", key: l.key, team: active.askingTeam });
                  if (l.key === "phone") {
                    setCall(CALL);
                    setRunning(true);
                  }
                }}
              />
            ))}
          </div>

          {usedLifelines.filter((k) => k !== "hole").length > 0 && (
            <div className="mt-3 space-y-1.5">
              {usedLifelines
                .filter((k) => k !== "hole")
                .map((k) => {
                  const meta = LIFELINES.find((l) => l.key === k)!;
                  const teamName = state.teams[active.lifelines[k]!].name;
                  const note =
                    k === "double"
                      ? `${teamName} يقدر يجاوب بجوابين — يكفي أن يكون أحدهما صحيحاً.`
                      : k === "trap"
                        ? `السؤال انتقل إلى ${other.name} — وإذا جاوب غلط ينقص ${effectivePoints} من رصيده.`
                        : k === "rest"
                          ? `على ${teamName} اختيار لاعب من ${other.name} ليستريح عن الإجابة على هذا السؤال.`
                          : `مكالمة ٣٠ ثانية لصديق ${teamName}.`;
                  return (
                    <p
                      key={k}
                      data-testid={`banner-lifeline-${k}`}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-xs font-bold",
                        meta.tone,
                      )}
                    >
                      <LifelineIcon k={k} />
                      {note}
                    </p>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {!revealed ? (
        <Button
          data-testid="button-reveal"
          onClick={() => setRevealed(true)}
          className="sj-press mt-5 h-14 w-full rounded-2xl border-2 border-primary-border text-base font-black sj-shadow sm:text-lg 2xl:h-20 2xl:text-3xl"
        >
          <Eye className="ml-1 h-5 w-5" /> أظهر الإجابة
        </Button>
      ) : (
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <Button
            data-testid="button-team1-correct"
            onClick={() => resolve({ kind: "correct", team: 0 })}
            className="sj-press h-14 rounded-2xl border-2 border-emerald-700 bg-emerald-600 text-sm font-black text-white hover:bg-emerald-600/90 sm:text-base 2xl:h-20 2xl:text-2xl"
          >
            {state.teams[0].name} جاوب صح
          </Button>
          <Button
            data-testid="button-team2-correct"
            onClick={() => resolve({ kind: "correct", team: 1 })}
            className="sj-press h-14 rounded-2xl border-2 border-sky-700 bg-sky-600 text-sm font-black text-white hover:bg-sky-600/90 sm:text-base 2xl:h-20 2xl:text-2xl"
          >
            {state.teams[1].name} جاوب صح
          </Button>
          <Button
            variant="outline"
            data-testid="button-nobody"
            onClick={() => resolve({ kind: "none" })}
            className="sj-press h-14 rounded-2xl border-2 text-sm font-black sm:text-base 2xl:h-20 2xl:text-2xl"
          >
            <X className="ml-1 h-4 w-4" /> محدش جاوب
          </Button>
          {active.lifelines.trap !== undefined && (
            <Button
              data-testid="button-trap-wrong"
              onClick={() => resolve({ kind: "trap-wrong" })}
              className="sj-press h-14 rounded-2xl border-2 border-yellow-700 bg-yellow-500 text-sm font-black text-yellow-950 hover:bg-yellow-500/90 sm:col-span-3 sm:text-base"
            >
              💣 {other.name} جاوب غلط — اخصم {effectivePoints} منه
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
