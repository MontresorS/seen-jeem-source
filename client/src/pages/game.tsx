import { useEffect } from "react";
import { useGame } from "@/game/state";
import Setup from "@/game/Setup";
import Board from "@/game/Board";
import QuestionView from "@/game/Question";
import Charades from "@/game/Charades";
import Results from "@/game/Results";

export default function GamePage() {
  const { state } = useGame();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [state.phase, state.active?.cellId]);

  const showFooter = state.phase === "setup" || state.phase === "results";

  return (
    <main dir="rtl" className="min-h-screen">
      {state.phase === "setup" && <Setup />}
      {state.phase === "board" && <Board />}
      {state.phase === "question" && <QuestionView />}
      {state.phase === "charades" && <Charades />}
      {state.phase === "results" && <Results />}
      {showFooter && (
        <footer className="pb-6 text-center text-[11px] font-semibold text-muted-foreground 2xl:text-base">
          مستوحاة من لعبة سين وجيم — العبوها مع أصحابكم 🎯
        </footer>
      )}
    </main>
  );
}
