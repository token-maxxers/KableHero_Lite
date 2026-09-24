# Roadmap — designed, not yet built

Each item below is a design note for future development. None of it ships in the
current scaffold.

## 1. SMS Gateway Fallback (Offline Mode)

When mobile data is down after a typhoon, the app compiles a report into a
compact payload and hands it to the phone's SMS composer via an `sms:` link.

- Payload: 1 byte tier + 4 bytes lat + 4 bytes lng (fixed-point, ~1 m precision)
  + 6 bytes truncated user id, base64-encoded to roughly 20 characters, prefixed
  with a scheme version, e.g. `KH1:AbCdEf...`.
- Receiver: a GSM modem at the LGU or cooperative runs a small daemon that
  decodes the string and posts it to a public API route, which inserts the
  report with `source = 'sms'` and no photo.
- Photos are queued locally (IndexedDB) and uploaded when data returns, then
  attached to the already-created report by id.
- Offline app shell: a generated service worker caching the shell with a
  network-first HTML strategy, so the capture screen opens with no connection.

## 2. Deduplication Radius Clustering

Reports landing within 15 metres of an existing open report of the same tier are
merged into one master ticket instead of creating a new pin.

- Add PostGIS (or a cheap haversine SQL function) and a `master_report_id`
  column; a `BEFORE INSERT` trigger finds the nearest open report within 15 m.
- The merged report accumulates confirmations and photos from all contributors;
  each contributor still receives their XP.
- The dispatcher map shows one pin with a "reported by N people" badge, which
  directly raises dispatch confidence and prevents double-crewing.

## 3. Neighborhood "Storm Patrol" Quest Board

Time-limited, post-typhoon bounties for volunteers and SK youth.

- `quests` table: title, barangay/area polygon, objective type
  (`inspect_poles`, `validate_reports`), target count, XP reward, opens/closes.
- `quest_progress` per user, incremented by the same triggers that award XP when
  the action falls inside the quest window and area.
- Example: "Inspect 5 flagged poles in Purok 3 for +100 XP", open for 72 hours
  after a storm signal is raised.

## 4. Electric Bill Micro-Rebate Integration

Converts top-contributor XP into real utility value.

- `rewards_periods` (monthly) and `rebate_claims` tables; a scheduled job ranks
  verified contributors per cooperative franchise area.
- Anti-abuse: only XP from reports that reached `dispatched` or `resolved` and
  carry at least two independent confirmations counts toward rebates.
- Integration is a signed export/webhook to the cooperative's billing system,
  producing either a peso discount line or raffle entries.

## 5. LGU / Barangay Tanod Verification Role

A pin-protected on-duty role that confirms or de-escalates reports before formal
crew dispatch.

- The `tanod` role already exists in the schema; this adds a short PIN kept as a
  hash on a `duty_shifts` row, entered when starting a shift on a shared phone.
- Tanod actions: confirm (locks the tier), de-escalate (e.g. critical → low for
  a telecom "spaghetti wire"), or dismiss as a false report, all written to an
  append-only `report_audit` log.
- Dispatchers can filter for "Tanod-confirmed" pins to dispatch with confidence.
