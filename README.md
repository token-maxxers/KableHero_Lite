# KableHero Lite (LinemanQuest)

Mobile-first PWA for crowdsourced electric hazard reporting and dispatch triage
for Philippine electric cooperatives, barangays and residents.

After typhoons and accidents, downed poles and live wires get reported through
congested hotlines or social posts with no coordinates and no proof. KableHero
Lite turns a report into a pinned, photo-backed, community-verified ticket in
three taps — behind a safe-distance gate.

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Reporter flow: GPS + photo capture, 3-button hazard tier, safe-distance hold, submit |
| `/map` | Triage map: colour-coded pins, verification counts, community voting, dispatcher status updates, realtime |
| `/profile` | XP, civic tier (Purok Scout → Tanod Specialist → Master Lineman), report history |
| `/auth` | Email/password and Google sign-in |

## Documentation

- [Current build overview](docs/01-current-build.md) — what ships today, data model, safe-distance gate, XP system
- [Roadmap](docs/02-roadmap.md) — SMS gateway fallback, dedup clustering, Storm Patrol quests, bill micro-rebates, Tanod verification
- [Setup](docs/03-setup.md) — environment, backend, running locally, PWA install
