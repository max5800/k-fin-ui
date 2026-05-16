# UX/UX-Review — k-fin-ui

Stand: 2026-05-16 · Branch `feat/p2a-provider-contract`

## Überblick

- **Stack:** React 19 + TypeScript (strict), Vite, Tailwind v4, React Router v7,
  TanStack Query v5, react-hook-form + zod, motion, lucide-react, recharts.
- **Struktur:** SPA mit Shell (`MainLayout` + `Sidebar` + `TopBar` + `ProtectedRoute`)
  und Page-Komponenten je Route. Server-State komplett über TanStack Query.
- **Styling:** Tailwind v4 mit `@theme`-Tokens in `src/index.css` (Material-artige
  Surface-/On-Surface-Skala, `primary` Teal, `secondary` Gold, `error`). Keine
  CSS-in-JS, keine UI-Library — alles Utility-Klassen inline.
- **Routing/State:** 9 Hauptrouten, Filter-/Tab-State teils in der URL
  (`searchParams`), teils lokal (`useState`). Auth-Token in `localStorage`.

**Zentrale User-Flows / Screens**

1. Login → (Onboarding) → Dashboard
2. Dashboard — KPIs, Cashflow-Chart, letzte Transaktionen, Synthese-Tile
3. Transaktionen — Filtern/Suchen, Inline-Bearbeiten im Side-Panel, CSV-Export
4. Portfolio — KPIs, Performance-Chart, Allocation, Bestandsliste + Drill-down
5. Kategorien & Budgets — Coverage-Strip, Attention-Rail, Budget-Drawer
6. Agents — Pipeline-Trigger, Run-Historie, Kosten
7. Review — Agent-Vorschläge + Erstattungs-Audit
8. Reports — Listen-/Detail-Split
9. Einstellungen — Sync, Backfill, Tags, Rules, Webhook, Passwort

Insgesamt ein durchdacht gebautes, visuell konsistentes Dark-Dashboard. Die
Findings unten sind überwiegend Feinschliff — mit ein paar echten Bugs
(tote Tokens) und einer strukturellen Lücke (keine Responsiveness).

---

## 1. Konsistenz

| ID | Finding | Impact |
|----|---------|--------|
| **K1** | **Tote/undefinierte Design-Tokens.** `bg-surface` (Reports.tsx:340,406), `bg-success`/`text-success`/`border-success` (PendingReview.tsx:568,569,725,730), `font-label` (Portfolio.tsx:409) existieren nicht im `@theme`. Tailwind v4 generiert dafür **keine Regel** → Hintergründe/Farben fallen still aus (z. B. grüne Erfolgs-States im Review sind farblos). | **Hoch** |
| **K2** | **Inkonsistentes Page-Top-Padding.** TopBar ist fix `h-20` (5 rem). Pages nutzen `pt-28` (Dashboard, Portfolio, Categories), `pt-24` (Transactions, Settings, Agents, Review) und `pt-20` (Reports) — der Inhalt sitzt je Seite auf anderer Höhe. | Mittel |
| **K3** | **`h-screen` vs. `h-full` gemischt.** Page-Roots verwenden uneinheitlich `h-screen` bzw. `h-full` innerhalb des `min-h-screen`-Layouts; Reports nutzt `h-[calc(100vh-0rem)]` (das `-0rem` ist toter Code). | Mittel |
| **K4** | **Semantik-Farben halb ausgebaut.** `error` ist ein Theme-Token, „Warnung"/„Erstattung" ist in 7 Dateien rohes `amber-400` (Tailwind-Default, kein Token), Settings nutzt an einer Stelle rohes `text-red-400`. Categories färbt Budget-Warnung mit `secondary` (Gold), Reports färbt Severity „warning" mit `amber` — zwei Gelbtöne für dieselbe Semantik. | Mittel |
| **K5** | **Viel dupliziertes Markup.** Modal-Shell (Overlay + Card + Header) ~6× kopiert (AgentRuns, Settings, BackfillSection, RulesSection, TagsSection); KPI-Card existiert als `KpiCard` in Portfolio, Dashboard baut eine eigene Variante; der Primary-Button-Klassenstring ist dutzendfach inline wiederholt. Keine geteilten Primitives. | Mittel (Wartung) |
| **K6** | Settings Page-Size-Select nutzt ein Unicode-`▾`; alle anderen Selects nutzen das lucide-`ChevronDown`. | Niedrig |
| **K7** | **Heading-Semantik uneinheitlich.** AgentRuns & Review rendern eine `<h3>`-Eyebrow *vor* der `<h1>`; Dashboard nutzt `<h2>` für KPI-*Zahlenwerte* (sind Daten, keine Sektionen); Transactions hat gar keine Seiten-`<h1>`. | Mittel |

## 2. Usability

| ID | Finding | Impact |
|----|---------|--------|
| **U1** | **Transaktions-Suche ohne Debounce.** `onChange` schreibt pro Tastendruck in die URL → eine Server-Query *und* ein History-Eintrag pro Zeichen. Tippen fühlt sich ruckartig an, der Browser-Back-Button ist zugemüllt. | **Hoch** |
| **U2** | **Toter „Notiz"-Input.** Das Edit-Panel der Transaktionen hat ein `notes`-Textarea im Formular, aber `onSubmit` sendet `notes` nie an die Mutation. Das Feld tut nichts. | Mittel |
| **U3** | **Onboarding ist Attrappe.** 4 Schritte, aber Schritt 2 sagt selbst „nur ein Platzhalter", Schritt 3 („Kategorien wählen") wählt nichts aus. Am Ende führt „Zum Login". Erwartung vs. Realität klaffen auseinander. | Mittel |
| **U4** | **Kein einheitliches Feedback-System.** Erfolgsmeldungen sind ad-hoc Inline-Text in unterschiedlicher Form (mal `role="status"`, mal nicht, mal auto-clear, mal bleibend). Das Speichern im Transaktions-Panel schließt nur das Panel — keine Bestätigung. | Mittel |
| **U5** | Login enthält ein leeres `<div className="flex items-center justify-end text-xs">` — Markup-Leiche (vermutlich ehemals „Passwort vergessen"). | Niedrig |
| **U6** | **Modals nicht per Escape schließbar** (außer PositionDetailPanel). Click-outside funktioniert, Escape — die Standard-Erwartung — nicht. | Mittel |

## 3. Accessibility

| ID | Finding | Impact |
|----|---------|--------|
| **A1** | **Kein sichtbarer Fokus-Indikator** auf der Mehrzahl interaktiver Elemente — Sidebar-Nav, Monats-Navigation, Range-Toggles, Tab-Buttons, fast alle Buttons. `outline-none` wird oft gesetzt, ohne Ersatz. Tastatur-Nutzer sehen nicht, wo sie sind. | **Hoch** |
| **A2** | **Transaktions-Tabellenzeilen nicht tastaturbedienbar.** `<tr onClick>` ohne `tabIndex`/`role`/Keydown. Portfolios `PositionsTable` macht es vorbildlich (tabIndex, `role="button"`, Enter/Space, Fokus-Ring) — Transactions zieht nicht nach. | **Hoch** |
| **A3** | **Modals ohne `role="dialog"`/`aria-modal`/Focus-Trap/Initialfokus** (außer PositionDetailPanel — das ist der Goldstandard). Screenreader-Nutzer werden nicht in den Dialog gescoped. | Mittel–Hoch |
| **A4** | Heading-Hierarchie übersprungen/falsch geordnet (siehe K7) — Navigation per Überschrift im Screenreader ist verwirrend. | Mittel |
| **A5** | **Kontrast/Schriftgröße.** Sehr viel `text-[10px]`/`text-[11px]` plus Opacity-Modifier (`/30`, `/60`, `/70`) auf `on-surface-variant`. Einzelne Kombinationen unterschreiten WCAG AA; 10 px ist generell grenzwertig klein. | Mittel |
| **A6** | Icon-only-Buttons meist mit `aria-label` (gut), vereinzelt ohne (z. B. Schließen-Button im Transaktions-Edit-Panel). | Niedrig–Mittel |
| **A7** | Fortschrittsbalken nutzen `aria-label`, aber kein `role="progressbar"` mit `aria-valuenow/min/max`. Kein `prefers-reduced-motion`-Respekt für die motion-Animationen. | Niedrig |

## 4. Responsiveness

| ID | Finding | Impact |
|----|---------|--------|
| **R1** | **App ist faktisch Desktop-only.** Die Sidebar ist permanent `fixed w-64`, `main` permanent `pl-64`. Kein Hamburger, kein Collapse. Unter ~1024 px drängt sich die Sidebar in den Inhalt; auf dem Smartphone unbenutzbar. | **Hoch** |
| **R2** | Transaktionen: Filterleiste + Tabelle + 96-breites Side-Panel via `flex` ohne Stacking für schmale Viewports — das Panel schiebt die Tabelle aus dem Bild. | Mittel |
| **R3** | TopBar-Breite ist `w-[calc(100%-16rem)]`, hart an die Sidebar-Breite gekoppelt — bricht, sobald die Sidebar responsiv wird (Folge von R1). | Mittel |
| **R4** | Tabellen (Transactions, Portfolio, AgentRuns) verlassen sich auf `overflow-x-auto` — funktioniert, aber kein Mobile-Card-Fallback. | Niedrig–Mittel |

## 5. Performance-relevante UI-Punkte

| ID | Finding | Impact |
|----|---------|--------|
| **P1** | Transaktions-Suche triggert pro Tastendruck einen Refetch (Query-Key ändert sich je Zeichen) — siehe U1. | **Hoch** |
| **P2** | `toChartData` in Dashboard nicht memoisiert; läuft bei jedem Render. | Niedrig |
| **P3** | Dashboard `maxTotal` wird im `.map`-Callback pro Zeile neu berechnet (n=3, vernachlässigbar, aber unsauber). | Niedrig |
| **P4** | Dashboard-Auto-Monatswechsel: `summary` lädt → Effect schiebt den Monat zurück → Refetch → sichtbarer KPI-Sprung beim ersten Laden. | Niedrig–Mittel |
| **P5** | motion-Entrance-Animationen feuern bei jedem Mount; kein `prefers-reduced-motion`. | Niedrig |

**Positiv:** Layout-Shift ist sonst gut gehandhabt — Skeletons matchen die
finalen Maße, Chart-Container haben feste Höhen, leere Zustände sind fast
überall sauber gestaltet.

---

## Priorisierung (Phase 2)

Reihenfolge nach Impact/Aufwand. „Quick Wins" zuerst — hoher Nutzen, kleiner,
isolierter Diff, kein visueller Umbau.

### Stufe 1 — Quick Wins (Hoch/Niedrig)
1. **K1** Tote Tokens fixen — echter Render-Bug, ein paar Zeilen.
2. **U1/P1** Debounce für die Transaktions-Suche.
3. **A2** Transaktions-Zeilen tastaturbedienbar (Pattern von Portfolio übernehmen).
4. **K2/K3** Page-Padding & `h-screen`/`h-full` vereinheitlichen.
5. **U5** Leeres Login-Markup entfernen; **K6** `▾` → `ChevronDown`.

### Stufe 2 — A11y-Grundlage (Hoch–Mittel/Mittel)
6. **A1** Globale, sichtbare `focus-visible`-Ringe.
7. **U6/A3** Escape-to-close + Dialog-Semantik für Modals.
8. **K7/A4** Heading-Hierarchie korrigieren.

### Stufe 3 — Konsistenz/Feedback (Mittel/Mittel)
9. **K4** Semantik-Farben über Tokens vereinheitlichen.
10. **U4** Einheitliches, dezentes Feedback-Muster (kein neues Dependency).
11. **U2** „Notiz"-Feld verdrahten *oder* entfernen.
12. **K5** Geteilte Primitives extrahieren (Modal-Shell, Card, Button) — optional.

### Stufe 4 — Größere Brocken (Hoch/Hoch — Rückfrage nötig)
13. **R1/R2/R3** Responsive Sidebar + Mobile-Layout.
14. **U3** Onboarding mit echter Funktion füllen (oder kürzen).

> Stufe 4 sowie die Farb-Token-Entscheidung (K4) berühren visuellen Stil bzw.
> Scope — dazu vor der Umsetzung Rückfrage an den Maintainer.

---

## Phase 3 — Umsetzungsstand

Umgesetzt wurde nach Absprache **Stufe 1–3** (Feinschliff, kein visueller Umbau).
`tsc --noEmit`, Vitest (70 Tests) und der Production-Build laufen sauber durch.

### Erledigt

| ID | Änderung |
|----|----------|
| **K1** | `bg-surface` → `bg-background` (Reports), totes `font-label` entfernt (Portfolio); `--color-success` neu im `@theme` → grüne Review-States sind nicht mehr farblos. |
| **K4** | `--color-success` + `--color-warning` als Theme-Tokens ergänzt; alle rohen `amber-{200,300,400}`-Klassen (7 Dateien) → `warning`, `text-red-400` → `text-error`. |
| **U1/P1** | Transaktions-Suche entkoppelt: lokaler Draft + 300 ms-Debounce → ein Refetch/History-Eintrag pro Tipp-Pause statt pro Zeichen. |
| **A2** | Transaktions-Tabellenzeilen tastaturbedienbar (`tabIndex`, `role="button"`, Enter/Space, Fokus-Ring) — Pattern aus Portfolio übernommen. |
| **K2/K3** | Alle 8 Routen-Roots auf `pt-28` + `h-screen` vereinheitlicht (vorher `pt-20/24/28`, `h-full`/`h-[calc(100vh-0rem)]`). |
| **U5/K6** | Leeres `<div>` aus Login entfernt; Settings-Select nutzt jetzt das lucide-`ChevronDown` statt `▾`. |
| **A1** | Globaler `:focus-visible`-Ring in `index.css` (unlayered → schlägt `outline-none`). |
| **U6/A3** | Neuer Hook `useEscapeKey`; alle 8 Modals haben jetzt Escape-Dismiss + `role="dialog"`/`aria-modal`/`aria-labelledby`. |
| **K7/A4** | Eyebrow-Kicker `<h3>`→`<p>` (AgentRuns, Review); KPI-Zahlenwerte `<h2>`→`<p>` (Dashboard, Portfolio). |
| **U2** | Totes `notes`-Textarea aus dem Transaktions-Edit-Panel entfernt (Schema + Reset + Markup); `aria-label` am Schließen-Button ergänzt (A6). |

### Bewusst offen gelassen

- **R1–R4** (responsive Sidebar / Mobile) — Stufe 4, separat zu entscheiden.
- **U3** (Onboarding mit echter Funktion), **U4** (einheitliches Feedback-System),
  **K5** (geteilte Primitives) — Stufe 3/4, je eigener, größerer Change.
- **A5** (Kontrast/Schriftgrößen), **A7** (`role="progressbar"`,
  `prefers-reduced-motion`), **P2–P5** — Feinschliff, noch offen.
- Tiefere Heading-Architektur (TopBar-`<h2>` vs. Seiten-`<h1>`) — Designentscheidung,
  berührt die Shell.
