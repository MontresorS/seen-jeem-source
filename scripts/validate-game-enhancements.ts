import fs from "node:fs";
import path from "node:path";
import { CATEGORIES } from "../client/src/data/questions";
import { LIAR_QUESTIONS, TILE_PUZZLE_QUESTIONS } from "../client/src/data/newModes";
import { LIFELINES, initialState, isValidSetup, nextTeamIndex, reducer } from "../client/src/game/state";
import { buildTilePuzzleState, revealNextTile } from "../client/src/game/Question";

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

  for (const round of TILE_PUZZLE_QUESTIONS) {
    assert(round.image?.startsWith("./images/"), `tilepuzzle round ${round.id} must use local ./images asset`);
    const absolutePath = path.resolve(repoRoot, "client/public", round.image!.replace("./", ""));
    assert(fs.existsSync(absolutePath), `tilepuzzle round ${round.id} image file missing: ${round.image}`);
    assert(Boolean(round.sourceQuestionId), `tilepuzzle round ${round.id} must keep sourceQuestionId`);
  }

  const tileState = buildTilePuzzleState("tilepuzzle-01");
  assert(tileState.order.length === 9, "tile puzzle must always generate 9 tiles");
  assert(
    tileState.initialRevealed.length >= 1 && tileState.initialRevealed.length <= 2,
    "tile puzzle initial reveal must be 1 or 2",
  );
  const afterOneReveal = revealNextTile(tileState.order, tileState.initialRevealed);
  assert(
    afterOneReveal.length === tileState.initialRevealed.length + 1,
    "tile puzzle reveal control must reveal exactly one tile per press",
  );
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
