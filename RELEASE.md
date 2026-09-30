# Release checklist — v1.0.0

- [x] Backend: migrations, seed, 37 tests green (`npm test`)
- [x] Frontend: typecheck and production build clean
- [x] Endpoints behind auth with role and ownership checks; fares never leak between riders
- [x] Polling everywhere (`/me/active`, `/driver/state`, `/map/live`)
- [x] Docker: `docker compose up --build` in the backend repo
- [x] Demo accounts seeded (passengers + 15-driver fleet, password `demo1234`)
- [ ] Public deployment URL (run locally meanwhile; backend points at Neon)
- [ ] 6-minute demo video
- [x] README: stack, run, API, project structure, known limitations, walkthrough

## Two repositories

- Frontend (this one): Next.js app, the map, and every screen.
- Backend: Express + PostgreSQL API — see its own README and compose file.
