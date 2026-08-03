# hotelumo

Command-line access to your [Hotelumo](https://www.hotelumo.com/) data on
[app.hotelumo.com](https://app.hotelumo.com): reservations and guests, rooms
and room types, rate plans and per-day prices, live availability and booking
requests — the same records the dashboard shows, through the Hotelumo REST
API at `https://api.hotelumo.com`.

## Install

```bash
npm install -g hotelumo   # global install
npx hotelumo --help       # or run without installing
```

Requires Node.js 18 or newer.

## Quick start

```bash
hotelumo login                                   # choose browser or API key login
hotelumo hotels list                             # the hotels of your organization
hotelumo reservations list --stayDateFrom 2026-08-01 --stayDateTo 2026-08-31
hotelumo availability check <hotelId> --checkInDate 2026-08-10 \
  --checkOutDate 2026-08-12
```

```
Found 1 hotel(s):
1. Example Hotel — Rome, IT (64a1f2c9e4b0a1b2c3d4e5f6)
```

## Signing up

No account yet? Create one from the terminal — the generated password prints
exactly once, and the session is stored so every other command works
immediately. Signing up also seeds a demo hotel with room types, rooms and
rate plans, so there is something to read straight away:

```bash
hotelumo signup --email founder@example.com --json
```

## Authentication

Two ways in, both stored in `~/.hotelumo/`:

- **Browser** — `hotelumo login --browser` opens
  [app.hotelumo.com](https://app.hotelumo.com) in your browser to log in with
  your Hotelumo account, then stores a token session. Tokens are refreshed
  automatically; requests carry `Authorization: Token base64(<jwt>)`.
- **API key** — `hotelumo login --with-key` prompts for an API key secret
  with a masked input. An administrator of your organization creates the key
  in the Hotelumo dashboard, under the hotel's **API keys** settings — or
  from an existing browser session with `hotelumo keys add`. The secret is
  shown **once**, when the key is created, and never again — store it
  somewhere safe. It is never accepted as a command-line argument, so it
  cannot leak into your shell history. Requests carry
  `Authorization: Basic base64(<key secret>)` — the secret alone, with no
  username and no colon.

Plain `hotelumo login` in a terminal asks which method to use.
`hotelumo logout` deletes everything stored in `~/.hotelumo/`.

**Headless / CI / agents** — export `HOTELUMO_API_KEY=<key secret>` and skip
`login` entirely: every command reads it at request time. When several
credentials exist the precedence is: stored browser session, then stored key,
then the environment variable — a stored login always wins over an exported
key, so a globally exported `HOTELUMO_API_KEY` never hijacks an interactive
session.

Without a terminal the CLI never hangs and never opens a browser:
`hotelumo login` (and any command run without credentials) fails immediately
with exit code 1 and instructions on stderr.

A key belongs to a single organization, so the organization never has to be
named. A key can additionally be pinned to one hotel — such a key reads and
writes only that hotel, the `--hotelId` options below become unnecessary, and
passing a sibling hotel's id does not widen it.

### Scopes

Each API key carries per-resource scopes: `reservations:read`,
`reservations:write`, `guests:read`, `guests:write`, `rooms:read`,
`rooms:write`, `rates:read` and `rates:write`. New keys start with the four
`:read` scopes; an administrator widens them in the dashboard. `rooms` covers
rooms **and** room types; `rates` covers rate plans, daily rates **and** the
availability query. A command hitting a scope the key lacks fails with `403`.
Requests are rate limited per key; going over the limit returns `429`.

Three surfaces answer **only** to an operator session and return `401` to an
API key, because they expose credentials: `hotelumo hotels list`,
`hotelumo webhooks` and `hotelumo keys`. Use `hotelumo login --browser` for
those.

## JSON output

Every subcommand accepts `--json` and prints real, parseable JSON on stdout —
plain `JSON.stringify`, no colors. Without the flag, `list` and `read` print
human summaries. Mutations with `--json` print a small result object:
`{ "ok": true, "id": "…" }` for `add`/`update`,
`{ "ok": true, "deleted": ["…"] }` for `delete`.

Errors always go to stderr with exit code 1; with `--json` the error is a
single JSON line — `{"error":{"message":"…","status":404}}` — so stdout stays
clean for parsing.

```bash
hotelumo reservations list --json -n 100 \
  | jq '.[] | {id: ._id, checkInDate, checkOutDate, status}'
```

## Conventions

- **Money is in minor currency units.** `basePrice`, `price` and `totalPrice`
  are integers: `12000` is `120.00` in a two-decimal currency. Keep the
  returned `currency` attached and never sum across currencies.
- **Dates are `YYYY-MM-DD` and checkout is exclusive.** A stay from
  `2026-08-01` to `2026-08-03` is two nights.
- **Ids are 24-character lowercase hex.** Get them from `list`; a record
  owned by another organization answers `404`, so an id cannot be probed.

## Commands

### Session

```bash
hotelumo signup --email founder@example.com  # create an account and log in
hotelumo login                # interactive: choose browser or API key login
hotelumo login --browser      # log in through app.hotelumo.com
hotelumo login --with-key     # prompt for an API key secret (masked)
hotelumo logout               # clear everything stored in ~/.hotelumo/
```

### Schema

```bash
hotelumo schema               # the whole command tree as JSON
hotelumo schema guests list   # one subtree: its options and arguments
```

Machine-readable discovery of every command, option and argument — for agents
and scripts that would otherwise scrape `--help` text.

### Hotels (read-only)

```bash
hotelumo hotels list              # browser session only (--json, -n, --skip, --fields)
hotelumo hotels get <hotelId>     # raw JSON for one hotel
hotelumo hotels read <hotelId>    # formatted: address, currency, check-in hours
```

### Reservations

```bash
hotelumo reservations list                       # --json, -n/--limit, --skip
hotelumo reservations list --hotelId <hotelId> --guestId <guestId>
hotelumo reservations list --stayDateFrom 2026-08-01 --stayDateTo 2026-08-31
hotelumo reservations list --startTime <iso> --endTime <iso>
hotelumo reservations list --sortField checkInDate --sortDirection ASC
hotelumo reservations get <reservationId>        # raw JSON
hotelumo reservations read <reservationId>       # formatted view
hotelumo reservations add --hotelId <hotelId> --guestId <guestId> \
  --checkInDate 2026-08-10 --checkOutDate 2026-08-12 --status CONFIRMED
hotelumo reservations update <reservationId> --status CHECKED_IN
hotelumo reservations approve <reservationId>    # confirm a REQUESTED booking
hotelumo reservations delete <reservationId...>  # one or more ids
```

`--status` accepts `INQUIRY`, `REQUESTED`, `CONFIRMED`, `CHECKED_IN`,
`CHECKED_OUT`, `NO_SHOW` and `CANCELED`. `--source` accepts `DIRECT`,
`BOOKING_COM`, `EXPEDIA`, `AIRBNB`, `WALK_IN`, `PHONE` and `EMAIL`.
`--startTime`/`--endTime` bound the reservation's own timestamps;
`--stayDateFrom`/`--stayDateTo` select stays overlapping a calendar window.
The `rooms` array of a multi-room stay goes through `--body '<json>'`.

### Guests

```bash
hotelumo guests list                             # --json, --fields
hotelumo guests list --hotelId <hotelId>
hotelumo guests list --email jane@example.com    # exact match, not a search
hotelumo guests list --ids <id1>,<id2>
hotelumo guests get <guestId>                    # raw JSON
hotelumo guests read <guestId>                   # formatted view
hotelumo guests add --hotelId <hotelId> --firstName Jane --lastName Fonda \
  --email jane@example.com --phone 5551234567
hotelumo guests update <guestId> --phone 5559876543
hotelumo guests delete <guestId...>              # one or more ids
```

### Rooms and room types

```bash
hotelumo rooms list --hotelId <hotelId>          # --roomTypeId, --fields, --json
hotelumo rooms get <roomId>
hotelumo rooms read <roomId>
hotelumo rooms add --hotelId <hotelId> --roomTypeId <roomTypeId> \
  --number 101 --floor 1
hotelumo rooms update <roomId> --housekeepingStatus DIRTY
hotelumo rooms delete <roomId...>

hotelumo room-types list --hotelId <hotelId>
hotelumo room-types get <roomTypeId>
hotelumo room-types read <roomTypeId>
hotelumo room-types add --hotelId <hotelId> --name "Double room" --maxGuests 2
hotelumo room-types update <roomTypeId> --maxGuests 3
hotelumo room-types delete <roomTypeId...>       # also deletes its rate plans
```

Room `--status` accepts `AVAILABLE`, `OUT_OF_ORDER` and `OUT_OF_SERVICE`;
`--housekeepingStatus` accepts `CLEAN`, `DIRTY` and `INSPECTED`. Prices live
on rate plans, not on room types.

### Rate plans and daily rates

```bash
hotelumo rate-plans list --hotelId <hotelId>     # --roomTypeId
hotelumo rate-plans get <ratePlanId>
hotelumo rate-plans read <ratePlanId>
hotelumo rate-plans add --hotelId <hotelId> --roomTypeId <roomTypeId> \
  --title "Bed and breakfast" --basePrice 9000 --mealPlan bed_and_breakfast
hotelumo rate-plans update <ratePlanId> --basePrice 9500
hotelumo rate-plans delete <ratePlanId...>       # also deletes its daily rates

hotelumo daily-rates list --hotelId <hotelId> --ratePlanId <ratePlanId> \
  --dateFrom 2026-08-01 --dateTo 2026-08-31       # max 365 days per call
hotelumo daily-rates set --hotelId <hotelId> --ratePlanId <ratePlanId> \
  --dateFrom 2026-08-01 --dateTo 2026-08-31 --price 12000 --availability 4
hotelumo daily-rates set --hotelId <hotelId> \
  --values '[{"ratePlanId":"…","date":"2026-08-01","price":12000}]'
hotelumo daily-rates delete <dailyRateId...>
```

`--mealPlan` accepts `room_only`, `bed_and_breakfast`, `half_board`,
`full_board` and `all_inclusive`; `--sellMode` accepts `per_room` and
`per_person`; `--rateMode` accepts `manual` and `derived`.

`daily-rates set` is a batch upsert keyed on `(ratePlanId, date)`, capped at
**500 values per call** — the flag form expands `--dateFrom`/`--dateTo` into
one value per day, and `--values` takes the raw array when several rate plans
or prices go in one call. `--hotelId` is required on `rate-plans list`,
`daily-rates list` and `daily-rates set` unless the key is pinned to a hotel.

### Availability and booking requests

```bash
hotelumo availability check <hotelId> --checkInDate 2026-08-10 \
  --checkOutDate 2026-08-12 --adults 2 --children 1
hotelumo availability book <hotelId> --roomTypeId <roomTypeId> \
  --ratePlanId <ratePlanId> --checkInDate 2026-08-10 --checkOutDate 2026-08-12 \
  --name "Jane Fonda" --email jane@example.com --phone 5551234567 \
  --quotedTotal 24000 --quotedCurrency EUR
```

`check` returns unassigned offers — it holds nothing. `book` revalidates the
offer and creates a `REQUESTED` reservation with one unassigned `PENDING`
room for staff to approve; `--quotedTotal` and `--quotedCurrency` must still
match the offer, or the request is refused with `409`. Confirm the stay
afterwards with `hotelumo reservations approve <reservationId>`. Stays are
1–30 nights and check-in cannot be in the past.

### Webhooks and API keys (operator session)

```bash
hotelumo webhooks list
hotelumo webhooks get <webhookSubscriptionId>
hotelumo webhooks add --hotelId <hotelId> --url https://example.com/hooks \
  --events reservation.created,reservation.updated
hotelumo webhooks update <webhookSubscriptionId> --active true
hotelumo webhooks delete <webhookSubscriptionId...>

hotelumo keys list
hotelumo keys get <keyId>
hotelumo keys add --name "Channel manager" --hotelId <hotelId> \
  --scopes reservations:read,rates:read,rates:write
hotelumo keys delete <keyId...>                  # revokes the key immediately
```

Events are `reservation.created`, `reservation.updated`,
`reservation.deleted`, `guest.created`, `guest.updated` and `guest.deleted`.
Deliveries are signed with an `X-Hotelumo-Signature` header; an endpoint that
fails twenty times in a row is disabled automatically and is re-enabled with
`--active true`. Both `webhooks add` and `keys add` return a secret **exactly
once**, at creation.

### Skills

```bash
hotelumo skills list           # names and descriptions of the bundled agent guides
hotelumo skills get hotelumo   # print a bundled SKILL.md to stdout
```

## Notes on writes

- Every create/update needs a `hotelId`. Pass `--hotelId`, or use a key
  pinned to one hotel, which supplies it implicitly. On `update`, when
  neither is given, the CLI reads the record first and reuses its `hotelId` —
  that path needs the matching `:read` scope too.
- `update` sends only the fields you pass (plus `--body` JSON); the API
  merges them into the stored record.
- Creates and updates fire the corresponding webhooks
  (`reservation.created`, `guest.updated`, …) for the organization's webhook
  subscriptions, exactly as dashboard edits do.
- Publishing daily rates pushes them to connected channel managers, so a
  wrong price reaches the OTAs.
- Deletes are permanent and accept multiple ids
  (`hotelumo guests delete <id1> <id2>`). Deleting a room type also deletes
  its rate plans and their daily rates.

## Configuration

`HOTELUMO_API_URL` overrides the API endpoint (default
`https://api.hotelumo.com`) — only needed against a non-production
deployment. `HOTELUMO_API_KEY` supplies an API key secret from the
environment for headless use. Stored credentials live only in `~/.hotelumo/`;
the CLI sends them to the Hotelumo API and nowhere else, and collects no
telemetry.

## Usage with AI agents

Install the Hotelumo agent skills for Claude Code, Cursor, Codex, and any
other agent that supports the Skills standard:

```bash
npx skills add hotelumo/skills
```

The same guide ships inside the npm package, version-matched to the installed
CLI:

```bash
hotelumo skills list           # what is bundled
hotelumo skills get hotelumo   # the CLI guide matching this version
```

Or paste this into your `AGENTS.md` / `CLAUDE.md`:

```markdown
## Hotelumo

Use the `hotelumo` CLI for Hotelumo data: hotels, reservations, guests,
rooms, room types, rate plans, daily rates and availability. Run
`npx hotelumo skills get hotelumo` for the full guide, `hotelumo schema` for
the command tree as JSON, and `hotelumo --help` for the command reference.
Log in once with `hotelumo login` (browser or API key), or export
HOTELUMO_API_KEY for headless use. Every subcommand accepts `--json`.
```

Prefer a read-only assistant instead? Hotelumo also hosts an OAuth MCP
connector at `https://mcp.hotelumo.com/mcp` for property metadata,
availability and aggregate schedules — no key to paste, and no access to
guest, payment or credential data.

Prefer raw HTTP? The same API key authenticates the REST API directly —
`https://api.hotelumo.com` with `Authorization: Basic base64(<key secret>)`.

## License

[Apache-2.0](LICENSE)
