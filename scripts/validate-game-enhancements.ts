import fs from "node:fs";
import path from "node:path";
import { CATEGORIES } from "../client/src/data/questions";
import { LIAR_QUESTIONS, TILE_PUZZLE_QUESTIONS } from "../client/src/data/newModes";
import { LIFELINES, initialState, isValidSetup, nextTeamIndex, reducer } from "../client/src/game/state";
import {
  applyTilePuzzleFixHint,
  buildTilePuzzleState,
  canSwapTilePositions,
  isTilePuzzleSolved,
  swapTilePositions,
} from "../client/src/game/Question";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function countByPoints(rows: { points: 200 | 400 | 600 }[]) {
  return rows.reduce(
    (acc, row) => {
      acc[row.points] += 1;
      return acc;
    },
    { 200: 0, 400: 0, 600: 0 },
  );
}

function validateSetupRules() {
  assert(isValidSetup(2, 6), "2-team setup must allow 6 categories");
  assert(isValidSetup(2, 9), "2-team setup must allow 9 categories");
  assert(isValidSetup(2, 12), "2-team setup must allow 12 categories");
  assert(!isValidSetup(2, 8), "2-team setup must reject non 6/9/12 counts");
  assert(isValidSetup(3, 9), "3-team setup must allow exactly 9 categories");
  assert(!isValidSetup(3, 6), "3-team setup must reject non-9 counts");
}

function validateThreeTeamRotationAndScoring() {
  const keys = CATEGORIES.slice(0, 9).map((category) => category.key);
  const started = reducer(initialState, {
    type: "START",
    gameName: "اختبار",
    names: ["أ", "ب", "ج"],
    catKeys: keys,
    teamCount: 3,
  } as any);

  assert(started.phase === "board", "Game should enter board phase after 3-team start");
  assert(started.teams.length === 3, "3-team game should keep 3 teams");

  const opened = reducer(started, { type: "OPEN", cellId: started.cells[0].id } as any);
  assert(opened.phase === "question", "OPEN should move to question phase");

  const resolvedCorrect = reducer(opened, {
    type: "RESOLVE",
    outcome: { kind: "correct", team: 2 },
  } as any);
  assert(resolvedCorrect.teams[2].score > started.teams[2].score, "Correct team must gain points");
  assert(resolvedCorrect.turn === 1, "Turn must rotate from team 0 to team 1 in 3-team mode");

  const openForLifeline = reducer(
    resolvedCorrect,
    { type: "OPEN", cellId: resolvedCorrect.cells.find((cell) => !cell.used)!.id } as any,
  );
  const useChoices2Once = reducer(openForLifeline, { type: "USE_LIFELINE", key: "choices2", team: 1 } as any);
  const useChoices2Twice = reducer(useChoices2Once, { type: "USE_LIFELINE", key: "choices2", team: 1 } as any);
  assert(useChoices2Once.teams[1].used.choices2, "choices2 lifeline should be consumed on first use");
  assert(JSON.stringify(useChoices2Once) === JSON.stringify(useChoices2Twice), "choices2 lifeline must be once-per-team");

  assert(
    nextTeamIndex(0, 3) === 1 && nextTeamIndex(1, 3) === 2 && nextTeamIndex(2, 3) === 0,
    "nextTeamIndex must rotate through 3 teams",
  );
}

function validateTilePuzzleRounds() {
  assert(TILE_PUZZLE_QUESTIONS.length === 50, "tilepuzzle must contain exactly 50 rounds");
  const dist = countByPoints(TILE_PUZZLE_QUESTIONS);
  assert(dist[200] === 17 && dist[400] === 17 && dist[600] === 16, "tilepuzzle points distribution must be 17/17/16");
  const uniqueImages = new Set(TILE_PUZZLE_QUESTIONS.map((round) => round.image));
  assert(uniqueImages.size === TILE_PUZZLE_QUESTIONS.length, "tilepuzzle rounds must use unique local image mappings");
  const uniqueAnswers = new Set(TILE_PUZZLE_QUESTIONS.map((round) => round.a));
  assert(uniqueAnswers.size === TILE_PUZZLE_QUESTIONS.length, "tilepuzzle rounds must use unique answers");

  const tilePuzzleAssetsDir = path.resolve(repoRoot, "client/public/images/tilepuzzle");
  const svgRoundAssets = fs
    .readdirSync(tilePuzzleAssetsDir)
    .filter((entry) => /^tilepuzzle-\d+\.svg$/u.test(entry));
  assert(svgRoundAssets.length === 0, `tilepuzzle assets directory must NOT contain SVG placeholder round files; found: ${svgRoundAssets.join(", ")}`);

  const rasterRoundAssets = fs
    .readdirSync(tilePuzzleAssetsDir)
    .filter((entry) => /^tilepuzzle-\d+\.(png|webp)$/iu.test(entry));
  assert(rasterRoundAssets.length === 50, `tilepuzzle assets directory must contain exactly 50 raster .png/.webp round files; found ${rasterRoundAssets.length}`);

  for (const round of TILE_PUZZLE_QUESTIONS) {
    assert(round.image?.startsWith("./images/tilepuzzle/"), `tilepuzzle round ${round.id} must use dedicated tilepuzzle assets`);
    assert(/\.(png|webp)$/i.test(round.image ?? ""), `tilepuzzle round ${round.id} image must be .png or .webp, not SVG`);
    assert(!round.image?.includes("/logos/"), `tilepuzzle round ${round.id} must not reuse logos assets`);
    assert(!round.image?.includes("/zoom/"), `tilepuzzle round ${round.id} must not reuse zoom assets`);
    assert(!round.image?.includes("/wadda7/"), `tilepuzzle round ${round.id} must not reuse wadda7 assets`);
    assert(!("sourceQuestionId" in round), `tilepuzzle round ${round.id} must not reference sourceQuestionId`);
    const absolutePath = path.resolve(repoRoot, "client/public", round.image!.replace("./", ""));
    assert(fs.existsSync(absolutePath), `tilepuzzle round ${round.id} image file missing: ${round.image}`);
  }

  const tierExpectations: Record<200 | 400 | 600, { locked: number; hints: number }> = {
    200: { locked: 3, hints: 2 },
    400: { locked: 1, hints: 1 },
    600: { locked: 0, hints: 0 },
  };

  ([200, 400, 600] as const).forEach((points) => {
    const tileState = buildTilePuzzleState(`tilepuzzle-state-${points}`, points);
    assert(tileState.tiles.length === 9, "tile puzzle must always generate 9 tiles");
    assert(tileState.lockedPositions.length === tierExpectations[points].locked, `tile puzzle ${points} must lock expected tiles`);
    assert(tileState.hintAllowance === tierExpectations[points].hints, `tile puzzle ${points} must expose expected hints`);
    assert(!isTilePuzzleSolved(tileState.tiles), `tile puzzle ${points} scramble must not start solved`);

    const fixedCount = tileState.tiles.filter((tile, position) => tile === position).length;
    assert(fixedCount === tierExpectations[points].locked, `tile puzzle ${points} must start with exact fixed-tile count`);

    const firstUnlocked = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((position) => !tileState.lockedPositions.includes(position));
    const secondUnlocked = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(
      (position) => position !== firstUnlocked && !tileState.lockedPositions.includes(position),
    );
    assert(firstUnlocked !== undefined && secondUnlocked !== undefined, "tile puzzle must have swappable unlocked tiles");
    assert(canSwapTilePositions(tileState.lockedPositions, firstUnlocked, secondUnlocked), "unlocked tiles must be swappable");
    const swapped = swapTilePositions(tileState.tiles, firstUnlocked, secondUnlocked);
    assert(
      swapped[firstUnlocked] === tileState.tiles[secondUnlocked] && swapped[secondUnlocked] === tileState.tiles[firstUnlocked],
      "two-tile swap must exchange positions",
    );

    if (tileState.lockedPositions.length > 0) {
      const locked = tileState.lockedPositions[0];
      assert(!canSwapTilePositions(tileState.lockedPositions, locked, firstUnlocked), "locked tile must be non-swappable");
    }

    if (tierExpectations[points].hints > 0) {
      const hinted = applyTilePuzzleFixHint(tileState.tiles, tileState.lockedPositions);
      assert(hinted !== null, `tile puzzle ${points} should allow fix hint`);
      const newestLock = hinted.lockedPositions[hinted.lockedPositions.length - 1];
      assert(hinted.tiles[newestLock] === newestLock, `tile puzzle ${points} fix hint must lock a correct tile`);
    }
  });

  assert(isTilePuzzleSolved([0, 1, 2, 3, 4, 5, 6, 7, 8]), "tile puzzle completion detection must detect solved board");
}

function validateLiarRounds() {
  assert(LIAR_QUESTIONS.length === 50, "liar mode must contain exactly 50 rounds");
  const dist = countByPoints(LIAR_QUESTIONS);
  assert(dist[200] === 17 && dist[400] === 17 && dist[600] === 16, "liar points distribution must be 17/17/16");

  for (const round of LIAR_QUESTIONS) {
    assert(round.choices?.length === 3, `liar round ${round.id} must contain exactly three statements`);
    assert(round.correctChoices?.length === 1, `liar round ${round.id} must contain exactly one false statement`);
    assert(round.choices!.some((choice) => choice.startsWith("أ)")), `liar round ${round.id} missing statement أ`);
    assert(round.choices!.some((choice) => choice.startsWith("ب)")), `liar round ${round.id} missing statement ب`);
    assert(round.choices!.some((choice) => choice.startsWith("ج)")), `liar round ${round.id} missing statement ج`);
    assert(round.choices!.includes(round.correctChoices![0]), `liar round ${round.id} correct choice must be in statements`);
  }
}

function validateLifelineInventory() {
  assert(LIFELINES.some((lifeline) => lifeline.key === "choices2"), "choices2 lifeline must exist");
}

function main() {
  validateSetupRules();
  validateThreeTeamRotationAndScoring();
  validateTilePuzzleRounds();
  validateLiarRounds();
  validateLifelineInventory();
  console.log("validate-game-enhancements: OK");
}

main();
