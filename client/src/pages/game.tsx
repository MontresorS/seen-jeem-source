import { useEffect, useState } from "react";
import { useGame } from "@/game/state";
import Setup from "@/game/Setup";
import Board from "@/game/Board";
import QuestionView from "@/game/Question";
import Results from "@/game/Results";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { GameState } from "@/game/state";

export default function GamePage() {
  const { state, dispatch } = useGame();
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [snapshotToRestore, setSnapshotToRestore] = useState<GameState | null>(null);

  // Check for snapshot on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("seen-jeem-active-game-v1");
      if (stored) {
        const snapshot = JSON.parse(stored) as any;
        if (snapshot.version === 1 && snapshot.phase && snapshot.teams && snapshot.phase !== "setup") {
          setSnapshotToRestore(snapshot);
          setShowRestoreDialog(true);
        }
      }
    } catch {
      // Silently ignore malformed snapshots
      localStorage.removeItem("seen-jeem-active-game-v1");
    }
  }, []);

  const handleRestore = () => {
    if (snapshotToRestore) {
      dispatch({ type: "RESTORE_GAME", state: snapshotToRestore });
      setShowRestoreDialog(false);
      setSnapshotToRestore(null);
    }
  };

  const handleNewGame = () => {
    localStorage.removeItem("seen-jeem-active-game-v1");
    setShowRestoreDialog(false);
    setSnapshotToRestore(null);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [state.phase, state.active?.cellId]);

  const showFooter = state.phase === "setup" || state.phase === "results";

  return (
    <>
      <main dir="rtl" className="min-h-screen">
        {state.phase === "setup" && <Setup />}
        {state.phase === "board" && <Board />}
        {state.phase === "question" && <QuestionView />}
        {state.phase === "results" && <Results />}
        {showFooter && (
          <footer className="pb-6 text-center text-[11px] font-semibold text-muted-foreground 2xl:text-base">
            نسخة منتصر المحسنة
          </footer>
        )}
      </main>

      {/* Restore game dialog */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent dir="rtl" className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>وجدنا لعبة غير مكتملة</AlertDialogTitle>
            <AlertDialogDescription>
              {snapshotToRestore && (
                <>
                  اللعبة: <span className="font-bold text-foreground">{snapshotToRestore.gameName}</span>
                  <br />
                  {snapshotToRestore.teams[0].name}: {snapshotToRestore.teams[0].score} نقطة
                  <br />
                  {snapshotToRestore.teams[1].name}: {snapshotToRestore.teams[1].score} نقطة
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogAction onClick={handleRestore}>
              متابعة اللعبة
            </AlertDialogAction>
            <AlertDialogCancel onClick={handleNewGame}>
              بدء لعبة جديدة
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
