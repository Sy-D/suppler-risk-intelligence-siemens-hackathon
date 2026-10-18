# 006 — Voice input im ChatDock (Web Speech API)

Ansatz im Gespräch freigegeben: Web Speech API statt Nemotron/Nebius
(Nebius Catalog hat kein ASR-Modell; Nemotron wäre gRPC-Proxy-Aufwand).

## Tasks

- [x] Mic-Button im `<form>` des Docks (`components/dashboard/chat-dock.tsx`),
      zwischen Input und Send-Button.
- [x] `SpeechRecognition` mit `webkitSpeechRecognition`-Fallback; minimale
      lokale Typen (TS lib.dom enthält die API nicht, kein `any`).
      → Via `declare global { interface Window {...} }` statt Assertion,
      weil der anti-slop-Rule `as`-Casts beanstandet.
- [x] `continuous` + `interimResults`; Finals + Interim live in `draft`
      schreiben, bestehender Draft als Basis behalten (`draftBaseRef`,
      Finals akkumulieren in `final`, Interim pro Event).
- [x] `lang = navigator.language` (Fallback en-US).
- [x] Listening-State: Button wird `destructive` + `animate-pulse`,
      Icon `Mic` → `MicOff`, erneuter Klick stoppt.
- [x] Button nur rendern, wenn API verfügbar — via `useSyncExternalStore`
      (SSR-sicher, kein setState-in-Effect, eslint-clean).
- [x] `stop()` beim Absenden, `abort()` beim Unmount/Close.
- [x] `pnpm typecheck` + oxlint + eslint auf der Datei: sauber.
      (Repo-weit 54 pre-existing anti-slop-Errors in map.tsx/geo.ts u.a.,
      keine neuen dazugekommen.)

## Hinweise

- Sprache folgt Browser-Locale — de-DE User bekommen de-DE Erkennung.
- Läuft in Chrome/Edge; Safari hat webkitSpeechRecognition (aktivieren).
- Button erscheint nicht in Browsern ohne API (Firefox).
