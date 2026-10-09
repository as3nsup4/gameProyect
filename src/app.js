import { createGame, beginTurn, lockChoice, revealRound, nextRound, locationById } from './game.js';
import { shell, setupScreen, handoffScreen, choiceScreen, readyScreen, resultScreen,
  lobbyScreen, lockedScreen, connectingScreen, closedScreen } from './ui.js';
import { RoomConnection, enterRoom, savedSession, saveSession, invitedCode, setRoomUrl, invitation, pendingEntryDraft } from './network.js';

const app = document.querySelector('#app');
let invite = invitedCode();
const pendingDraft = pendingEntryDraft();
let setupMode = invite ? 'join' : pendingDraft?.mode || 'create';
const setupDraft = { name: pendingDraft?.name || '', code: invite || pendingDraft?.code || '', playerOne: '', playerTwo: '' };
let game = null;
let selected = null;
let connection = null;
let connected = true;
let busy = false;
let notice = '';
let dialogTrigger = null;

function screenKey(state) {
  return state ? `${state.match || 0}:${state.round}:${state.phase}:${state.mode === 'online' ? state.locked?.[state.you] : state.activePlayer}` : 'setup';
}

function render({ focusHeading = true } = {}) {
  const openDialogId = app.querySelector('dialog[open]')?.id;
  const historyOpen = app.querySelector('.round-history')?.open;
  const historyFocused = document.activeElement?.matches('.round-history > summary');
  const focusedAction = document.activeElement?.dataset?.action;
  const focusedChoice = document.activeElement?.dataset?.choice;
  let content;
  if (!game) content = setupScreen({ ...setupDraft, mode: setupMode });
  else if (game.mode === 'online') {
    switch (game.phase) {
      case 'connecting': content = connectingScreen(); break;
      case 'waiting': content = lobbyScreen(game, invitation(game.code)); break;
      case 'closed': content = closedScreen(game.reason); break;
      case 'choose': content = game.locked[game.you] ? lockedScreen(game) : choiceScreen(game, selected); break;
      default: content = resultScreen(game);
    }
  } else {
    switch (game.phase) {
      case 'handoff': content = handoffScreen(game); break;
      case 'choose': content = choiceScreen(game, selected); break;
      case 'ready': content = readyScreen(); break;
      default: content = resultScreen(game);
    }
  }
  // Replacing the DOM removes a local player's secret screen before handoff.
  app.innerHTML = shell(content, game);
  updateStatus();
  updateControls();
  if (!focusHeading && historyOpen && app.querySelector('.round-history')) app.querySelector('.round-history').open = true;
  if (openDialogId && game?.phase !== 'closed') document.getElementById(openDialogId)?.showModal();
  else if (focusHeading) {
    const heading = app.querySelector('[data-focus]') || app.querySelector('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  } else {
    // A friend's ready signal should not steal keyboard focus or clear a selection.
    const target = focusedChoice ? app.querySelector(`[data-choice="${focusedChoice}"]`) : focusedAction ? app.querySelector(`[data-action="${focusedAction}"]`) : historyFocused ? app.querySelector('.round-history > summary') : null;
    target?.focus({ preventScroll: true });
  }
  app.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => {
    const trigger = dialogTrigger === 'brand' ? app.querySelector('.brand') : app.querySelector(`[data-action="${dialogTrigger}"]`);
    trigger?.focus();
  }));
}

function updateStatus() {
  const status = document.querySelector('#connection-status');
  const reconnecting = game?.mode === 'online' && game.phase !== 'closed' && !connected;
  status.hidden = !reconnecting;
  status.textContent = reconnecting ? 'Connection interrupted. Reconnecting to your room…' : '';
  const error = document.querySelector('#action-error');
  error.hidden = !notice;
  error.textContent = notice;
  const opponent = document.querySelector('#opponent-status');
  if (opponent && game?.mode === 'online') {
    const friend = game.players[1 - game.you];
    opponent.textContent = !friend ? 'Waiting for a friend' : !friend.connected ? `${friend.name} is reconnecting` : game.phase === 'choose' && game.locked[1 - game.you] ? `${friend.name} locked in` : `${friend.name} is here`;
  }
}

function updateControls() {
  app.querySelectorAll('[data-mode], #start-form button, #start-form input, [data-choice]').forEach(button => { button.disabled = busy; });
  for (const action of ['lock', 'next', 'rematch', 'begin', 'reveal', 'exit']) {
    const button = app.querySelector(`[data-action="${action}"]`);
    if (!button) continue;
    const roomAction = game?.mode === 'online' && ['lock', 'next', 'rematch'].includes(action);
    button.disabled = busy || (action === 'lock' && !selected) ||
      (roomAction && (!connected || (action !== 'lock' && game.ready?.[game.you])));
  }
  app.querySelector('#start-form')?.setAttribute('aria-busy', String(busy));
}

function showNotice(message) { notice = message; updateStatus(); }

function openDialog(id, trigger) {
  dialogTrigger = trigger.classList.contains('brand') ? 'brand' : trigger.dataset.action;
  document.getElementById(id).showModal();
}

function connectRoom(session, initialState) {
  connection?.stop();
  saveSession(session);
  setRoomUrl(session.code);
  selected = null;
  notice = '';
  connected = true;
  game = initialState || { mode: 'online', phase: 'connecting', players: [], code: session.code, round: 1 };
  render();
  connection = new RoomConnection(session, {
    onState(next) {
      const changed = next.revision !== game?.revision;
      const viewChanged = screenKey(game) !== screenKey(next);
      if (viewChanged) { selected = null; notice = ''; }
      game = next;
      if (game.phase === 'closed') { connection.stop(); saveSession(null); }
      if (changed || viewChanged) render({ focusHeading: viewChanged });
      else updateStatus();
    },
    onConnection(value) { connected = value; updateStatus(); updateControls(); },
    onFatal(message) {
      saveSession(null);
      game = { ...game, phase: 'closed', reason: message };
      notice = '';
      busy = false;
      render();
    },
  });
  connection.poll();
}

async function leave() {
  busy = true;
  updateControls();
  let leftWhileOffline = false;
  if (connection && game?.mode === 'online' && game.phase !== 'closed') {
    try { await connection.act('leave', game); }
    catch { leftWhileOffline = true; }
  }
  connection?.stop();
  connection = null;
  saveSession(null);
  setRoomUrl(null);
  invite = '';
  setupMode = 'create';
  setupDraft.code = '';
  game = null;
  selected = null;
  busy = false;
  connected = true;
  notice = leftWhileOffline ? 'You left on this device. The server could not be reached; the old room will expire when inactive.' : '';
  // Close before rendering setup so an open confirmation cannot survive the exit.
  app.querySelector('dialog[open]')?.close();
  render();
}

app.addEventListener('input', event => {
  if (!game && event.target.closest('#start-form') && Object.hasOwn(setupDraft, event.target.name)) {
    setupDraft[event.target.name] = event.target.value;
  }
});

app.addEventListener('submit', async event => {
  if (event.target.id !== 'start-form') return;
  event.preventDefault();
  if (busy) return;
  const data = new FormData(event.target);
  notice = '';
  document.querySelector('#form-error').textContent = '';
  try {
    if (setupMode === 'local') {
      game = createGame([data.get('playerOne'), data.get('playerTwo')]);
      selected = null;
      render();
    } else {
      busy = true;
      updateControls();
      const session = await enterRoom(setupMode, data.get('name'), data.get('code'));
      busy = false;
      connectRoom(session, session.state);
    }
  } catch (error) {
    document.querySelector('#form-error').textContent = error.status === 0
      ? 'The room service is taking a moment. Check your connection, then try again with the same name and code to recover your seat.'
      : error.message;
  } finally { busy = false; updateControls(); }
});

app.addEventListener('click', async event => {
  const target = event.target.closest('button, .brand');
  if (!target || target.disabled) return;
  if (target.classList.contains('brand') && game) {
    event.preventDefault();
    if (!busy) openDialog('exit-dialog', target);
    return;
  }
  if (target.dataset.mode && !game && !busy) {
    setupMode = target.dataset.mode;
    notice = '';
    render({ focusHeading: false });
    app.querySelector(`[data-mode="${setupMode}"]`)?.focus();
    return;
  }
  if (target.dataset.choice && game?.phase === 'choose' && !busy) {
    selected = target.dataset.choice;
    app.querySelectorAll('[data-choice]').forEach(button => {
      const active = button.dataset.choice === selected;
      button.classList.toggle('selected', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('#selection-status').textContent = `${locationById(selected).name} selected. You can still change your mind.`;
    updateControls();
    return;
  }
  const action = target.dataset.action;
  if (action === 'rules') return openDialog('rules-dialog', target);
  if (action === 'close-rules') return document.querySelector('#rules-dialog').close();
  if (action === 'confirm-exit') return openDialog('exit-dialog', target);
  if (action === 'close-exit') return document.querySelector('#exit-dialog').close();
  if (action === 'copy-code' || action === 'copy-link') {
    const text = action === 'copy-code' ? game.code : invitation(game.code);
    try {
      await navigator.clipboard.writeText(text);
      showNotice(action === 'copy-code' ? 'Room code copied.' : 'Invitation link copied. Send it to your friend.');
    } catch {
      document.querySelector('#invite-link')?.select();
      showNotice(action === 'copy-code' ? `Share this room code: ${game.code}` : 'Copy the invitation link from the selected field.');
    }
    return;
  }
  if (busy) return;
  if (action === 'exit') return leave();
  notice = '';

  if (game?.mode === 'online') {
    if (!['lock', 'next', 'rematch'].includes(action)) return;
    if (action === 'lock' && (!selected || game.locked[game.you])) return;
    busy = true;
    updateStatus();
    updateControls();
    try { await connection.act(action, game, action === 'lock' ? selected : undefined); }
    catch (error) { showNotice(error.message); }
    finally { busy = false; updateControls(); }
    return;
  }

  // Local flow uses the exact same rules and payoff function as room play.
  if (action === 'begin' && game?.phase === 'handoff') game = beginTurn(game);
  else if (action === 'lock' && game?.phase === 'choose' && selected) { game = lockChoice(game, selected); selected = null; }
  else if (action === 'reveal' && game?.phase === 'ready') game = revealRound(game);
  else if (action === 'next' && game?.phase === 'results') game = nextRound(game);
  else if (action === 'rematch' && game?.phase === 'finished') game = createGame(game.players.map(p => p.name));
  else return;
  render();
});

const previous = savedSession();
if (previous && (!invite || previous.code === invite)) connectRoom(previous);
else render({ focusHeading: false });
