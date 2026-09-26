Product Requirements Document

# Dhaka Tesla Pool

A shared-seat ride pooling product for Dhaka's traffic — passengers request seats on a three-seat "Tesla," the system pools compatible riders, and everyone pays a fair, transparent share.

Driver: **Jashim** · Vehicle: **Bullet**

Passengers: **Nusrat**, **Rafiq**, **Shirin**

## What the app does

One sentence: passengers ask for a seat between two Dhaka areas, the system matches them into a shared Tesla when routes overlap, and the driver runs the trip while each rider tracks and pays only their own fare.

Rider

### Passenger

Requests a seat, sees a fare estimate up front, tracks the ride live, and can cancel early. Only ever sees their own fare and status.

Operator

### Driver

Owns a Tesla with a fixed seat count, goes online, accepts matching requests, and moves the trip through arrival, start, and completion.

Matchmaker

### Pool Engine

Decides which requests can legally share one Tesla, locks seats so nobody is overbooked, and splits the fare fairly across everyone riding.

## Ride lifecycle

Every ride — solo or pooled — moves through the same five stages. Cancellation is allowed only up to the point marked below.

REQUESTED

MATCHED

DRIVER ARRIVED

STARTED

COMPLETED

Cancellation is available from REQUESTED through DRIVER ARRIVED. Any stage can branch to CANCELLED instead — once STARTED, the trip runs to COMPLETED.

## End-to-end flow — Nusrat & Rafiq's ride

The scenario the whole product is built around: two strangers, one Tesla, overlapping but non-identical trips.

01

#### Nusrat requests Banani → Mohakhali

She sees an estimated fare before confirming and enters a REQUESTED state.

02

#### Rafiq requests Banani → Gulshan 1

Same pickup zone, overlapping route — the pool engine flags them as poolable within seconds.

03

#### Jashim accepts the pool

Bullet has 3 seats; both requests are assigned. Ride moves to MATCHED, then DRIVER_ARRIVED.

04

#### Shirin tries to claim the last seat

She requests around the same moment as another rider — the system must let only one of them win the seat.

05

#### Trip runs and completes

Jashim starts the trip, drops Rafiq at Gulshan 1, then Nusrat at Mohakhali. Each pays their own itemized fare.

## Features by role

The full feature set, grouped by who uses it.

### Passenger

- **Sign up / sign in**
- **Request a ride** — pickup, destination, seat count
- **See fare estimate** before confirming
- **Track status live** — waiting → matched → in progress → done
- **View only their own fare**, never another rider's
- **Cancel** while the ride is still in a cancellable stage
- **Ride history** with itemized past fares

### Driver

- **Sign in**, go online / offline
- **Register their Tesla** with a fixed seat capacity
- **See relevant requests** matching their route
- **Accept a ride or pool** of compatible requests
- **Mark arrival**, start trip, end trip
- **See every rider** currently assigned and their fares
- **Trip history** and earnings per ride

### Pool Engine

- **Match compatible requests** to one Tesla by route overlap
- **Never exceed seat capacity**, even under simultaneous claims
- **Price each passenger by legs ridden**, with a discount on shared legs
- **Enforce clean state transitions** — no illegal jumps
- **Allow mid-trip joins** when seats remain free
- **Retain full ride history** for later explanation

## Fare model: pay per leg, save on shared legs

The route is split into equal legs between stops. Each passenger pays only for the legs they actually ride, and every leg they share with others gets a pool discount. Nobody pays for distance they didn't travel.

fare = base + distance (legs ridden) − pool discount (shared legs)

1 rider: **0% off**

2 riders: **20% off**

3 riders: **30% off**

Solo leg price: **৳100**

Worked example: route A to F, five legs. User1 rides A to F, User2 rides B to D, User3 rides C to F (base fare set to ৳0 for clarity).

A–B

B–C

C–D

D–E

E–F

Total

Riders

1

2

3

2

2

Discount

0%

20%

30%

20%

20%

User1

100

80

70

80

80

৳410

User2

80

70

৳150

User3

70

80

80

৳230

### User1 saves **৳90**

Pays 410 instead of a solo 500.

### User2 saves **৳50**

Pays 150 instead of a solo 200.

### User3 saves **৳70**

Pays 230 instead of a solo 300.

### Passengers

- Always pay less than a solo ride, which is the reason to pool.
- Can see the per-leg breakdown of their own fare only.

### Driver

- Earns **৳790** from the pooled trip versus ৳500 for User1 alone.
- Extra riders always mean more income.

### Why it works

- Easy to verify by hand: add up the legs.
- Mid-trip joiners fit naturally: they simply start paying from their leg.
- Money is stored as integer paisa to avoid rounding errors.

Payment is cash or a simulated TeslaPay wallet. No real gateway. Assumption: all legs on a route cost the same, with discounts set by how many riders share that leg at the time.

## Matching & concurrency rules

How the pool engine decides who can share a seat — and who wins it when two people ask at once.

**Same pickup zone**Banani for both riders

+

**Overlapping route**Both headed toward Gulshan/Mohakhali corridor

→

**Poolable**Assigned to same Tesla

**Nusrat's request**\
Arrives first at the database lock → seat count checked and incremented atomically → seat claimed, MATCHED.

**Shirin's request**\
Arrives moments later → atomic update finds capacity already reached → rejected cleanly, offered the next available Tesla.

Handled today with a single atomic conditional update inside a database transaction (check-and-increment in one statement) plus a capacity constraint as a backstop. At much larger scale this would move to optimistic locking with a version column or a queue-based seat-reservation step to reduce contention on hot pickup zones.

## Architecture

**Browser**Passenger & driver web app

→

**Next.js / React**UI, routing, state

→

**Node.js API**Auth, business rules, ride engine

→

**PostgreSQL**Users, rides, pools, fares

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js | File-based routing and built-in SSR keep the passenger/driver flows simple without a separate router setup. |
| Backend | Express | Minimal and explicit — the ride/pool logic is easier to reason about without a framework's opinionated layers. |
| Database | PostgreSQL | Pooling and capacity rules need real relational constraints, foreign keys, and transactional locking. |
| ORM | Prisma | Type-safe schema and migrations; makes the seat-capacity transaction explicit and readable. |
| Auth | JWT + bcrypt | Stateless sessions, no third-party dependency needed for an MVP. |

## Data model

users

**id** *PK*

name, phone, role

password_hash

vehicles

**id** *PK*

driver_id *FK*, name, capacity

rides

**id** *PK*

vehicle_id *FK*, status

seats_taken, capacity

ride_requests

**id** *PK*

passenger_id *FK*, ride_id *FK*

pickup_stop, drop_stop, fare, status

fare_legs

**id** *PK*

request_id *FK*, leg_no

riders_on_leg, discount_pct, price_paisa

ride_events

**id** *PK*

ride_id *FK*, event, at

## What ships in the MVP

### In scope

- Predefined Dhaka zone list, no live map API
- Atomic seat-capacity locking
- Docker Compose: app + Postgres + seed data
- Full ride history per user

### Out of scope

- Real GPS routing / Google Maps
- Live payment gateway
- Redis, queues, microservices

### Tested behaviors

- Capacity never exceeded
- Illegal state transitions rejected
- Per-leg pooled fares add up correctly (410 / 150 / 230)
- Two concurrent claims can't overbook

Dhaka Tesla Pool — PRD · Cast: Jashim & Bullet, Nusrat, Rafiq, Shirin