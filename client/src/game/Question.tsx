import { useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, Pause, Play, RotateCcw, Volume2, X, Music, MapPin, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_BY_KEY } from "@/data/questions";
import { LIFELINES, useGame, type LifelineKey, type Outcome, LIFELINE_BY_KEY } from "./state";
import { CircleTimer, LifelineChip, LifelineIcon } from "./ui";
import { cn } from "@/lib/utils";

const MAIN = 60;
const SECOND = 10;
const CALL = 30;
const MAX_AUDIO_PLAYS = 2; // تشغيلة أولى + إعادة واحدة فقط
const WADDA7_STEPS = [600, 400, 200] as const;
const QUESTION_TEXT_COLOR = "#3E2723"; // dark brown

/** hash ثابت من نص — لتوليد عشوائية ثابتة لكل سؤال */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Convert Arabic/Western numerals to number */
function parseNumber(input: string): number | null {
  if (!input.trim()) return null;
  // Replace Arabic numerals with Western
  const arabicToWestern: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  };
  let converted = input;
  for (const [ar, ws] of Object.entries(arabicToWestern)) {
    converted = converted.replace(new RegExp(ar, 'g'), ws);
  }
  const num = parseInt(converted, 10);
  return isNaN(num) ? null : num;
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
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [clueLevel, setClueLevel] = useState(0); // 0 = no clues, 1 = first clue (600→400), 2 = second (400→200), 3 = third (200→100 or 200 min)
  const [team1Guess, setTeam1Guess] = useState("");
  const [team2Guess, setTeam2Guess] = useState("");
  // reset per-question selections when active question changes
  useEffect(() => {
    setSelectedChoices([]);
    setClueLevel(0);
    setTeam1Guess("");
    setTeam2Guess("");
  }, [active?.cellId]);
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
  const isFlags = catKey === "flags";
  const isFirstLetter = catKey === "firstletter";
  const isMoving = catKey === "moving";
  const isOrdering = catKey === "ordering";
  const isSounds = catKey === "sounds";
  const isCities = catKey === "cities";
  const isWhoami = catKey === "whoami";
  const isBeforeAfter = catKey === "beforeafter";
  const isClosestNumber = catKey === "closestnumber";
  const isAudienceChoice = catKey === "audiencechoice";
  const qhash = hashStr(activeCell.question.id);
  // قيمة السؤال الفعلية (وضح شوية تقل مع كل توضيح)
  const whoamiPointSteps = [600, 400, 200] as const;
  const effectivePoints = isWadda7 ? WADDA7_STEPS[clarify] : (isWhoami ? whoamiPointSteps[Math.min(clueLevel, 2)] : activeCell.points);
  // who is currently answering: if trap used, trappedTo is the answering team, otherwise the original asking team
  const answeringTeamIdx = (active.trappedTo !== undefined && active.trappedTo !== null) ? active.trappedTo : active.askingTeam;
  const answering = state.teams[answeringTeamIdx];
  const phoneOwnerName = state.teams[active.lifelines.phone ?? active.askingTeam].name;    const resolveCorrect = (team: 0 | 1) => {
        dispatch({ type: "RESOLVE", outcome: { kind: "correct", team }, pointsOverride: (isWadda7 || isWhoami) ? effectivePoints : undefined });
      };
      const resolveNone = () => {
        dispatch({ type: "RESOLVE", outcome: { kind: "none" }, pointsOverride: (isWadda7 || isWhoami) ? effectivePoints : undefined });
      };
      const resolveTrapWrong = (victimTeam: 0 | 1) => {
        dispatch({ type: "RESOLVE", outcome: { kind: "trap-wrong", team: victimTeam }, pointsOverride: (isWadda7 || isWhoami) ? effectivePoints : undefined });
  };
  const zoomScale = activeCell.points === 200 ? 4 : activeCell.points === 400 ? 6 : 8;
  const zoomOrigin = `${25 + (qhash % 50)}% ${25 + ((qhash >> 3) % 50)}%`;
  const logoMask = LOGO_MASKS[qhash % LOGO_MASKS.length];
  const movingWords = isMoving ? activeCell.question.a.split(/\s+/) : [];
  const movingLetters = isMoving
    ? movingWords.flatMap((w, wi) => w.split("").map((ch) => ({ ch, wi })))
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

  const playSoundEffect = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(`صوت ${activeCell.question.a}`);
      utter.lang = 'ar-SA';
      window.speechSynthesis.speak(utter);
    }
  };

  const total = call !== null ? CALL : stage === "main" ? MAIN : SECOND;
  const shown = call !== null ? call : seconds;
  const label =
    call !== null
      ? `مكالمة صديق — ${phoneOwnerName}`
      : stage === "main"
        ? `دقيقة كاملة لـ${answering.name}`
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
        <div className="flex flex-col gap-1">
          <span className="rounded-full border-2 border-card-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground 2xl:text-xl">
            الدور على: {asking.name}
          </span>
          {active.trappedTo !== undefined && active.trappedTo !== null && (
            <div className="rounded-full border-2 border-destructive/30 bg-destructive/5 px-3 py-1 text-xs font-bold text-destructive">
              🪤 الفخ نقل السؤال إلى: {answering.name}
            </div>
          )}
        </div>
      </div>
      <div className="sj-pop overflow-hidden rounded-3xl border-2 border-card-border bg-card sj-shadow-lg">
        <div className="flex items-center justify-between gap-2 bg-secondary px-4 py-3 text-secondary-foreground">
          <span className="flex items-center gap-2 text-sm font-extrabold sm:text-base 2xl:text-3xl">
            <span aria-hidden className="text-xl 2xl:text-4xl">
              {cat?.emoji || "🎯"}
            </span>
            {cat?.name || "سؤال"}
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
                className="break-words text-center text-2xl font-extrabold leading-relaxed sm:text-3xl 2xl:text-5xl"
                style={{ color: QUESTION_TEXT_COLOR }}
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
          ) : isSounds ? (
            <div className="flex flex-col items-center gap-4" data-testid="block-sounds">
              <p dir="rtl" className="break-words text-center text-2xl font-extrabold sm:text-3xl 2xl:text-5xl" style={{ color: QUESTION_TEXT_COLOR }}>
                🔊 استمع إلى الصوت وخمّن ماهيته!
              </p>
              <Button
                onClick={playSoundEffect}
                className="sj-press h-16 rounded-full border-2 border-primary-border px-8 text-lg font-black sj-shadow 2xl:h-20 2xl:px-12 2xl:text-3xl"
              >
                <Volume2 className="ml-2 h-7 w-7" /> اضغط للاستماع للصوت 🔊
              </Button>
            </div>
          ) : isCities ? (
            <div className="flex flex-col items-center gap-3" data-testid="block-cities">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="text-base font-extrabold sm:text-lg 2xl:text-2xl">معلومات عن المدينة:</span>
              </div>
              <p
                data-testid="text-question"
                dir="rtl"
                className="break-words text-center text-xl font-extrabold leading-relaxed sm:text-2xl 2xl:text-4xl"
                style={{ color: QUESTION_TEXT_COLOR }}
              >
                {activeCell.question.q}
              </p>
            </div>
          ) : isMoving ? null : (
            <p
              data-testid="text-question"
              dir="rtl"
              className={cn(
                "break-words text-center font-extrabold leading-relaxed",
                hasImage ? "text-xl sm:text-2xl 2xl:text-4xl" : "text-2xl sm:text-3xl 2xl:text-6xl",
              )}
              style={{ color: QUESTION_TEXT_COLOR }}
            >
              {activeCell.question.q}
            </p>
          )}

          {/* MCQ choices rendering */}
          {catKey === 'truefalse' ? (
            <div className="mt-4 flex flex-col items-center gap-4" data-testid="block-truefalse">
              <p className="text-center text-lg font-extrabold" style={{ color: QUESTION_TEXT_COLOR }}>اختر: صح أم فخ؟</p>
              <div className="flex w-full max-w-md justify-center gap-4">
                {(activeCell.question.choices || ["صح", "فخ"]).slice(0,2).map((choice, idx) => {
                  const selected = selectedChoices.includes(choice);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedChoices([choice])}
                      className={cn(
                        "flex-1 rounded-2xl border-2 px-6 py-4 text-xl font-black sm:text-2xl",
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-card"
                      )}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">التحديد يعرض فقط؛ اختر النتيجة النهائية بعد كشف الإجابة.</div>
            </div>
          ) : Array.isArray(activeCell.question.choices) && activeCell.question.choices.length > 0 && (
            <div className="mt-4 flex flex-col items-center gap-3" data-testid="block-choices">
              <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {activeCell.question.choices.map((choice, idx) => {
                  const selected = selectedChoices.includes(choice);
                  const maxAllowed = (active.lifelines.double === active.askingTeam && catKey !== 'truefalse' && catKey !== 'beforeafter' && catKey !== 'audiencechoice') ? 2 : 1;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (selected) setSelectedChoices((s) => s.filter((x) => x !== choice));
                        else if (selectedChoices.length < maxAllowed) setSelectedChoices((s) => [...s, choice]);
                      }}
                      className={cn(
                        "rounded-2xl border-2 px-3 py-2 text-sm font-black sm:text-base",
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-card"
                      )}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
              {Array.isArray(activeCell.question.correctChoices) && activeCell.question.correctChoices.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {selectedChoices.length > 0
                    ? ((): JSX.Element => {
                        const a = [...selectedChoices].sort().join("||");
                        const b = [...activeCell.question.correctChoices!].sort().join("||");
                        return <span>{a === b ? "اختيارات تتطابق مع الإجابات الصحيحة" : "اختيارات لا تطابق الإجابات الصحيحة"}</span>;
                      })()
                    : <span>اختر إجابة{active.lifelines.double === active.askingTeam ? " (مسموح باثنين)" : " (مسموح بواحدة)"}</span>}
                </div>
              )}
            </div>
          )}

          {/* Whoami with progressive clue reveal */}
          {isWhoami && (
            <div className="mt-4 flex flex-col items-center gap-3" data-testid="block-whoami">
              <div className="w-full max-w-xl rounded-2xl border-2 border-primary/30 bg-muted/20 p-4">
                <p className="mb-3 text-center text-sm font-bold text-primary sm:text-base">النقاط الحالية: {effectivePoints}</p>
                <div className="flex flex-col gap-2">
                  {activeCell.question.clues?.map((clue, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-lg border-2 px-4 py-2 text-sm transition-all sm:text-base",
                        clueLevel > idx
                          ? "border-primary bg-primary/10 text-foreground font-semibold"
                          : "border-muted bg-card text-muted-foreground"
                      )}
                    >
                      <span className="font-black text-primary mr-2">{idx + 1}.</span>
                      {clueLevel > idx ? clue : "🔒"}
                    </div>
                  ))}
                </div>
                {clueLevel < (activeCell.question.clues?.length ?? 0) && (
                  <button
                    onClick={() => setClueLevel((c) => Math.min(c + 1, (activeCell.question.clues?.length ?? 0)))}
                    className="mt-3 w-full rounded-lg bg-primary/20 px-3 py-2 text-sm font-black text-primary hover:bg-primary/30 sm:text-base"
                  >
                    الكشف عن تلميح (النقاط: {whoamiPointSteps[Math.min(clueLevel + 1, 2)]} بعده)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Beforeafter with two large choice buttons */}
          {isBeforeAfter && (
            <div className="mt-4 flex flex-col items-center gap-3" data-testid="block-beforeafter">
              <div className="w-full max-w-md flex flex-col gap-3">
                {(activeCell.question.choices || []).map((choice, idx) => {
                  const selected = selectedChoices.includes(choice);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedChoices([choice])}
                      className={cn(
                        "rounded-2xl border-2 px-6 py-4 text-lg font-black sm:text-xl transition-all",
                        selected ? "bg-primary text-primary-foreground border-primary" : "bg-card border-card-border hover:border-primary"
                      )}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Closestnumber with numeric input */}
          {isClosestNumber && (
            <div className="mt-4 flex flex-col items-center gap-3" data-testid="block-closestnumber">
              <div className="w-full max-w-lg rounded-2xl border-2 border-primary/30 bg-muted/20 p-4">
                <p className="mb-4 text-center text-sm font-bold text-primary sm:text-base">أدخل الرقم الصحيح لكل فريق</p>
                <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-foreground mb-1">الفريق 1: {asking.name}</label>
                    <input
                      type="text"
                      value={team1Guess}
                      onChange={(e) => setTeam1Guess(e.target.value)}
                      placeholder="أدخل الرقم"
                      className="w-full rounded-lg border-2 border-card-border bg-card px-3 py-2 text-sm font-black text-center"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-foreground mb-1">الفريق 2: {other.name}</label>
                    <input
                      type="text"
                      value={team2Guess}
                      onChange={(e) => setTeam2Guess(e.target.value)}
                      placeholder="أدخل الرقم"
                      className="w-full rounded-lg border-2 border-card-border bg-card px-3 py-2 text-sm font-black text-center"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                {(team1Guess || team2Guess) && activeCell.question.numericAnswer !== undefined && (
                  <div className="mt-3 rounded-lg bg-primary/10 p-3 text-center">
                    {(() => {
                      const n1 = parseNumber(team1Guess);
                      const n2 = parseNumber(team2Guess);
                      if (n1 === null && n2 === null) return <span className="text-xs text-muted-foreground">ادخل الأرقام</span>;
                      const diff1 = n1 !== null ? Math.abs(n1 - activeCell.question.numericAnswer) : Infinity;
                      const diff2 = n2 !== null ? Math.abs(n2 - activeCell.question.numericAnswer) : Infinity;
                      if (diff1 === diff2 && diff1 !== Infinity) {
                        return <span className="text-sm font-black text-primary">تعادل — لا نقاط</span>;
                      }
                      const winner = diff1 < diff2 ? asking.name : other.name;
                      return <span className="text-sm font-black text-primary">الأقرب: {winner}</span>;
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audiencechoice with percentage bars */}
          {isAudienceChoice && (
            <div className="mt-4 flex flex-col items-center gap-3" data-testid="block-audiencechoice">
              {activeCell.question.audiencePercentages && (
                <div className="w-full max-w-lg rounded-2xl border-2 border-primary/30 bg-muted/20 p-4">
                  <p className="mb-3 text-center text-xs font-bold text-primary sm:text-sm">نسب الاختيار:</p>
                  <div className="space-y-2">
                    {(activeCell.question.choices || []).map((choice, idx) => {
                      const percentage = activeCell.question.audiencePercentages?.[choice] ?? 0;
                      const isCorrect = activeCell.question.correctChoices?.includes(choice);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span>{choice}</span>
                            <span>{percentage}%</span>
                          </div>
                          <div className="h-4 overflow-hidden rounded-full bg-muted-foreground/20">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isCorrect ? "bg-green-500" : "bg-blue-500"
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {isOrdering && (
            <div className="mt-4 flex flex-col items-center gap-3" data-testid="block-ordering">
              <div className="w-full max-w-xl rounded-2xl border-2 border-card-border bg-muted/30 p-4 text-center">
                <span className="text-xs font-bold text-muted-foreground sm:text-sm 2xl:text-lg">العناصر غير مرتبة — قم بترتيبها:</span>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {activeCell.question.q.includes("[") ? (
                    activeCell.question.q.split("[")[1]?.split("]")[0]?.split("،").map((item, idx) => (
                      <span key={idx} className="rounded-xl border-2 border-primary/40 bg-card px-3 py-1.5 text-sm font-black text-primary shadow-sm sm:text-base 2xl:text-2xl">
                        {item.trim()}
                      </span>
                    ))
                  ) : (
                    activeCell.question.a.split("➔").sort(() => 0.5 - ((qhash + idx) % 10) / 10).map((item, idx) => (
                      <span key={idx} className="rounded-xl border-2 border-primary/40 bg-card px-3 py-1.5 text-sm font-black text-primary shadow-sm sm:text-base 2xl:text-2xl">
                        {item.trim()}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {isFlags && (
            <div className="mt-4 flex justify-center" data-testid="block-flag-image">
              <img
                src={activeCell.question.image}
                alt="علم الدولة"
                className="h-40 w-auto max-w-full rounded-xl border-4 border-card-border object-contain shadow-md sm:h-56 2xl:h-72"
              />
            </div>
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
              className="relative mx-auto mt-4 h-48 w-full max-w-2xl overflow-hidden rounded-2xl border-2 border-dashed border-card-border bg-muted/50 p-4 2xl:h-72"
              data-testid="block-moving-letters"
            >
              {movingLetters.map((item, i) => {
                              const ch = item.ch;
                              const wi = item.wi;
                              const totalLetters = movingLetters.length;
                              const cols = Math.ceil(Math.sqrt(totalLetters * 1.5));
                              const col = i % cols;
                              const row = Math.floor(i / cols);
                              const maxRows = Math.ceil(totalLetters / cols);

                              const colWidth = 82 / Math.max(cols, 1);
                              const rowHeight = 72 / Math.max(maxRows, 1);

                              const baseLeft = 6 + col * colWidth;
                              const baseTop = 8 + row * rowHeight;

                              const h = hashStr(`${activeCell.question.id}-${i}`);
                              const jitterLeft = (h % 10) - 5;
                              const jitterTop = ((h >> 3) % 8) - 4;

                              const left = Math.max(10, Math.min(78, baseLeft + jitterLeft));
                              const top = Math.max(10, Math.min(68, baseTop + jitterTop));

                              const animClass = `sj-drift-${(i % 4) + 1}`;
                              const dur = 2.8 + ((h >> 4) % 20) / 10;
                              const delay = -((h >> 2) % 25) / 10;
                              const color = wi === 0 ? QUESTION_TEXT_COLOR : "#0B3D91";
                              return (
                                <span
                                  key={i}
                                  className={cn(
                                    "absolute text-4xl font-black sm:text-5xl 2xl:text-7xl",
                                    animClass
                                  )}
                                  style={{
                                    left: `${left}%`,
                                    top: `${top}%`,
                                    animationDuration: `${dur}s`,
                                    animationDelay: `${delay}s`,
                                    color,
                                  }}
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
                  className={cn(
                    "max-h-[260px] w-auto max-w-full object-contain transition-all duration-500 sm:max-h-[340px] 2xl:max-h-[500px]",
                    isWadda7 && (clarify === 0 ? "blur-xl" : clarify === 1 ? "blur-md" : "blur-0"),
                  )}
                  style={
                    isZoom
                      ? { transform: `scale(${zoomScale})`, transformOrigin: zoomOrigin }
                      : undefined
                  }
                />
              </div>
              {isWadda7 && (
                <div className="flex flex-col items-center gap-1.5" data-testid="block-wadda7-controls">
                  <Button
                    data-testid="button-wadda7-more"
                    disabled={clarify >= 2 || revealed}
                    onClick={() => setClarify((c) => Math.min(2, c + 1))}
                    variant="secondary"
                    className="rounded-full border-2 font-bold 2xl:h-12 2xl:px-6 2xl:text-xl"
                  >
                    🔍 وضّح شوية ({clarify === 0 ? "وضّح أكتر ← ٤٠٠ نقطة" : "وضّح تماماً ← ٢٠٠ نقطة"})
                  </Button>
                  <span className="text-xs font-bold text-muted-foreground 2xl:text-lg">
                    {clarify === 0
                      ? "الصورة مغطاة بالكامل (٦٠٠ نقطة)"
                      : clarify === 1
                        ? "الصورة شبه واضحة (٤٠٠ نقطة)"
                        : "الصورة واضحة تماماً (٢٠٠ نقطة)"}
                  </span>
                </div>
              )}
            </div>
          )}
          {isLogos && (
            <div className="mt-4 flex justify-center" data-testid="block-logo-mask">
              <div className="relative overflow-hidden rounded-2xl border-4 border-card-border bg-white p-4 shadow-inner dark:bg-card">
                <img src={activeCell.question.image} alt="logo" className="h-44 w-72 object-contain sm:h-56 sm:w-96 2xl:h-80 2xl:w-[34rem]" />
                {!revealed &&
                  logoMask.map((m, i) => (
                    <div
                      key={i}
                      className="absolute bg-secondary dark:bg-card"
                      style={{ left: `${m.left}%`, top: `${m.top}%`, width: `${m.w}%`, height: `${m.h}%` }}
                    />
                  ))}
              </div>
            </div>
          )}
          <div className="mt-6 flex flex-col items-center gap-4 sm:mt-8">
            <CircleTimer seconds={shown} total={total} label={label} paused={!running || revealed} />
            {!revealed ? (
              <Button
                data-testid="button-reveal"
                onClick={() => {
                  setRevealed(true);
                  setRunning(false);
                }}
                className="sj-press h-14 w-full max-w-md rounded-2xl border-2 border-primary-border text-lg font-black sj-shadow 2xl:h-20 2xl:max-w-xl 2xl:text-3xl"
              >
                <Eye className="ml-2 h-5 w-5 2xl:h-8 2xl:w-8" /> أظهر الإجابة
              </Button>
            ) : (
              <div
                dir="rtl"
                data-testid="text-answer"
                className="sj-pop w-full max-w-2xl rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 text-center dark:bg-emerald-950/30 2xl:p-6"
              >
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 2xl:text-xl">
                  الإجابة الصحيحة:
                </span>
                <p className="mt-1 text-2xl font-black text-emerald-900 dark:text-emerald-100 sm:text-3xl 2xl:text-5xl">
                  {activeCell.question.a}
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 border-t-2 border-card-border pt-4">
            <p className="mb-2 text-center text-xs font-bold text-muted-foreground 2xl:text-lg">
              وسائل المساعدة المستخدمة للسؤال:
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {usedLifelines.length === 0 ? (
                <span className="text-xs text-muted-foreground 2xl:text-base">لم تُستخدم أي وسيلة</span>
              ) : (
                usedLifelines.map((k) => {
                  const ownerIdx = active.lifelines[k]!;
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <LifelineChip meta={LIFELINE_BY_KEY[k]} used={true} compact />
                      <span className="text-xs font-bold text-muted-foreground">{state.teams[ownerIdx].name}</span>
                    </div>
                  );
                })
              )}
            </div>
           {!revealed && (
  <div className="mt-4 flex flex-wrap justify-center gap-2">
    {LIFELINES.filter((l) => l.key !== "hole").map((l) => (
      <Button
        key={l.key}
        size="sm"
        variant="outline"
        disabled={
          state.teams[active.askingTeam].used[l.key] ||
          active.lifelines[l.key] !== undefined ||
          (l.key === "phone" && call !== null) ||
          (l.key === "double" && (!activeCell.question.choices || activeCell.question.choices.length === 0 || activeCell.catKey === 'truefalse' || activeCell.catKey === 'beforeafter'))
        }
        onClick={() => {
          if (l.key === "phone") setCall(CALL);
          dispatch({ type: "USE_LIFELINE", key: l.key, team: active.askingTeam });
        }}
        className="rounded-full border-2 text-xs font-bold 2xl:h-11 2xl:px-4 2xl:text-lg"
      >
        <LifelineIcon k={l.key} className="ml-1 h-3.5 w-3.5 2xl:h-5 2xl:w-5" />
        {l.name}
      </Button>
    ))}
  </div>
)}
          </div>
          {revealed && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center" data-testid="block-resolution-buttons">
              <Button
                          data-testid="button-team0-correct"
                          onClick={() => resolveCorrect(0)}
                className="sj-press h-14 rounded-2xl border-2 border-emerald-600 bg-emerald-600 text-lg font-black text-white hover:bg-emerald-700 sj-shadow sm:px-8 2xl:h-20 2xl:text-3xl"
              >
                          {state.teams[0].name} إجابة صحيحة (+{effectivePoints})
              </Button>
              <Button
                          data-testid="button-team1-correct"
                          onClick={() => resolveCorrect(1)}
                          className="sj-press h-14 rounded-2xl border-2 border-emerald-600 bg-emerald-600 text-lg font-black text-white hover:bg-emerald-700 sj-shadow sm:px-8 2xl:h-20 2xl:text-3xl"
                        >
                          {state.teams[1].name} إجابة صحيحة (+{effectivePoints})
                        </Button>
                        <Button
                          data-testid="button-skip"
                          onClick={() => resolveNone()}
                          variant="outline"
                          className="rounded-2xl border-2 font-bold 2xl:h-20 2xl:text-2xl"
                        >
                          إلغاء / لا أحد
                        </Button>
                        {active.lifelines.trap !== undefined && (
                          <Button
                            data-testid="button-trap-wrong"
                            onClick={() => resolveTrapWrong(answeringTeamIdx)}
                            variant="destructive"
                            className="sj-press h-14 rounded-2xl border-2 border-destructive text-lg font-black sj-shadow sm:px-8 2xl:h-20 2xl:text-3xl"
                          >
                            {state.teams[answeringTeamIdx].name} إجابة خاطئة (-{effectivePoints})
                          </Button>
                        )}
                      </div>
                    )}
        </div>
      </div>
    </div>
  );
}
