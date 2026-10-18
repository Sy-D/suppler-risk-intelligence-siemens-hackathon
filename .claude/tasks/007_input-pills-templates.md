# 007 — Input-Pills mit Platzhaltern, Mic+X im Suchfeld

## Tasks

- [x] Mic-Button in das Eingabefeld verschieben (absolute right, im
      BorderBeam-Container); dahinter ein X-Button, sichtbar sobald
      `draft`/`template` Inhalt hat → leert beides.
- [x] Beispiel-Pills (3 Stück, passend zu composeAnswer-Intents:
      SUPP_-Mention, Financial-Vergleich, Selected-Vergleich), nur wenn
      `messages.length === 0 && !draft && !template`; Entrance mit
      `animate-detail-in` + Stagger (`animationDelay`).
- [x] Template-Modus: Pill mit `{placeholder}` → `parseTemplate` splittet
      in Segmente (text | ph). Feld rendert Text-Spans + inline `<input>`
      pro Platzhalter (`size`-Attribut = Auto-Width). Nächster leerer
      Platzhalter: `border-b border-dashed border-blue-500` +
      `bg-blue-500/10` Highlight ("gepunktet gestrichelt blau").
- [x] Tab springt zwischen Platzhalter-Inputs (native Tab-Reihenfolge);
      Auto-Focus auf erstem leeren Platz beim Aktivieren. Enter im
      Platzhalter → Submit; leere Platzhalter blockieren Submit + fokussieren.
- [x] Tab-Hint ("⇥ Tab · jump to next field") als Chip über dem Feld,
      `animate-detail-in`, erscheint mit 1.5 s Delay nach Template-Aktivierung.
- [x] Voice-Input schreibt in fokussierten/ersten leeren Platzhalter wenn
      Template aktiv, sonst in `draft`.
- [x] Globaler "type anywhere"-Handler fokussiert ersten leeren Platzhalter
      statt in unsichtbaren draft zu schreiben, wenn Template aktiv.
- [x] typecheck + oxlint + eslint sauber.
