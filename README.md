# Dhaka Tesla Pool — Web

The passenger and driver front end for **Dhaka Tesla Pool**: passengers request
a seat between two Dhaka areas, the backend pools compatible riders into one
shared Tesla, and each rider tracks and pays only for their own fare.

The API lives in its own repository (see the backend README). This app talks to
it over HTTP and keeps no authoritative state of its own.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | File-based routing; the map, booking and history screens are client components over a thin shell |
| Language | TypeScript (strict) | The store mirrors API payloads, so a rename on the server should fail the build, not the demo |
| Map | MapLibre GL (vendored `mapcn` wrapper) | Free, no API key, real Dhaka basemap tiles |
| State | React Context store | Small enough that a state library would be more code than it saves |
| Styling | Tailwind v4 + shadcn primitives | Utility styling with no runtime CSS-in-JS cost |
| Data | Polling (2.5s) | The MVP needs lifecycle updates, not sockets; WebSockets/SSE is the first upgrade |

## Run

```bash
npm install
npm run dev                        # http://localhost:3000
```

The backend must be running for anything but the map. `npm run build` produces
a production bundle; `npm run lint` runs ESLint.

`NEXT_PUBLIC_API_URL` points at the backend and defaults to
`http://localhost:4000`, which is the backend's default port.

## Demo accounts

Seeded by the backend. All share the password `demo1234`.

| Phone | Role |
|---|---|
| +880 171 0001001 | Passenger — Nusrat |
| +880 171 0001002 | Passenger — Rafiq |
| +880 171 0001003 | Passenger — Shirin |
| +880 181 0002001 | Driver — Jashim (Bullet, 3 seats) |
| +880 181 0002002 | Driver — Kabir (Rocket, 3 seats) |
| +880 191 0009001 | Admin |

## API integration

`lib/api.ts` is the only module that talks to the backend, and it covers every
endpoint the server exposes:

| Area | Endpoints used |
|---|---|
| Health | `GET /health` |
| Auth | `POST /auth/login`, `POST /auth/register`, `GET /me` |
| Network / fare | `GET /network`, `POST /fare/estimate` |
| Passenger | `POST /rides/request`, `GET /me/active`, `GET /me/history`, `GET /rides/:id`, `POST /rides/:id/cancel`, `POST /rides/:id/rate` |
| Driver | `GET /driver/state`, `GET /driver/history`, `GET /driver/requests`, `POST /driver/online`, `POST /rides/accept`, `POST /rides/:id/join`, `POST /rides/:id/{arrived,start,complete}`, `GET /rides/:id/events` |
| Admin | `GET /admin/rides` |

A few notes on the ones that are easy to get wrong:

- **Fares are priced by the server.** The pre-confirm estimate comes from
  `POST /fare/estimate`, not from a client-side re-implementation, so the
  advertised price and the charged price cannot drift apart. The bundled
  `predefiend_routes.js` graph is used for drawing the map and the option list
  while the server responds.
- **Passengers never see another rider's fare.** Co-riders arrive from
  `GET /me/active` as `{ id, firstName, dropStopId, status }` — the server
  already strips the phone number and the fare, and the store builds zero-fare
  pseudo-records so nothing can leak through a history view.
- **Mid-trip joiners** go through `POST /rides/:id/join`. The UI only offers a
  candidate whose route shares at least one leg with someone already on board,
  because the server rejects the rest.
- **The audit trail** (`GET /rides/:id/events`) renders per past trip on the
  driver console, so "what happened and who did it" stays answerable.

## Project structure

```
app/
  layout.tsx        shell, theme, providers
  page.tsx          map + ride panel (passenger) / driver quick card
  login/page.tsx    sign-in, one-tap demo logins for the seeded cast
  activity/page.tsx driver console and passenger history
  account/page.tsx  account, demo cast, fare rules
  admin/page.tsx    read-only operations view (role: admin)
  loading.tsx       route-level loading state
  error.tsx         route-level error boundary
components/
  store.tsx         server-state mirror, polling loop, all mutations
  app-nav.tsx       role-aware navigation
  map/              workspace, ride panel, fleet simulation, route overlays
  ui/map.tsx        vendored MapLibre wrapper (not first-party)
lib/
  api.ts            typed client — the only seam to the backend
  network.ts        graph, pricing and formatting helpers
  fleet.ts          demo auto-rickshaw simulation
  route.ts          OSRM geometry fetching for real road overlays
```

## Known limitations

- Polling, not push: a lifecycle change shows within ~2.5s, not instantly.
- The map's autos are real driver accounts served by `GET /map/live`; a small
  scheduler keeps ~3 of them running shuttle trips, so the demo world keeps
  moving on its own between interactions.
- The JWT is in `localStorage`, which is demo-acceptable but not XSS-proof —
  httpOnly cookies are the production choice.

## The living map

Every auto on the map is a real driver account with a vehicle, a home stop
and a home corridor. One poll endpoint (`GET /map/live`) drives the whole
map, and a small scheduler on the server keeps **~3 randomly chosen drivers
running at all times** — real trips, real riders aboard, real completions
landing in history.

- **Tap a running auto** to see who is aboard (first name + where they get
  off — never anyone's fare) and how many seats are free.
- **Join this ride** if you have a free hand: pick **Get in at** and **Get
  out at** along the route (stops the auto has already passed are hidden),
  watch your fare settle live, claim the seat. The join reprices everyone
  already aboard.
- **Wait & Save** — after matching, a rider can hold their seat for a short
  window (30s in the demo) to earn an extra 5% off if the trip finishes
  after the wait. Both sides can see the offer, accept it, or pass.
- **I'm out at <stop>** — a passenger finishes their own leg; the ride
  completes when nobody is left riding.

## Demo walkthrough (three minutes)

1. Sign in as **Nusrat** and request Banani → Mohakhali.
2. Open a second browser as **Jashim** (Activity) — the request appears in
   his console within seconds. Press **Accept** (or **Pass** to see it leave
   only his list).
3. As Nusrat, accept the **Wait & Save** offer and watch the countdown; the
   driver marks **arrived**, then **start**.
4. Open the map as **Shirin** and tap the running auto: choose get-in /
   get-out stops, watch her fare price itself against the current
   occupancy, and claim the seat. Nusrat's fare drops as the shared legs fill.
5. As Nusrat or Shirin, press **I'm out at <stop>** when the trip ends; the
   ride completes and the fares (with every wait honoured) land in history.
