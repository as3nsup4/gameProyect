import { randomBytes, randomInt } from 'node:crypto';
import { createGame, lockChoice, revealRound, nextRound } from '../src/game.js';

const IDLE_MS = 60 * 60 * 1000;
const CLOSED_MS = 60 * 1000;
const ONLINE_MS = 15 * 1000;
const MAX_ROOMS = 200;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function nameFor(value, index) {
  if (typeof value !== 'string') throw new RoomError(400, 'Enter a player name.');
  return value.trim().slice(0, 20) || `Player ${index + 1}`;
}

function validateEntryKey(key) {
  // Optional for clients that loaded the previous release before a deployment.
  if (key !== undefined && (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key))) {
    throw new RoomError(400, 'Invalid room entry request. Reload and try again.');
  }
}

function onlineGame(names) {
  return { ...createGame(names), phase: 'choose', activePlayer: null };
}

// All mutations below are synchronous, so two requests cannot score or advance twice.
export function createRoomStore() {
  const rooms = new Map();

  function prune() {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (now - room.touched > (room.closed ? CLOSED_MS : IDLE_MS)) rooms.delete(code);
    }
  }

  function find(code) {
    prune();
    const room = rooms.get(code);
    if (!room) throw new RoomError(404, 'This room has expired or does not exist. Create a new room.');
    return room;
  }

  function member(room, token) {
    const index = room.seats.findIndex(seat => seat.token === token);
    if (index < 0) throw new RoomError(401, 'Your seat could not be restored. Return to the start screen.');
    if (!room.closed) {
      room.seats[index].seen = Date.now();
      room.touched = Date.now();
    }
    return index;
  }

  function snapshot(room, you) {
    const game = room.game;
    const revealed = game && ['results', 'finished'].includes(game.phase);
    // Construct an explicit public view. Never serialize the room or seat objects.
    return {
      mode: 'online', code: room.code, revision: room.revision, match: room.match,
      you, phase: room.closed ? 'closed' : game?.phase || 'waiting',
      reason: room.closed || '', round: game?.round || 1,
      players: room.seats.map((seat, i) => ({ name: seat.name,
        score: game?.players[i].score || 0, connected: Date.now() - seat.seen < ONLINE_MS })),
      choices: game ? game.choices.map((choice, i) => revealed || i === you ? choice : null) : [null, null],
      locked: game ? game.choices.map(Boolean) : [false, false],
      history: game?.history || [], ready: [...room.ready],
    };
  }

  function seat(name, entryKey) { return { name, entryKey, token: randomBytes(32).toString('hex'), seen: Date.now() }; }
  function credentials(room, index) { return { code: room.code, token: room.seats[index].token, state: snapshot(room, index) }; }

  function recoverEntry(room, index, name) {
    if (room.closed) throw new RoomError(410, 'This room has closed. Create a new room.');
    if (room.seats[index].name !== name) throw new RoomError(409, 'This entry belongs to a different player name.');
    member(room, room.seats[index].token);
    return credentials(room, index);
  }

  return {
    create(name, entryKey) {
      validateEntryKey(entryKey);
      const clean = nameFor(name, 0);
      prune();
      if (entryKey) {
        const existing = [...rooms.values()].find(room => room.seats[0].entryKey === entryKey);
        if (existing) return recoverEntry(existing, 0, clean);
      }
      if (rooms.size >= MAX_ROOMS) throw new RoomError(503, 'All tables are busy. Please try again later.');
      let code;
      do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); }
      while (rooms.has(code));
      const room = { code, seats: [seat(clean, entryKey)], game: null, ready: [false, false],
        match: 1, revision: 1, touched: Date.now(), closed: '' };
      rooms.set(code, room);
      return credentials(room, 0);
    },

    join(code, name, entryKey) {
      validateEntryKey(entryKey);
      const room = find(code);
      if (room.closed) throw new RoomError(410, 'This room has closed. Create a new room.');
      const clean = nameFor(name, 1);
      if (entryKey && room.seats[1]?.entryKey === entryKey) return recoverEntry(room, 1, clean);
      if (room.seats.length === 2) throw new RoomError(409, 'This room already has two players.');
      if (room.seats[0].name.toLocaleLowerCase() === clean.toLocaleLowerCase()) {
        throw new RoomError(400, 'Choose a different name from the other player.');
      }
      room.seats.push(seat(clean, entryKey));
      room.game = onlineGame(room.seats.map(player => player.name));
      room.touched = Date.now();
      room.revision++;
      return credentials(room, 1);
    },

    read(code, token) {
      const room = find(code);
      return snapshot(room, member(room, token));
    },

    act(code, token, action) {
      const room = find(code);
      const you = member(room, token);
      if (room.closed) throw new RoomError(410, 'This room has closed.');
      if (action.type === 'leave') {
        room.closed = `${room.seats[you].name} left the room.`;
        room.touched = Date.now();
        room.revision++;
        return snapshot(room, you);
      }
      const game = room.game;
      if (!game) throw new RoomError(409, 'Wait for the second player to join.');
      // Round + match guards make delayed retries harmless, even after a rematch.
      if (action.match !== room.match || action.round !== game.round) {
        throw new RoomError(409, 'The match has moved on. Updating your screen…');
      }
      if (action.type === 'lock') {
        if (game.phase !== 'choose') throw new RoomError(409, 'This round has already been revealed.');
        if (game.choices[you]) {
          if (game.choices[you] === action.choice) return snapshot(room, you);
          throw new RoomError(409, 'Your move is already locked.');
        }
        let next;
        try { next = lockChoice({ ...game, activePlayer: you }, action.choice); }
        catch { throw new RoomError(400, 'Choose Rooftop, Dancefloor, or Café.'); }
        room.game = next.phase === 'ready' ? revealRound(next) : { ...next, phase: 'choose', activePlayer: null };
      } else if (action.type === 'next' || action.type === 'rematch') {
        const expected = action.type === 'next' ? 'results' : 'finished';
        if (game.phase !== expected) throw new RoomError(409, 'That action is not available right now.');
        room.ready[you] = true;
        if (room.ready.every(Boolean)) {
          if (action.type === 'rematch') {
            room.game = onlineGame(room.seats.map(player => player.name));
            room.match++;
          } else room.game = { ...nextRound(game), phase: 'choose', activePlayer: null };
          room.ready = [false, false];
        }
      } else throw new RoomError(400, 'Unknown game action.');
      room.revision++;
      return snapshot(room, you);
    },
  };
}
