import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, beginTurn, lockChoice, scoreChoices, revealRound, nextRound, winnerIndex } from '../src/game.js';
import { escapeHtml, handoffScreen, readyScreen } from '../src/ui.js';

function playRound(state, choices) {
  let next = state;
  for (let i = 0; i < 2; i++) {
    next = beginTurn(next);
    next = lockChoice(next, choices[next.activePlayer]);
  }
  return revealRound(next);
}

test('all nine location matchups award the agreed points', () => {
  const cases = [
    ['rooftop', 'rooftop', [1, 1]], ['rooftop', 'dancefloor', [3, 0]], ['rooftop', 'cafe', [0, 3]],
    ['dancefloor', 'rooftop', [0, 3]], ['dancefloor', 'dancefloor', [1, 1]], ['dancefloor', 'cafe', [3, 0]],
    ['cafe', 'rooftop', [3, 0]], ['cafe', 'dancefloor', [0, 3]], ['cafe', 'cafe', [1, 1]],
  ];
  for (const [a, b, expected] of cases) assert.deepEqual(scoreChoices([a, b]), expected);
});

test('complete match alternates first picker and declares the correct winner', () => {
  let game = createGame(['Alex', 'Sam']);
  for (let round = 1; round <= 5; round++) {
    assert.equal(game.activePlayer, (round - 1) % 2);
    game = playRound(game, ['rooftop', 'cafe']);
    if (round < 5) game = nextRound(game);
  }
  assert.equal(game.phase, 'finished');
  assert.deepEqual(game.players.map(p => p.score), [0, 15]);
  assert.equal(winnerIndex(game), 1);
  assert.equal(game.history.length, 5);
  assert.throws(() => nextRound(game));
  assert.throws(() => revealRound(game));
});

test('ties finish as a draw; restarting resets scores and history', () => {
  let game = createGame();
  for (let i = 0; i < 5; i++) {
    game = playRound(game, ['dancefloor', 'dancefloor']);
    if (i < 4) game = nextRound(game);
  }
  assert.equal(winnerIndex(game), null);
  const restarted = createGame(game.players.map(p => p.name));
  assert.deepEqual(restarted.players.map(p => p.score), [0, 0]);
  assert.equal(restarted.round, 1);
  assert.deepEqual(restarted.history, []);
});

test('out-of-turn actions fail and scores remain unchanged before reveal', () => {
  const initial = createGame();
  assert.throws(() => lockChoice(initial, 'rooftop'));
  assert.throws(() => revealRound(initial));
  const choosing = beginTurn(initial);
  assert.throws(() => lockChoice(choosing, 'unknown'));
  const firstLocked = lockChoice(choosing, 'rooftop');
  assert.equal(firstLocked.phase, 'handoff');
  assert.equal(firstLocked.activePlayer, 1);
  assert.deepEqual(firstLocked.players.map(p => p.score), [0, 0]);
  assert.deepEqual(initial.choices, [null, null]);
  assert.throws(() => lockChoice(firstLocked, 'cafe'));
  const ready = lockChoice(beginTurn(firstLocked), 'cafe');
  assert.equal(ready.phase, 'ready');
  const results = revealRound(ready);
  assert.throws(() => revealRound(results));
});

test('handoff and pre-reveal markup do not disclose the locked location', () => {
  const game = lockChoice(beginTurn(createGame(['Alex', 'Sam'])), 'rooftop');
  assert.doesNotMatch(handoffScreen(game), /rooftop/i);
  assert.doesNotMatch(readyScreen(), /rooftop/i);
});

test('names normalize, length is bounded, and player text is escaped', () => {
  assert.equal(createGame(['   ', 'Sam']).players[0].name, 'Player 1');
  assert.equal(createGame(['a'.repeat(40), 'Sam']).players[0].name.length, 20);
  assert.throws(() => createGame([' Alex ', 'alex']));
  assert.throws(() => createGame(['Alex']));
  assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
});
