# Crowd Shift submission pack

Prepared for version **1.1** on October 8, 2026. These files are ready for the owner to review and use; no entry has been published or uploaded.

## Form fields

| Field | Content |
| --- | --- |
| Project title | Crowd Shift — Read the room. Make your move. |
| Your project | https://crowd-shift.onrender.com/ |
| Preview image | [cover.jpg](cover.jpg) — actual gameplay, 1260 × 840 pixels, 3:2 |
| Description | Copy [description.txt](description.txt), 432 characters excluding its final newline |

**Description draft** — adjust it to reflect your experience before publishing:

> Crowd Shift is a two-player mind game: predict a friend's destination, lock your move, then reveal together. Rooftop, Dancefloor and Cafe form a balanced counter cycle across five rounds. Play in a private online room or pass one device. The build focused on keeping moves private while synchronizing both screens; revealed-round history helps players spot patterns. Next: gather player feedback and explore optional match variants.

The cover was captured from the running local version 1.1. It shows the real two-player choice screen with sample names Alex and Sam. It is a crop of a browser screenshot, without invented artwork or edited scores. Deploy the matching code before using it to represent the public game. [gameplay-full.jpg](gameplay-full.jpg) is an additional uncropped screenshot with the past-moves panel open. The pictured review room code is temporary; visitors should create their own room.

## Reviewer walkthrough — about three minutes

1. Open the public URL on two devices. No download or account is needed.
2. On the first device, enter a nickname and choose **Create room**. Share the invitation link or six-character code with the other player.
3. On the second device, open the invitation, enter a different nickname, and choose **Join room**. Alternatively select Join room on the homepage and enter the code.
4. Each player chooses Rooftop, Dancefloor or Café privately and presses **Lock my choice**. Both moves are revealed together when the second player locks.
5. Rooftop beats Dancefloor, Dancefloor beats Café, and Café beats Rooftop. Win = 3 points, same destination = 1 each, loss = 0. Both players press **Next round** to continue.
6. From round two, open **Read their pattern · Past moves** to inspect completed rounds. The highest total after five rounds wins; equal totals are a draw.
7. Both players press **Play again** for a fresh match in the same room. **Leave game** closes the room for both players after confirmation.

For a single-screen demonstration, select **Same device**, use two different names and pass the device when prompted. The actual separate-device room mode is the one to demonstrate for the mission.

## Final steps before entering

- [ ] Review and deploy these local changes through your existing Render service. This assistant has made **no commit or push**. Local edits alone do not update Render. Follow the deployment notes in the main README.
- [ ] Check the public header shows **1.1** and `/api/health` reports **1.1.0**, then complete one new match with your friend and try a rematch. Deploy between games because the in-memory rooms reset on server restart.
- [ ] Confirm your workflow satisfies the build brief's **ChatGPT Work requirement**. The repository does not prove that condition. If you built exclusively in Codex/VS Code and are unsure whether it qualifies, ask the organizer before submitting.
- [ ] Review personal eligibility, applicable conduct terms and the full official rules. The rules reference a Challenge Code of Conduct that is not reproduced in the linked PDF.
- [ ] Review the description, upload the screenshot and use the public game URL in the [mission submission form](https://app.joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/submit). The form says **Share to Showcase** must be enabled to enter the monthly challenge; otherwise it publishes to your profile only. Choose the setting knowingly, since Showcase is public.
- [ ] Complete the final publication yourself and confirm that the resulting project opens your game. Keep the public deployment available for reviewers.

The official PDF states an entry deadline of **October 30, 2026 at 11:59 p.m. Pacific**. Use that earlier deadline rather than relying on the main page's October 31 wording.

## Sources reviewed

- [Official contest rules](https://go.joinhandshake.com/rs/390-ZTF-353/images/%5BAI_Skills_Studio_Challenge%5D_Contest_Official_Rules.pdf?version=0)
- [Mission build brief](https://app.joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/mission_step_cmssgy0di000y1ztkbjrpbt5r)
- [Live submission form](https://app.joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/submit), reviewed October 7, 2026: title, game link, screenshot cover, description up to 500 characters, and Showcase setting. Cover guidance: 3:2, at least 1200 pixels wide.

## Assessment and scope

The core game has a complete local and online loop, balanced scoring, clear counters, private moves, a final winner or draw, and rematches. The finishing pass improves the first visit, room-entry retries, past-move reference and final score clarity. Additional modes, accounts, chat and cosmetic assets are optional future work.

The underlying counter cycle is familiar rock-paper-scissors. The project's original contribution is its setting, interface, text and implementation, not a claim to have invented that mechanic. Technical review evidence and remaining verification limits are documented in the [main README](../README.md). No award or eligibility determination is implied by this review.
