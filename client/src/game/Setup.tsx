import { useState } from "react";
import { Check, Users, Play, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CATEGORIES } from "@/data/questions";
import { THREE_TEAM_CATEGORY_COUNT, TWO_TEAM_CATEGORY_OPTIONS, useGame } from "./state";
import { CategoryVisual, HelpDialog, Logo } from "./ui";
import { cn } from "@/lib/utils";

export default function Setup() {
  const { dispatch, stats, totalRemaining, totalQuestions } = useGame();
  const [gameName, setGameName] = useState("");
  const [t1, setT1] = useState("");
  const [t2, setT2] = useState("");
  const [t3, setT3] = useState("");
  const [teamCount, setTeamCount] = useState<2 | 3>(2);
  const [twoTeamCategoryTarget, setTwoTeamCategoryTarget] = useState<(typeof TWO_TEAM_CATEGORY_OPTIONS)[number]>(6);
  const [picked, setPicked] = useState<string[]>([]);

  const requiredCategories = teamCount === 3 ? THREE_TEAM_CATEGORY_COUNT : twoTeamCategoryTarget;

  const toggle = (key: string) => {
    setPicked((p) =>
      p.includes(key) ? p.filter((k) => k !== key) : p.length >= requiredCategories ? p : [...p, key],
    );
  };

  const ready = picked.length === requiredCategories;
  const usedTotal = totalQuestions - totalRemaining;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:pt-8 2xl:max-w-[1700px] 2xl:px-10">
      <header className="mb-6 flex flex-col items-center gap-3">
        <Logo />
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-3">
          <span
            data-testid="text-bank-total"
            className="rounded-full border-2 border-card-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground 2xl:text-lg"
          >
            بنك الأسئلة: {totalQuestions} سؤال في {CATEGORIES.length} فئات
          </span>
          <span className="rounded-full border-2 border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary 2xl:text-lg">
            {usedTotal > 0 && `استُخدم: ${usedTotal} | `}متبقي: {totalRemaining}
          </span>
          <HelpDialog />
        </div>
      </header>

      <div className="sj-fade-up mb-7 rounded-3xl border-2 border-card-border bg-card p-5 sj-shadow sm:p-7">
        <div className="mb-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <h1
            className="col-start-3 text-right text-xl font-black sm:text-2xl 2xl:text-4xl"
            style={{ color: "#3E2723" }}
          >
            جهّزوا اللعبة 🎉
          </h1>
          <div className="col-start-2 flex items-center gap-2">
            <Button
              type="button"
              variant={teamCount === 2 ? "default" : "outline"}
              className="rounded-xl border-2 px-4 font-black"
              onClick={() => {
                setTeamCount(2);
                setPicked((prev) => prev.slice(0, twoTeamCategoryTarget));
              }}
            >
              فريقان
            </Button>
            <Button
              type="button"
              variant={teamCount === 3 ? "default" : "outline"}
              className="rounded-xl border-2 px-4 font-black"
              onClick={() => {
                setTeamCount(3);
                setPicked((prev) => prev.slice(0, THREE_TEAM_CATEGORY_COUNT));
              }}
            >
              ٣ فرق
            </Button>
          </div>
        </div>
        <p className="mb-5 text-sm text-muted-foreground 2xl:text-xl">
          اكتبوا أسماء الفرق، واختاروا عدد الفئات المناسب (فريقان: ٦/٩/١٢ — ثلاثة فرق: ٩). الأسئلة ما تتكرر بين
          الألعاب في نفس الجلسة.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="game-name" className="text-xs font-bold 2xl:text-base" style={{ color: "#3E2723" }}>
              اسم اللعبة (اختياري)
            </Label>
            <Input
              id="game-name"
              data-testid="input-game-name"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="ليلة سين وجيم"
              className="rounded-xl border-2 text-right 2xl:h-14 2xl:text-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team1" className="text-xs font-bold 2xl:text-base" style={{ color: "#3E2723" }}>
              اسم الفريق الأول
            </Label>
            <Input
              id="team1"
              data-testid="input-team1"
              value={t1}
              onChange={(e) => setT1(e.target.value)}
              placeholder="الفريق الأول"
              className="rounded-xl border-2 text-right 2xl:h-14 2xl:text-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team2" className="text-xs font-bold 2xl:text-base" style={{ color: "#3E2723" }}>
              اسم الفريق الثاني
            </Label>
            <Input
              id="team2"
              data-testid="input-team2"
              value={t2}
              onChange={(e) => setT2(e.target.value)}
              placeholder="الفريق الثاني"
              className="rounded-xl border-2 text-right 2xl:h-14 2xl:text-xl"
            />
          </div>
          {teamCount === 3 && (
            <div className="space-y-1.5">
              <Label htmlFor="team3" className="text-xs font-bold 2xl:text-base" style={{ color: "#3E2723" }}>
                اسم الفريق الثالث
              </Label>
              <Input
                id="team3"
                data-testid="input-team3"
                value={t3}
                onChange={(e) => setT3(e.target.value)}
                placeholder="الفريق الثالث"
                className="rounded-xl border-2 text-right 2xl:h-14 2xl:text-xl"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-secondary dark:text-foreground 2xl:text-3xl">
          <Users className="h-5 w-5 text-primary 2xl:h-8 2xl:w-8" /> اختاروا {requiredCategories} فئات من {CATEGORIES.length}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {teamCount === 2 && (
            <div className="flex items-center gap-1 rounded-full border-2 border-card-border bg-card p-1">
              {TWO_TEAM_CATEGORY_OPTIONS.map((count) => (
                <Button
                  key={count}
                  type="button"
                  size="sm"
                  variant={twoTeamCategoryTarget === count ? "default" : "ghost"}
                  className="rounded-full px-3 text-xs font-black"
                  onClick={() => {
                    setTwoTeamCategoryTarget(count);
                    setPicked((prev) => prev.slice(0, count));
                  }}
                >
                  {count}
                </Button>
              ))}
            </div>
          )}
          <span
            data-testid="text-picked-count"
            className={cn(
              "rounded-full border-2 px-3 py-1 text-sm font-black 2xl:text-xl",
              ready
                ? "border-primary bg-primary text-primary-foreground"
                : "border-card-border bg-card text-muted-foreground",
            )}
          >
            اخترتم {picked.length} من {requiredCategories}
          </span>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={usedTotal === 0}
                data-testid="button-reset-used"
                className="rounded-full border-2 text-xs font-bold 2xl:text-lg"
              >
                <RefreshCw className="ml-1 h-4 w-4" /> إعادة تعيين الأسئلة المستخدمة
                {usedTotal > 0 && ` (${usedTotal})`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent dir="rtl" className="text-right">
              <AlertDialogHeader>
                <AlertDialogTitle>إعادة تعيين الأسئلة المستخدمة؟</AlertDialogTitle>
                <AlertDialogDescription>
                  راح ترجع كل الأسئلة ({totalQuestions}) متاحة من جديد، ويمكن تتكرر أسئلة لعبتوها
                  قبل قليل.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:justify-start">
                <AlertDialogAction
                  data-testid="button-confirm-reset-used"
                  onClick={() => dispatch({ type: "RESET_USED" })}
                >
                  نعم، أعد التعيين
                </AlertDialogAction>
                <AlertDialogCancel className="mt-0">رجوع</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 2xl:gap-5">
        {CATEGORIES.map((c) => {
          const on = picked.includes(c.key);
          const full = !on && picked.length >= requiredCategories;
          const st = stats[c.key];
          const low = st.remaining < 6;
          return (
            <button
              key={c.key}
              type="button"
              data-testid={`card-category-${c.key}`}
              aria-pressed={on}
              onClick={() => toggle(c.key)}
              disabled={full}
              className={cn(
                "sj-press relative flex flex-col items-start gap-2 overflow-hidden rounded-2xl border-2 p-3 text-right sm:p-4",
                on
                  ? "border-primary bg-primary/12 sj-shadow"
                  : "border-card-border bg-card hover:border-primary/50",
                full && "cursor-not-allowed opacity-45",
              )}
            >
              <CategoryVisual
                catKey={c.key}
                emoji={c.emoji}
                className={c.key === "tilepuzzle" ? "h-10 w-10 sm:h-12 sm:w-12 2xl:h-16 2xl:w-16" : "text-3xl leading-none sm:text-4xl 2xl:text-6xl"}
              />
              <span className="text-sm font-extrabold leading-snug text-secondary dark:text-foreground sm:text-base 2xl:text-2xl">
                {c.name}
              </span>
              <span
                data-testid={`text-remaining-${c.key}`}
                className={cn(
                  "text-[11px] font-bold 2xl:text-base",
                  low ? "text-destructive" : "text-muted-foreground",
                )}
              >
                أسئلة متبقية: {st.remaining} من {st.total}
              </span>
              {on && (
                <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground 2xl:h-9 2xl:w-9">
                  <Check className="h-4 w-4 2xl:h-6 2xl:w-6" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="sticky bottom-3 z-10 mt-8">
        <Button
          data-testid="button-start"
          disabled={!ready}
          onClick={() =>
            dispatch({ type: "START", gameName, names: [t1, t2, t3], catKeys: picked, teamCount })
          }
          className="sj-press h-14 w-full rounded-2xl border-2 border-primary-border text-base font-black sj-shadow sm:text-lg 2xl:h-20 2xl:text-3xl"
        >
          {ready && <Play className="ml-1 h-5 w-5 shrink-0 2xl:h-8 2xl:w-8" />}
          <span className="px-1 py-1 leading-loose">
            {ready
              ? "ابدأ اللعب"
              : picked.length === 0
                ? `اختاروا ${requiredCategories} فئات`
                : `ناقص ${requiredCategories - picked.length} من الفئات`}
          </span>
        </Button>
      </div>
    </div>
  );
}
