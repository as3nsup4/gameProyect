# Crowd Shift

**Version 1.1 — submission preparation.** A two-player browser game about reading the other person's next move. Play five rounds on one shared device or in a private room on two devices. Plain JavaScript, HTML, CSS, and Node.js; no installed packages, accounts, database, or API keys are needed to play.

**Public game:** [crowd-shift.onrender.com](https://crowd-shift.onrender.com/). The owner reports that a match with a friend and room codes work on the deployed version. The public start screen was also reviewed directly. Version 1.1 contains local finishing changes that have **not been deployed** by this assistant.

**Review decision:** the core game is complete for a small submission. The useful finishing work is clearer onboarding, room-entry recovery, and readable past moves. A larger game mode is not needed before entry. See [the submission pack](submission/README.md) for the title, description, cover, reviewer walkthrough, and remaining submission steps. Competition eligibility and the brief's ChatGPT Work requirement still need the owner's confirmation.

## Start the game

Open this folder in VS Code and run in its terminal:

```powershell
node server.mjs
```

Open **http://127.0.0.1:5173**. Requires Node.js 20 or newer; development used Node 24.19.0. No `npm install` or build step is needed. `npm start` is an optional equivalent. Stop with **Ctrl+C**. Opening `index.html` directly is unsupported because the game uses JavaScript modules and room APIs.

If the port is busy, stop the earlier server or use:

```powershell
$env:PORT = '5174'
node server.mjs
```

Then open http://127.0.0.1:5174. Restart the Node process after changing server files. Reload the browser after changing frontend files.

### Two devices on the same Wi-Fi

Stop any existing server first, then run:

```powershell
node server.mjs --lan
```

1. The terminal prints one or more **Same-network link** addresses. Use the address for the computer's active Wi-Fi/Ethernet connection.
2. Open that exact address on **both devices**. The second device must not use `127.0.0.1` or `localhost`; those names refer to itself.
3. Player one selects **Create room**, enters a nickname, and shares the code or invitation link.
4. Player two opens the invitation, or selects **Join room** on the same site and enters the six-character code and a different nickname.
5. The match begins when both seats are filled. No account is required.

Both devices must be on a network that permits them to communicate. A Windows firewall prompt may need to be handled by the computer's owner. Guest Wi-Fi isolation, VPNs, and separate networks can prevent a LAN connection. `--lan` listens on all interfaces; the default command listens only on this computer. LAN mode is not a public internet deployment.

### Two people on one device

Select **Same device**, enter two different names or use the defaults, and start. The named player takes the device while the other looks away. Select a destination, lock it, then pass when prompted. After both moves are locked, reveal together. The first picker alternates each round.

## Rules and scoring

The first prototype's solo/together rewards made Rooftop unbeatable. That model has been replaced with a symmetric counter cycle:

| Your destination | Beats (+3) | Loses to (+0) |
| --- | --- | --- |
| Rooftop | Dancefloor | Café |
| Dancefloor | Café | Rooftop |
| Café | Rooftop | Dancefloor |

If both players pick the **same destination, each earns +1**. After **five rounds**, the higher total wins. Equal totals are a draw. There is no timer or random scoring.

Every destination has exactly one win, one loss, and one draw. Repeating Rooftop can now be countered by Café. Against a uniformly random opponent, all three choices have the same expected score: `(3 + 1 + 0) / 3`. The underlying counter mechanic is the familiar rock-paper-scissors cycle; Crowd Shift supplies its own setting, copy, presentation, and local/room flow. This is a deliberate simple interpretation of the concept, not a claim to have invented cyclic games.

### Room flow

- Each player chooses privately on their own screen and may change their selection before locking.
- The server reveals and scores the round only after both moves are locked.
- Both players press **Next round** before advancing. The first person waits on the result screen.
- At the end, both must press **Play again** to reset scores and start a rematch in the same room.
- **Leave game** asks for confirmation and closes the room for both players. If the server cannot be reached, the device exits locally and reports that the old room remains until inactive.
- Round history explains every revealed result. All location cards and How to play show the same current rules.
- From round two, **Read their pattern · Past moves** opens the completed-round history while choosing, in both local and room play. It never includes the current round's unrevealed moves.
- The start screen defaults to **Create room**; invitation links select **Join room**. Names and the room-code draft survive switching setup modes in the current page. Leaving returns to Create room and clears the old room code.
- The final screen explicitly labels the overall score and the last round's result, since the match winner can lose the final round.

## Reconnection, privacy, and limits

- The server owns room state, scores, moves, and readiness. Clients cannot submit their own scores.
- A player's response contains their own locked choice, the opponent's locked/not-locked status, and previously revealed rounds. It never contains the opponent's unrevealed destination or either seat's private token.
- Each seat receives a random 256-bit token. Tokens travel in authorization headers, never invitation URLs. Invite links contain only the public room code. Keep a code between the intended two players: someone with it can occupy an empty seat.
- Before creating or joining, the client saves a separate random 256-bit **entry key** in this tab's sessionStorage. Retrying the same name, mode and code reuses it, allowing the server to return the originally claimed seat after a lost response. A refresh restores the pending setup draft so the player can retry. Successful entry replaces it with the seat credentials. Entry keys are private, excluded from room snapshots and URLs, and optional for older clients. Changing the entry details starts a new attempt; expired rooms and server restarts cannot be recovered. If storage is blocked, retries in the current page still work but refresh recovery does not.
- Room credentials live in **sessionStorage** for the current browser tab. Refreshing that tab restores the same seat when storage is available and the server still holds the room. Closing the tab, clearing storage, changing browsers/devices, or server restarts can lose the seat. Do not duplicate a player tab to create a second player; open the shared link separately.
- When connectivity drops, the client retries about once a second, shows connection status, and reconciles saved moves on recovery. No automatic forfeit occurs. An opponent with no recent request for 15 seconds is shown as reconnecting; background browser throttling can also cause that status.
- Rooms are stored **in memory**, capped at 200, and expire after an hour without authenticated activity. Closed rooms expire after a minute. Cleanup runs during room operations. Restarting or redeploying the server clears all rooms.
- This is a **single-process** room service. Do not run multiple instances without a shared room store or routing design. Short polling is intentionally used instead of adding a WebSocket dependency.
- Creation and mutations have bounded request rates, request bodies are limited to 2 KB, and actions check the current match/round to reject stale retries. Scores and advances are applied synchronously, once per valid transition.
- Shared-device privacy is social: the other player must look away. Developer tools can inspect a local match. Local games intentionally reset on refresh.
- There is no chat, analytics, external font request, account system, or persistent player database. Browser code never contains image-generation credentials.

## Code layout

```text
index.html                 Page entry point and metadata
favicon.svg                Simple UI icon
src/game.js                Shared pure rules, counter cycle, points, local transitions
src/ui.js                  Escaped screen templates, rules, cards, lobby, results
src/app.js                 Local and room flows, selection, dialogs, focus, status
src/network.js             JSON client, polling, refresh recovery, invitation URLs
server.mjs                 HTTP/static server, API routing, port/host/LAN startup
server/api.mjs             JSON parsing, origins, rate limits, error responses
server/rooms.mjs           Private room store, seats, filtered views, synchronized moves
styles/main.css            Base visual design
styles/rooms.css           Mode picker, room status, lobby, connection messages
styles/responsive.css      Narrow-screen layout and compact selectable cards
tests/game.test.js         Existing local game assertions, updated payoff expectations
tests/server.test.js       Existing static routing assertions
submission/README.md       Submission copy, walkthrough, sources, final checklist
submission/description.txt Ready-to-paste description (432 characters)
submission/cover.jpg        1260 × 840 screenshot cover (3:2)
submission/gameplay-full.jpg Uncropped gameplay screenshot with past moves open
Dockerfile                 Optional Node container for deployment
.dockerignore              Includes only runtime files in the build context
package.json               Optional start/start:lan/test shortcuts; no dependencies
```

### HTTP interface

The browser uses these same-origin endpoints:

| Method and path | Purpose |
| --- | --- |
| `GET /api/health` | Service status and version |
| `POST /api/rooms` | Create a room with `{ "name": "Alex" }` |
| `POST /api/rooms/:code/join` | Claim the second seat with `{ "name": "Sam" }` |
| `GET /api/rooms/:code` | Authenticated, player-specific room snapshot |
| `POST /api/rooms/:code/actions` | Authenticated `lock`, `next`, `rematch`, or `leave` |

Protected requests use `Authorization: Bearer <seat token>`. Game actions include `match` and `round`; locking also includes `choice`. Create/join bodies may include `entryKey`, a 64-character lowercase hexadecimal secret, for retry recovery. Only create/join responses supply the requesting player's token. The static allowlist serves game files, not `server/`, `.git`, `.env`, documentation, submission materials, tests, or old publishing archives.

## Public hosting

The two-device game needs a **running Node server behind HTTPS**, serving the page and `/api/` on the same origin. Uploading only HTML/CSS/JS to a static host will not run rooms. The older Hello deployment is a separate static experiment.

For a Node-capable host:

- Runtime: Node.js 20+ (Node 24 is used by the included container).
- Start command: `node server.mjs`.
- Environment: `HOST=0.0.0.0`; use the host's supplied `PORT`.
- Instances: **one**, with no clustering. Room state is in memory.
- Health endpoint: `/api/health`.
- Put TLS at the hosting platform/reverse proxy; preserve the original Host header so same-origin checks work. Idle suspension/redeploys clear rooms; use a running instance for uninterrupted matches.
- Request limits key off the socket address; behind a proxy they may be shared across visitors. For a larger launch, configure trusted-proxy handling and a shared rate limiter rather than blindly trusting incoming forwarded headers.

Optional Docker commands, if Docker is already installed:

```powershell
docker build -t crowd-shift .
docker run --rm -p 8080:8080 crowd-shift
```

Open http://localhost:8080. The container runs as the unprivileged `node` user and includes only runtime files. Docker was not built in this review. The owner has already deployed the game on Render; this assistant has not changed that deployment or made a commit or push.

### Updating the existing Render deployment

Local edits do not update the public game automatically. Once the owner approves and commits/pushes the changes to the branch connected to Render, use that service's configured deployment workflow. If automatic deployment is enabled, wait for it to finish; otherwise deploy the new commit from the service dashboard. Restarting the service clears active rooms, so do this between games. The deployed header should show **1.1**, and `/api/health` should report **1.1.0**. Then play one new match with a friend on the public URL. No deployment was triggered during this review.

## Verification record

### Submission review — October 7–8, 2026

- Reviewed the local game, room service, client networking, presentation, documentation, public homepage, live mission brief, submission form, and linked official rules. No local competition files or on-disk AGENTS.md were found; the user's supplied instructions apply.
- The owner reported a working deployed match with a friend. This is owner-reported physical-device evidence for the earlier deployment, distinct from the browser walkthrough below.
- Reviewed the updated game through two independent browser tabs: create/invitation/join, all five rounds, all three winning relationships, a matching-destination round, a **10–4** final score, mutual next-round readiness, and mutual rematch. Rematch reset the score, round and history.
- Refreshed a locked player's tab and observed the same seat and locked destination restored.
- Confirmed setup names and room codes survive mode changes. Confirmed the past-moves table remains on completed rounds after the opponent locks a new move, and retains its open state and keyboard focus during that update.
- Reviewed phone widths of 390 and 320 pixels. At the narrowest width the document had no horizontal overflow; selecting and locking still worked. These are browser viewport checks, not physical-phone or screen-reader certification.
- Saved the actual gameplay screenshots in `submission/`; the cover is a 1260 × 840 crop with the game title, score, past-moves control and all three destination cards. No generated artwork or new dependency was needed.
- Runtime syntax checks and `git diff --check` passed. An initial run of the existing automated suite, before this finishing pass, passed six game checks; its HTTP check was blocked by sandbox loopback `EACCES`. That result does not establish automated coverage of version 1.1. No new automated tests were added, and the suite was not rerun after the edits.
- The lost-response entry-recovery path was reviewed in code; deliberately dropped server responses, load limits, storage denial, and real internet outages were not exercised. Those remain verification limits. The successful browser create/join flow uses the new entry-key protocol.

### Earlier release candidate — October 6, 2026

- Node syntax checks passed for the server entry point and all six runtime modules. `git diff --check` reported no whitespace errors.
- Manually created and joined a room through two independent browser tabs, using the invitation URL and distinct player seats.
- Completed a five-round room match: Alex finished **10**, Sam **4**, with all three counter relationships and a matching-destination round represented in the visible history.
- Refreshed the host tab after locking a move; its seat and locked choice were restored.
- Observed the first next-round confirmation waiting for the other player, followed by synchronized advancement.
- Both players selected Play again; scores reset to zero and round one reopened.
- Leaving from the guest tab closed the room for the host and displayed who left. That version returned to local play; version 1.1 returns to Create room.
- Saved the browser result screenshot at `work/crowd-shift-room-result.jpg` (ignored development output, not a game asset).
- Updated the pre-existing local-game assertion values to the new scoring rules. **No automated tests were added or run for this release candidate.** The seven passing checks from the original prototype do not establish coverage of the new room service.

The existing automated checks can be run when requested:

```powershell
node --test
```

### Before submitting

- [x] Public game URL exists; owner reports successful play with a friend.
- [x] Review the game and prepare the screenshot cover and submission copy.
- [ ] Deploy version 1.1 and repeat a match on two devices over the public HTTPS URL.
- [ ] Confirm the ChatGPT Work workflow requirement, personal eligibility and applicable Code of Conduct; see the submission pack.
- [ ] Review the description in your own voice, attach the cover and public game URL, and publish through the mission's form with the intended Showcase setting.

Later engineering work can add automated room coverage, deliberate network-failure checks, broader accessibility review and durable room storage. These were not claimed as completed in this finishing pass.

## Competition notes

No local competition/rules files were found at the start of development or this iteration. The linked official document was first read on October 5 and reviewed again with the live mission and submission form on October 7, 2026:

- [Official contest rules](https://go.joinhandshake.com/rs/390-ZTF-353/images/%5BAI_Skills_Studio_Challenge%5D_Contest_Official_Rules.pdf?version=0)
- [Handshake project brief and build guide](https://app.joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/mission_step_cmssgy0di000y1ztkbjrpbt5r)

The mission requires separate-device multiplayer, understandable rules, and a publicly reachable game. Room play and the owner's deployed match address those game requirements. The build brief also says **“This mission requires ChatGPT Work.”** This review cannot establish from the project files whether the owner's workflow meets that requirement; confirm it with the organizer if uncertain. This repository alone is not a completed competition submission.

The reviewed official rules state **October 30, 2026, 11:59 p.m. Pacific** as the entry deadline, despite the main page's October 31 wording. Entry needs a title, cover image, description, and game URL. The live form limits the description to **500 characters**, recommends a **3:2 screenshot at least 1200 pixels wide**, and says sharing to Showcase is required for challenge entry. Confirm personal eligibility and current form requirements against the complete rules. No game file-size cap, mandated language, or library list was found in the reviewed document. The document references a Challenge Code of Conduct without reproducing it; those applicable conduct terms still need review before submitting. No contest entry has been submitted.

## Images and secrets

No generated images or third-party visual assets were needed for gameplay. The interface uses original CSS, text, and simple inline SVG UI icons. If illustrations are added, follow the user's AGENTS instructions: generate with Gemini, keep the generation script at `scripts/generate_image_gemini.py`, save assets under `assets/`, and provide credentials securely. Never hardcode, print, or log an API key. `.env` files are ignored. No image API request was made.

## Change log

### 2026-10-07–08 — Submission finishing pass (version 1.1)

- Added private, idempotent entry keys to client create/join requests and server seats so a retry can recover the same room/seat after a lost response. Added pending-entry draft restoration and in-memory fallback when sessionStorage is blocked; retained compatibility with older clients.
- Replaced development-only connection errors with instructions a public visitor can follow. Reconnection text no longer promises an unconfirmed move was saved.
- Made Create room the initial mode, reordered setup modes, retained name/code drafts while switching, and cleared the previous invitation on exit.
- Added a first-round strategy hint and completed-round history during choices in both play modes. Reused one history renderer, added table header scopes, and preserved history keyboard focus during room updates.
- Clarified the overall final score and separately labeled the last round's outcome.
- Updated the visible edition, package and health endpoint to 1.1 / 1.1.0. Game scoring and round count remain unchanged.
- Added `submission/README.md`, `submission/description.txt`, `submission/cover.jpg`, and `submission/gameplay-full.jpg`. These are local submission materials, excluded from the static server's public allowlist and Docker build context.
- Updated this README with the real public URL, review findings, owner-reported play, manual review evidence, entry-key protocol, deployment steps, remaining verification limits and competition questions.
- No commit, push, Render deployment, generated-image request, or contest submission was performed.

### 2026-10-06 — Balanced game and room-play release candidate

- Replaced solo/together rewards with the symmetric Rooftop → Dancefloor → Café → Rooftop counter cycle; win 3, match 1, loss 0.
- Updated every choice card, rules dialog, result explanation, matchup assertion, page description, and package metadata for the new rules/version.
- Added Create room / Join room alongside local play; six-character codes, invitation links, two independent seats, lobby, private locks, automatic reveal, shared history, and mutual next-round/rematch readiness.
- Added server-owned room state, token authorization, filtered snapshots, stale-action guards, size/rate/origin checks, room capacity/expiry, and a health endpoint.
- Added browser polling, pending-action controls, visible connectivity/presence, refresh recovery, expired/closed-room screens, leave handling, and clipboard fallback.
- Cleared old invitation codes when leaving so the next setup cannot accidentally target the closed room.
- Preserved tentative choices and keyboard/dialog state during background room updates. Added compact mobile cards, sticky choice controls, room styling, and small-screen header improvements.
- Added optional LAN binding with printed network addresses, configurable HOST/PORT, Docker packaging, and deployment instructions.
- Updated existing local scoring assertions without adding or running tests; recorded syntax checks and the browser room walkthrough separately.
- Rewrote this README to document the final rules, every new file, operational limits, architecture, and remaining release work. No commit, push, publication, or contest submission.

### 2026-10-06 — Original prototype browser handoff

- Played the original local five-round match (10–9), exercised restart/rules/leave controls, and saved `work/crowd-shift-preview.jpg`.
- Identified and documented the Rooftop dominance issue; superseded by the symmetric scoring above.

### 2026-10-05 — First playable foundation

- Added the local five-round game, private handoffs, selection/lock/reveal flow, results, win/draw, round history, restart, and player setup.
- Added responsive CSS, accessible focus, dialogs, reduced-motion support, and a dependency-free static Node server.
- Added the original six local-rule checks and one static-server check; all seven passed for that version.
- Added `.gitignore` for dependencies, credentials, logs, and scratch output. Replaced the old Hello README with game documentation.
- Preserved `hello-site/` and `work/hello-publish/`. Game development remains in the project root.

Continue recording development changes here. Commit or push only when the user explicitly asks.
