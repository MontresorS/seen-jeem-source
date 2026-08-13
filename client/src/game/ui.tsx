import { useState } from "react";
import { Phone, ArrowLeftRight, Bomb, Hand, HelpCircle, Clock, ListChecks } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LIFELINES, type LifelineKey, type LifelineMeta } from "./state";
import { cn } from "@/lib/utils";

/* ---------------- Logo ---------------- */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("grid w-full grid-cols-3 items-center", className)}>
      {/* Left spacer — mirrors the wordmark column so the wolf is geometrically centred */}
      <div aria-hidden="true" />
      {/* Centre — wolf logo */}
      <div className="flex justify-center">
        <img
          src="/seen-jeem-logo-new.png"
          alt="شعار الذئب الخاص بسين وجيم"
          className="h-36 w-36 shrink-0 object-contain drop-shadow-lg sm:h-48 sm:w-48 lg:h-[13.5rem] lg:w-[13.5rem]"
        />
      </div>
      {/* Right — wordmark pinned to the right edge */}
      <div className="flex flex-col items-end text-right leading-none">
        <span className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: "#3E2723" }}>
          سين وجيم
        </span>
        <span className="mt-1 text-[11px] font-semibold text-muted-foreground sm:text-sm lg:text-base">
          Montaser's Cool Edition
        </span>
      </div>
    </div>
  );
}

export function CategoryVisual({
  catKey,
  emoji,
  className,
}: {
  catKey: string;
  emoji: string;
  className?: string;
}) {
  if (catKey !== "tilepuzzle") return <span className={className}>{emoji}</span>;
  return (
    <img
      src="/images/tilepuzzle/tilepuzzle-emblem.svg"
      alt="شعار ركّبها صح"
      className={cn("h-9 w-9 object-contain", className)}
    />
  );
}

/* ---------------- Lifeline icon ---------------- */
export function LifelineIcon({ k, className }: { k: LifelineKey; className?: string }) {
  const c = cn("h-4 w-4", className);
  if (k === "phone") return <Phone className={c} strokeWidth={2.4} />;
  if (k === "hole") return <ArrowLeftRight className={c} strokeWidth={2.4} />;
  if (k === "trap") return <Bomb className={c} strokeWidth={2.4} />;
  if (k === "rest") return <Hand className={c} strokeWidth={2.4} />;
  if (k === "choices2") return <ListChecks className={c} strokeWidth={2.4} />;
  return (
    <svg viewBox="0 0 24 24" className={c} fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M8.5 12.5 6.7 6.2a1.6 1.6 0 1 1 3.1-.9l1.5 5.4" strokeLinecap="round" />
      <path d="M13.2 11.2l1.6-5.4a1.6 1.6 0 1 1 3.1.9l-1.9 6.8" strokeLinecap="round" />
      <path
        d="M7.6 11.4c-1.6.6-2.4 2.2-1.9 3.9l.7 2.3A5.2 5.2 0 0 0 11.4 21h1.9a5 5 0 0 0 4.8-3.6l.5-1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------------- Lifeline chip ---------------- */
export function LifelineChip({
  meta,
  used,
  armed,
  disabled,
  onClick,
  compact,
}: {
  meta: LifelineMeta;
  used: boolean;
  armed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={`button-lifeline-${meta.key}`}
      onClick={onClick}
      disabled={used || disabled}
      title={`${meta.name} — ${meta.desc}`}
      aria-label={meta.name}
      className={cn(
        "sj-press relative flex items-center gap-1.5 rounded-full border-2 px-2 py-1 text-[11px] font-bold sm:text-xs",
        meta.tone,
        used && "opacity-35 line-through",
        armed && "ring-2 ring-offset-2 ring-primary ring-offset-background sj-pulse",
        (used || disabled) && "cursor-not-allowed",
      )}
    >
      <LifelineIcon k={meta.key} />
      {!compact && <span className="whitespace-nowrap">{meta.name}</span>}
      {meta.isNew && !used && (
        <span className="absolute -top-2 -left-1 rounded-full bg-destructive px-1.5 text-[9px] font-black text-destructive-foreground">
          جديد
        </span>
      )}
    </button>
  );
}

/* ---------------- Help dialog ---------------- */
export function HelpDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            size="icon"
            data-testid="button-help"
            aria-label="كيف نلعب؟"
            className="rounded-full border-2"
          >
            <HelpCircle className="h-5 w-5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
        data-testid="dialog-help"
      >
        <DialogHeader className="text-right">
          <DialogTitle className="text-lg font-extrabold">كيف نلعب سين وجيم؟</DialogTitle>
          <DialogDescription className="text-right leading-relaxed">
            فريقان أو ٣ فرق. مع فريقين تختارون ٦ أو ٩ أو ١٢ فئة، ومع ٣ فرق تختارون ٩ فئات. الفريق اللي يجمع أكثر نقاط يفوز.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed">
          <div className="rounded-xl border-2 border-primary/30 bg-primary/10 p-3">
            <p className="flex items-center gap-2 font-extrabold text-secondary dark:text-foreground">
              <Clock className="h-4 w-4" /> قاعدة الوقت
            </p>
            <p className="mt-1">
              الفريق الذي عليه الدور لديه <b>دقيقة واحدة فقط</b>، والفريق الثاني لديه{" "}
              <b>١٠ ثواني فقط</b> تُحسب من بعد جواب الفريق الأول.
            </p>
          </div>

          <div>
            <p className="mb-2 font-extrabold">وسائل المساعدة (لكل فريق مرة واحدة)</p>
            <ul className="space-y-2.5">
              {LIFELINES.map((l) => (
                <li key={l.key} className="flex gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                      l.tone,
                    )}
                  >
                    <LifelineIcon k={l.key} />
                  </span>
                  <span>
                    <b>{l.name}</b>{" "}
                    <span className="text-xs text-muted-foreground">
                      ({l.when === "before" ? "قبل فتح السؤال" : "بعد رؤية السؤال"})
                    </span>
                    <br />
                    {l.desc}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border-2 border-sky-500/50 bg-sky-500/10 p-3">
            <p className="font-extrabold text-secondary dark:text-foreground">🎧 فئة «كلمات معكوسة» بالصوت</p>
            <p className="mt-1">
              الكلمة ما تتكتبش — تتسمع! في كل المستويات الحروف منطوقة <b>حرف حرف بالعكس</b>،
              رتّبوها في دماغكوم واعرفوا الكلمة. مسموح
              <b> تشغيلة واحدة + إعادة واحدة فقط</b> لكل سؤال.
            </p>
          </div>

          <div className="rounded-xl border-2 border-violet-500/50 bg-violet-500/10 p-3">
            <p className="font-extrabold text-secondary dark:text-foreground">🌟 فئات جديدة</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>
                <b>🌫️ وضح شوية:</b> صورة مشوّشة تبدأ بـ <b>٦٠٠</b>. مش عارفين؟ دوسوا
                «وضّح شوية» والصورة توضح والسؤال ينزل لـ <b>٤٠٠</b> ثم <b>٢٠٠</b> (مرتين بس).
              </li>
              <li>
                <b>🔎 زوم:</b> صورة مقرّبة جامد أوي — اعرفوا الحاجة قبل ما الزوم يتفك.
              </li>
              <li>
                <b>🏷️ شعارات عالمية:</b> شعار مشهور مخبّي منه جزء — اعرفوا الماركة.
              </li>
              <li>
                <b>🔤 حروف:</b> سؤال + أول حرف من الإجابة كمساعدة.
              </li>
              <li>
                <b>🎈 حروف متحركة:</b> حروف الإجابة بتتحرك قدامكوم بعشوائية — ركّبوها واعرفوا الكلمة.
              </li>
              <li>
                <b>🧩 ركّبها صح:</b> لغز صور ٣×٣ حقيقي، بدّلوا بين بلاطتين لإرجاع الصورة كاملة، ومع كل مستوى توجد
                مساعدات تثبيت خاصة.
              </li>
              <li>
                <b>🤥 مين الكدّاب:</b> ثلاث جمل (أ/ب/ج) وفيها جملة واحدة كاذبة فقط.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border-2 border-card-border bg-muted/60 p-3">
            <p className="font-extrabold text-secondary dark:text-foreground">♻ بدون تكرار</p>
            <p className="mt-1">
              الأسئلة اللي لعبتوها ما تتكرر في الألعاب التالية داخل نفس الجلسة. تقدرون تشوفون
              «أسئلة متبقية» لكل فئة في شاشة التجهيز، وفيه زر لإعادة تعيين المستخدمة.
            </p>
          </div>

          <div>
            <p className="mb-1 font-extrabold">خطوات اللعب</p>
            <ol className="list-inside list-decimal space-y-1">
              <li>اكتبوا أسماء الفرق وحددوا عددها ثم اختاروا الفئات المطلوبة.</li>
              <li>الفريق الذي عليه الدور يختار فئة وعدد نقاط.</li>
              <li>بعد انتهاء الوقت اضغطوا «أظهر الإجابة» وحدّدوا من جاوب صح.</li>
              <li>ينتقل الدور للفريق الثاني، ويستمر اللعب حتى ينتهي كل الأسئلة.</li>
            </ol>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Circular countdown ---------------- */
export function CircleTimer({
  seconds,
  total,
  label,
  tone = "primary",
  paused,
}: {
  seconds: number;
  total: number;
  label: string;
  tone?: "primary" | "danger" | "call";
  paused?: boolean;
}) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  const stroke =
    tone === "danger"
      ? "hsl(var(--destructive))"
      : tone === "call"
        ? "hsl(152 60% 40%)"
        : "hsl(var(--primary))";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-28 w-28 sm:h-36 sm:w-36 2xl:h-52 2xl:w-52">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
            className="dark:opacity-60"
          />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            style={{ transition: paused ? "none" : "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <span
          className={cn(
            "sj-tick absolute inset-0 flex items-center justify-center text-3xl font-black sm:text-4xl 2xl:text-7xl",
            seconds <= 5 && seconds > 0 && "sj-pulse text-destructive",
          )}
          data-testid="text-timer"
        >
          {seconds}
        </span>
      </div>
      <span
        className="text-xs font-bold text-muted-foreground sm:text-sm 2xl:text-2xl"
        data-testid="text-timer-label"
      >
        {label}
      </span>
    </div>
  );
}
