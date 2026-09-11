# FunBox — Race · Play · Connect

Real multiplayer kart racing for up to 12 players, each connecting from their own laptop. One person hosts the server; everyone else just opens a link in their browser.

## How it works

- `server/` — a small Node.js + Socket.io server. It creates race rooms, tracks who's in each one, and relays live positions between players. This is the piece that makes remote play actually work.
- `client/` — the game itself (`index.html`). One page, no build step. Deployed as a static site.

## Deploy it (3 steps, same as your original diagram)

### 1. Upload to GitHub
Create a new repository (e.g. `funbox-kart`) and push these three items to it:
- `client/`
- `server/`
- `README.md`

### 2. Deploy the server on Render
- New Web Service → connect the `funbox-kart` repo
- Root directory: `server`
- Build command: `npm install`
- Start command: `node server.js`
- Deploy. Render gives you a URL like `https://funbox-kart-server.onrender.com` — copy it.

### 3. Deploy the frontend on Netlify
- Add new site → Import an existing project → pick `funbox-kart`
- Base directory: `client`
- Build command: (leave empty)
- Publish directory: `.`
- Deploy. Netlify gives you a URL like `https://funbox-kart.netlify.app`

## Playing

1. Everyone opens the Netlify URL.
2. Everyone pastes the **same Render server URL** into the "Server URL" field.
3. One person creates a room and shares the 5-character room code (in chat/Slack).
4. Everyone else joins with that code.
5. Once everyone's readied up, the host hits **Start race**.
6. Drive with arrow keys / WASD. Up to 12 cars race on the same track at once, live.

## Notes

- Free Render web services sleep after inactivity — the first connection after a while can take 20–30 seconds to wake it up. If someone can't connect right away, wait and retry.
- The server only relays positions and room state; it never runs the actual driving physics, so it stays lightweight even with 12 people racing.
- No player data is stored anywhere — rooms exist only in memory and disappear once everyone leaves.
