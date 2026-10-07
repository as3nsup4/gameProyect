import { LOCATIONS, POINTS, ROUND_COUNT, locationById, counterTo, winnerIndex } from './game.js';

export const escapeHtml = value => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const iconPaths = {
  rooftop: '<path d="m4 11 8-7 8 7M6 10v10h12V10M10 20v-6h4v6"/>',
  dancefloor: '<path d="M9 18V5l11-2v13M9 9l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  cafe: '<path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5ZM16 9h2a3 3 0 1 1 0 6h-2M7 3v2M11 3v2M3 22h16"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  spark: '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"/>',
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.spark}</svg>`;
}

export function locationCards({ selectable = false, selected = null } = {}) {
  return LOCATIONS.map((location, index) => {
    const tag = selectable ? 'button' : 'article';
    const heading = selectable ? 'span' : 'h3';
    const beats = locationById(location.beats).name;
    const loses = counterTo(location.id).name;
    const attributes = selectable ? `type="button" data-choice="${location.id}" aria-pressed="${selected === location.id}" aria-label="${location.name}: beats ${beats}, loses to ${loses}"` : '';
    return `<${tag} ${attributes} class="location ${location.id} ${selected === location.id ? 'selected' : ''}">
      <span class="location-top"><span class="location-icon">${icon(location.id)}</span><span class="location-number">0${index + 1}</span></span>
      <span class="eyebrow">${location.label}</span><${heading} class="location-title">${location.name}</${heading}><span class="location-description">${location.description}</span>
      <span class="payoffs"><span>Beats ${beats}<b>+${POINTS.win}</b></span><span>Same destination<b>+${POINTS.draw}</b></span><span>Loses to ${loses}<b>+${POINTS.loss}</b></span></span>
      <span class="location-hint">${location.hint}</span></${tag}>`;
  }).join('');
}

export function shell(content, game) {
  const online = game?.mode === 'online';
  const hasScores = game?.players?.length === 2 && !['closed', 'connecting'].includes(game.phase);
  return `<div class="page-shell"><header class="site-header">
    <a class="brand" href="/" aria-label="Crowd Shift home"><span class="brand-mark" aria-hidden="true"><i></i><i></i></span>CROWD SHIFT<span class="edition"> / 1.0</span></a>
    <div class="header-actions"><span class="mode-label">${online ? 'ROOM PLAY' : 'THE SOCIAL DUEL'}</span><button class="text-button" data-action="rules">How to play <span aria-hidden="true">?</span></button></div></header>
    <p id="connection-status" class="connection-status" role="status" hidden></p>
    <p id="action-error" class="action-error" role="alert" hidden></p>
    <main id="main-content">${online && !['closed', 'connecting'].includes(game.phase) ? roomBar(game) : ''}${hasScores ? scoreboard(game) : ''}${content}</main>
    <footer><span>A LITTLE STRATEGY. A LITTLE SECOND-GUESSING.</span><span>2 PLAYERS <span aria-hidden="true">/</span> ${ROUND_COUNT} ROUNDS <span aria-hidden="true">/</span> ONE GOOD READ</span></footer></div>
    <dialog id="rules-dialog" aria-labelledby="rules-title"><div class="dialog-body"><p class="eyebrow">THE QUICK VERSION</p><h2 id="rules-title">Every move has a counter.</h2><p>Think of rock, paper, scissors as a night out. Predict their destination and pick the place that beats it.</p>
    <div class="rules-scores">${LOCATIONS.map(l => `<p><b>${l.name}</b><span>beats ${locationById(l.beats).name}</span></p>`).join('')}</div>
    <p><b>Win +${POINTS.win} · Match +${POINTS.draw} each · Lose +${POINTS.loss}</b></p>
    <ol><li>Choose a destination in secret. You can change your mind until you lock it.</li><li>In a room, both people choose on their own devices. The reveal happens when both moves are locked.</li><li>On a shared device, look away during the other player’s turn and pass when prompted.</li><li>Most points after ${ROUND_COUNT} rounds wins. Equal totals are a draw. In rooms, both players must be ready to advance or rematch.</li></ol>
    <p class="muted">Room play can resume after a refresh in this tab. Local matches reset on refresh. No accounts, ads, or tracking.</p><button class="primary full" data-action="close-rules">Got it</button></div></dialog>
    <dialog id="exit-dialog" aria-labelledby="exit-title"><div class="dialog-body"><h2 id="exit-title">Leave this game?</h2><p>${online ? 'Leaving closes the room for both players.' : 'Your current scores and round will be lost.'}</p><div class="dialog-actions"><button class="secondary" data-action="close-exit">Keep playing</button><button class="primary" data-action="exit">Leave game</button></div></div></dialog>`;
}

export function setupScreen({ mode = 'local', code = '' } = {}) {
  const local = mode === 'local';
  const fields = local ? `<label for="player-one"><span class="player-dot player-0"></span>Player one</label><input id="player-one" name="playerOne" maxlength="20" placeholder="Player 1" autocomplete="off" spellcheck="false">
    <label for="player-two"><span class="player-dot player-1"></span>Player two</label><input id="player-two" name="playerTwo" maxlength="20" placeholder="Player 2" autocomplete="off" spellcheck="false">`
    : `<label for="your-name">Your name</label><input id="your-name" name="name" maxlength="20" placeholder="${mode === 'create' ? 'Player 1' : 'Player 2'}" autocomplete="off" spellcheck="false">
    ${mode === 'join' ? `<label for="room-code">Room code</label><input id="room-code" name="code" class="code-input" maxlength="6" minlength="6" required placeholder="ABC123" value="${escapeHtml(code)}" autocomplete="off" autocapitalize="characters" spellcheck="false">` : '<p class="room-explainer">Create a private table, then share its six-character code with a friend.</p>'}`;
  return `<section class="intro"><div class="intro-copy"><p class="eyebrow intro-kicker"><span class="tiny-cross" aria-hidden="true">✳</span> A TWO-PLAYER GAME OF SECOND GUESSES</p>
    <h1>Read the room.<br><span>Make your move.</span></h1><p class="intro-description">Three destinations. Every move has a counter.<br>Where do you think they’re going?</p><div class="game-facts"><span>2 players</span><span>~3 minutes</span><span>5 rounds</span></div></div>
    <section class="setup-panel" aria-labelledby="setup-title"><div class="panel-title"><h2 id="setup-title">Bring a friend.</h2><span class="pill">NO SIGN-UP</span></div>
    <div class="mode-picker" role="group" aria-label="How do you want to play?">${[['local', 'Same device'], ['create', 'Create room'], ['join', 'Join room']].map(([id, label]) => `<button type="button" data-mode="${id}" aria-pressed="${mode === id}">${label}</button>`).join('')}</div>
    <p class="muted">${local ? 'Two people, one screen. Take turns in secret.' : mode === 'create' ? 'Two screens. One shared match.' : 'Enter the code your friend shared.'}</p>
    <form id="start-form">${fields}<p id="form-error" class="form-error" role="alert"></p><button class="primary full start-button" type="submit">${local ? 'Let’s play' : mode === 'create' ? 'Create room' : 'Join room'} <span aria-hidden="true">↗</span></button><p class="setup-note">${local ? 'Pass, predict, reveal. No peeking.' : 'Both players open the same website.'}</p></form></section></section>
    <section class="locations-section" aria-labelledby="locations-title"><div class="section-heading"><div><p class="eyebrow">LEARN THE LOOP</p><h2 id="locations-title">One beats one. One beats you.</h2></div><p>Win +3 · Match +1 each · Lose +0</p></div><div class="location-grid">${locationCards()}</div><p class="bottom-tip">Rooftop beats Dancefloor. Dancefloor beats Café. Café beats Rooftop. Keep them guessing.</p></section>`;
}

function scoreboard(game) {
  return `<section class="scoreboard" aria-label="Match score">${game.players.map((p, index) => `<div class="score-player"><span class="player-token player-${index}">${index + 1}</span><span class="score-name">${escapeHtml(p.name)}${game.mode === 'online' && game.you === index ? '<small class="you-label">YOU</small>' : ''}</span><strong>${p.score}<small>PTS</small></strong></div>`).join('')}
    <div class="round-tracker"><span>ROUND <b>${String(game.round).padStart(2, '0')}</b> / 0${ROUND_COUNT}</span><div class="round-dots" aria-hidden="true">${Array.from({ length: ROUND_COUNT }, (_, i) => `<i class="${i < game.round ? 'filled' : ''}"></i>`).join('')}</div></div></section>`;
}

function roomBar(game) {
  return `<div class="room-bar"><span>ROOM <b>${game.code}</b></span><span id="opponent-status" role="status"></span><button class="text-button" data-action="copy-code">Copy code</button></div>`;
}

export function lobbyScreen(game, link) {
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(link).hostname);
  return `<section class="interlude lobby"><div class="large-symbol reveal-symbol">${icon('spark')}</div><p class="eyebrow">YOUR TABLE IS READY</p><h1 data-focus>Make room<br>for a <span>friend.</span></h1><p>Share this code. Your match starts when they join.</p><p class="lobby-code">${game.code}</p>
    <label for="invite-link">Invitation link</label><input id="invite-link" value="${escapeHtml(link)}" readonly><button class="primary" data-action="copy-link">Copy invitation link</button>
    ${loopback ? '<p class="privacy-note">This address works on this computer only. For a second device, start with <code>node server.mjs --lan</code> and open the same-network link printed in the terminal. Create the room from that link.</p>' : '<p class="privacy-note">Your friend can also choose Join room and enter the code.</p>'}</section>${leaveButton()}`;
}

export function connectingScreen() {
  return `<section class="interlude"><div class="large-symbol reveal-symbol">${icon('spark')}</div><h1 data-focus>Finding your table…</h1><p>Restoring your seat and saved moves.</p><button class="secondary" data-action="exit">Back to start</button></section>`;
}

export function closedScreen(reason) {
  return `<section class="interlude"><div class="large-symbol reveal-symbol">${icon('lock')}</div><h1 data-focus>Until next time.</h1><p>${escapeHtml(reason)}</p><button class="primary" data-action="exit">Back to start</button></section>`;
}

export function handoffScreen(game) {
  const name = escapeHtml(game.players[game.activePlayer].name);
  const second = game.choices.some(choice => choice !== null);
  return `<section class="interlude"><div class="large-symbol player-${game.activePlayer}">${icon('lock')}</div><p class="eyebrow">${second ? 'FIRST MOVE LOCKED. YOUR TURN.' : 'A FRESH ROUND. A FRESH READ.'}</p><h1 tabindex="-1" data-focus>Pass to <span>${name}.</span></h1><p>Everyone else, look away.<br>Your next move is just for you.</p><button class="primary" data-action="begin">I’m ${name} — ready</button><p class="muted privacy-note">Both choices stay hidden until the reveal.</p></section>${leaveButton()}`;
}

export function choiceScreen(game, selected = null) {
  const you = game.mode === 'online' ? game.you : game.activePlayer;
  return `<section class="choice-screen"><div class="section-heading choice-heading"><div><p class="eyebrow">${escapeHtml(game.players[you].name)}’S SECRET MOVE</p><h1 tabindex="-1" data-focus>Where are you headed?</h1></div><p>Win +3 · Match +1 each · Lose +0</p></div><div class="location-grid selectable" role="group" aria-label="Choose a location">${locationCards({ selectable: true, selected })}</div><div class="choice-actions"><p id="selection-status" role="status">${selected ? `${locationById(selected).name} selected. You can still change your mind.` : 'Your move. Select a destination.'}</p><button class="primary" data-action="lock" ${selected ? '' : 'disabled'}>${icon('lock')} Lock my choice</button></div></section>${leaveButton()}`;
}

export function lockedScreen(game) {
  return `<section class="interlude"><div class="large-symbol player-${game.you}">${icon('lock')}</div><p class="eyebrow">NO TAKEBACKS</p><h1 data-focus>Your move<br>is <span>locked.</span></h1><p>You chose <b>${locationById(game.choices[game.you]).name}</b>.<br>Waiting for ${escapeHtml(game.players[1 - game.you].name)} to lock in.</p><p class="privacy-note">Their choice stays secret. The reveal happens automatically.</p></section>${leaveButton()}`;
}

export function readyScreen() {
  return `<section class="interlude"><div class="large-symbol reveal-symbol">${icon('spark')}</div><p class="eyebrow">TWO CHOICES. NO TAKEBACKS.</p><h1 tabindex="-1" data-focus>The moment<br>of <span>truth.</span></h1><p>Bring both players back to the screen.<br>Let’s see who read the room.</p><button class="primary" data-action="reveal">Reveal our moves <span aria-hidden="true">✳</span></button></section>${leaveButton()}`;
}

export function resultScreen(game) {
  const last = game.history.at(-1);
  const finished = game.phase === 'finished';
  const winner = finished ? winnerIndex(game) : null;
  const tiedRound = last.choices[0] === last.choices[1];
  const roundWinner = last.points[0] > last.points[1] ? 0 : 1;
  const title = finished ? winner === null ? 'It’s a draw.' : `${escapeHtml(game.players[winner].name)} wins.` : tiedRound ? 'Same wavelength.' : `${escapeHtml(game.players[roundWinner].name)} read the room.`;
  const explanation = tiedRound ? `You both chose ${locationById(last.choices[0]).name}. One point each.` : `${locationById(last.choices[roundWinner]).name} beats ${locationById(last.choices[1 - roundWinner]).name}. Three points for the winning move.`;
  const online = game.mode === 'online';
  const waiting = online && game.ready[game.you];
  const nextLabel = waiting ? `Waiting for ${escapeHtml(game.players[1 - game.you].name)}…` : finished ? 'Play again' : `Next round · ${game.round + 1} / ${ROUND_COUNT}`;
  return `<section class="results"><div class="results-heading"><p class="eyebrow">${finished ? 'THAT’S A WRAP' : `ROUND ${game.round} · THE REVEAL`}</p><h1 tabindex="-1" data-focus>${title}</h1><p>${explanation}</p></div>
    <div class="result-grid">${game.players.map((p, i) => {
      const location = locationById(last.choices[i]);
      return `<article class="result-card ${location.id}"><div class="result-person"><span class="player-token player-${i}">${i + 1}</span><b>${escapeHtml(p.name)}</b>${finished && winner !== null ? `<span class="pill ${winner === i ? 'winner-pill' : ''}">${winner === i ? 'WINNER' : '2ND PLACE'}</span>` : ''}</div><div class="result-location">${icon(location.id)}<h2>${location.name}</h2></div><div class="points-line"><strong>+${last.points[i]}</strong><span>${tiedRound ? 'matched' : roundWinner === i ? 'won' : 'lost'} this round</span><b>${p.score} <small>TOTAL</small></b></div></article>`;
    }).join('')}</div><div class="results-actions"><button class="primary" data-action="${finished ? 'rematch' : 'next'}" ${waiting ? 'disabled' : ''}>${nextLabel}</button>${finished && !online ? '<button class="text-button" data-action="exit">Change players</button>' : ''}</div>
    ${online ? '<p class="ready-note">Both players choose when to continue. Take a moment to read the round.</p>' : ''}
    <details class="round-history" ${finished ? 'open' : ''}><summary>Round history <span>${game.history.length} / ${ROUND_COUNT}</span></summary><div class="table-scroll"><table><caption class="sr-only">Destinations and points awarded each round</caption><thead><tr><th>Round</th>${game.players.map(p => `<th>${escapeHtml(p.name)}</th>`).join('')}</tr></thead><tbody>${game.history.map(round => `<tr><th>${round.round}</th>${round.choices.map((id, i) => `<td>${locationById(id).name} <b>+${round.points[i]}</b></td>`).join('')}</tr>`).join('')}</tbody></table></div></details></section>${finished && !online ? '' : leaveButton()}`;
}

function leaveButton() { return '<div class="leave-row"><button class="text-button muted" data-action="confirm-exit">Leave game</button></div>'; }
