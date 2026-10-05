# 🌱 CodeGarden
Turn the history of an open-source repository into a living digital garden.

GitHub API -> Express backend (data + cache) -> React/SVG garden

## Run it
```bash
# terminal 1
cd backend && cp .env.example .env && npm install && npm run dev   # http://localhost:4000
# terminal 2
cd frontend && cp .env.example .env && npm install && npm run dev  # http://localhost:5173
```
Add a `GITHUB_TOKEN` to `backend/.env` to avoid rate limits.
`demo/index.html` is a standalone, no-server demo using sample data.

## Garden mapping
Contributors -> branches · Commits -> leaves · Merged PRs -> flowers · Stars -> fireflies · Inactivity -> falling leaves.
Health = recent activity (40) + community (25) + releases (20) + popularity (15).

## Roadmap
- [ ] Real per-year history for time travel
- [ ] Export garden as PNG
- [ ] Compare two repositories
