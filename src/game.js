// Shared by local play and the authoritative room server. Never trust client scores.
export const ROUND_COUNT = 5;
export const POINTS = Object.freeze({ win: 3, draw: 1, loss: 0 });
export const LOCATIONS = Object.freeze([
  Object.freeze({ id: 'rooftop', name: 'Rooftop', label: 'RISE ABOVE THE NOISE', beats: 'dancefloor',
    description: 'Trade the crowd for a skyline.', hint: 'The rooftop escape beats the party.' }),
  Object.freeze({ id: 'dancefloor', name: 'Dancefloor', label: 'BRING THE ENERGY', beats: 'cafe',
    description: 'Turn a quiet night all the way up.', hint: 'The party pulls you out of the café.' }),
  Object.freeze({ id: 'cafe', name: 'Café', label: 'TAKE THE NIGHT SLOW', beats: 'rooftop',
    description: 'A warm corner. A better read.', hint: 'The cozy café beats the chilly rooftop.' }),
]);

export const locationById = id => LOCATIONS.find(location => location.id === id);
export const counterTo = id => LOCATIONS.find(location => location.beats === id);

function requirePhase(state, phase) {
  if (state.phase !== phase) throw new Error(`This action requires the ${phase} phase.`);
}

export function createGame(names = ['Player 1', 'Player 2']) {
  if (!Array.isArray(names) || names.length !== 2) throw new Error('Exactly two players are required.');
  const players = names.map((name, index) => ({
    name: String(name).trim().slice(0, 20) || `Player ${index + 1}`, score: 0,
  }));
  if (players[0].name.toLocaleLowerCase() === players[1].name.toLocaleLowerCase()) {
    throw new Error('Choose different names so you can tell the scores apart.');
  }
  return { players, round: 1, phase: 'handoff', activePlayer: 0, choices: [null, null], history: [] };
}

export function beginTurn(state) {
  requirePhase(state, 'handoff');
  return { ...state, phase: 'choose' };
}

export function lockChoice(state, locationId) {
  requirePhase(state, 'choose');
  if (!LOCATIONS.some(location => location.id === locationId)) throw new Error('Choose a valid location.');
  if (state.choices[state.activePlayer] !== null) throw new Error('This player has already chosen.');
  const choices = [...state.choices];
  choices[state.activePlayer] = locationId;
  const nextPlayer = choices.findIndex(choice => choice === null);
  // Both choices are revealed together, after the handoff and second turn.
  return { ...state, choices, phase: nextPlayer === -1 ? 'ready' : 'handoff',
    activePlayer: nextPlayer === -1 ? null : nextPlayer };
}

export function scoreChoices(choices) {
  if (!Array.isArray(choices) || choices.length !== 2 || choices.some(id => !LOCATIONS.some(l => l.id === id))) {
    throw new Error('Two valid choices are required to score a round.');
  }
  if (choices[0] === choices[1]) return [POINTS.draw, POINTS.draw];
  // Each move wins one matchup and loses one: no destination dominates another.
  return locationById(choices[0]).beats === choices[1]
    ? [POINTS.win, POINTS.loss] : [POINTS.loss, POINTS.win];
}

export function revealRound(state) {
  requirePhase(state, 'ready');
  const points = scoreChoices(state.choices);
  return { ...state, phase: state.round === ROUND_COUNT ? 'finished' : 'results',
    players: state.players.map((player, index) => ({ ...player, score: player.score + points[index] })),
    history: [...state.history, { round: state.round, choices: [...state.choices], points }],
  };
}

export function nextRound(state) {
  requirePhase(state, 'results');
  const round = state.round + 1;
  // Alternate who holds the device first each round.
  return { ...state, round, phase: 'handoff', activePlayer: (round - 1) % 2, choices: [null, null] };
}

export function winnerIndex(state) {
  requirePhase(state, 'finished');
  if (state.players[0].score === state.players[1].score) return null;
  return state.players[0].score > state.players[1].score ? 0 : 1;
}
