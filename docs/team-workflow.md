# Praca trzech osób: Open Mercato Sandboxes, Cezar i GitHub

Data: 2026-09-19. Status: propozycja organizacji pracy do wdrożenia.

Ten dokument jest referencją do dalszej pracy, nie potwierdzeniem konfiguracji
sandboxów lub GitHuba. Zawartość paneli sandboxów nie została zweryfikowana.

## Model współpracy

Trzy osoby pracują w trzech osobnych sandboxach na jednym repozytorium:
<https://github.com/bigklata/energy-ring>.

GitHub Issues i Project są wspólnym źródłem informacji o zadaniach, właścicielach
i postępie. Cezar wykonuje zadania agentów w osobnych Git worktrees. Każde zadanie
ma własny branch i pull request do `main`.

Przypisanie osób zatwierdzone przez zespół (loginy GitHub wymagają uzupełnienia):

| Osoba | Sandbox | Obszar |
| --- | --- | --- |
| Dominik | [8afc4f45](https://app-v2.openmercatocloud.com/sandboxes/8afc4f45-40db-4875-8a85-a30ff0b306c3) | Dane, integracje i koordynacja |
| Grzegorz | [0d04cacd](https://app-v2.openmercatocloud.com/sandboxes/0d04cacd-2602-4917-9868-c303281df8c5) | Szkielet, CI i wsparcie integracji |
| Marek | [747c69d5](https://app-v2.openmercatocloud.com/sandboxes/747c69d5-fc44-4d25-9fc8-68f3015b676c) | Analityka (#7), następnie UI i scenariusze użytkownika |

## Automatyczny przydział przez etykiety GitHub

Poniższe etykiety i automatyzacje są instrukcją wdrożenia, nie potwierdzeniem ich
utworzenia w GitHub lub sandboxach. Imiona nie zastępują loginów `Assignee`.

| Właściciel | Etykieta wykonawcy | Kolejka Issues |
| --- | --- | --- |
| Dominik | `worker:dominik` | #2, #3, #5 (integracja), #6 |
| Grzegorz | `worker:grzegorz` | #4 |
| Marek | `worker:marek` | #10, #9 (opcjonalne), #7, #8 |

Issue #7 należy do Marka ze względu na jego wiedzę domenową. #8 pozostaje u Marka;
#7 i #8 wykonuje kolejno, bez dwóch równoległych implementacji. Przy limicie 20 h
#9 nie może opóźnić analityki. Ewentualne przekazanie #8 wymaga osobnego uzgodnienia.

Każde Issue ma dokładnie jedną etykietę `worker:*`. Nowa etykieta `ready` oznacza
zatwierdzony zakres i spełnione zależności; `blocked` oraz `in-progress` wykluczają
uruchomienie. Tagi projektu w Cezarze grupują widok, nie kierują pracą. Samo
`labels.enabled: true` w `.ai/agentic.config.json` nie uruchamia automatyzacji.

W każdym sandboxie utworzyć jedną automatyzację z poniższymi ustawieniami:

| Pole | Wartość |
| --- | --- |
| `kind` | `github` |
| `events` | `["issue.labeled"]` |
| `intervalSeconds` | `60` |
| `filters.changedLabels` | `["ready"]` |
| `filters.allLabels` | Własna etykieta `worker:*` oraz `ready` |
| `filters.excludeLabels` | `blocked`, `in-progress` i obie cudze etykiety `worker:*` |
| `task.worktree` | `true` |
| `task.autonomous` | `true` |
| `task.variants` | `1` |

Prompt do **New task**, z wyborem `create-cezar-automation`, jeśli dostępny.
Poniżej są trzy kompletne wersje do wklejenia. Każda osoba wkleja tylko swoją
wersję w swoim sandboxie. Nie zamieniać etykiety workera między sandboxami.

### Dominik — sandbox `8afc4f45`

```text
Skonfiguruj w tym projekcie Cezara automatyzację GitHub dla bigklata/energy-ring.
Mój worker: worker:dominik. Ten sandbox: 8afc4f45-40db-4875-8a85-a30ff0b306c3.

Utwórz jedną definicję automatyzacji, paused:
kind=github; events=["issue.labeled"]; intervalSeconds=60;
filters.changedLabels=["ready"];
filters.allLabels=["worker:dominik","ready"];
filters.excludeLabels=["blocked","in-progress","worker:grzegorz","worker:marek"];
task.worktree=true; task.autonomous=true; task.variants=1.

Nie twórz drugiej równoważnej automatyzacji. Uruchamiaj tylko Issue z worker:dominik
i ready. Przed startem sprawdź AGENTS.md, .ai/agentic.config.json, zależności,
assignee, claim, blokady i istniejący PR. Jeśli Issue jest blocked, in-progress,
ma innego workera albo ma już PR, zakończ bez duplikowania pracy.
Po claim dodaj in-progress, usuń ready i zostaw komentarz z workerem, sandboxem
i runem. Wykonuj wyłącznie zakres Issue w osobnym worktree przez zainstalowany
om-auto-create-pr oraz lokalne overrides. Uruchom walidację i przygotuj PR z Fixes
#NUMER. Nie wykonuj merge. Przy blokadzie opisz przyczynę i ustaw blocked.
Push wymaga potwierdzenia zgodnie z AGENTS.md.

Wykonaj `cez automation check`, pokaż wynik i link do włączenia automatyzacji.
Nie włączaj jej bez mojego potwierdzenia.
```

### Grzegorz — sandbox `0d04cacd`

```text
Skonfiguruj w tym projekcie Cezara automatyzację GitHub dla bigklata/energy-ring.
Mój worker: worker:grzegorz. Ten sandbox: 0d04cacd-2602-4917-9868-c303281df8c5.

Utwórz jedną definicję automatyzacji, paused:
kind=github; events=["issue.labeled"]; intervalSeconds=60;
filters.changedLabels=["ready"];
filters.allLabels=["worker:grzegorz","ready"];
filters.excludeLabels=["blocked","in-progress","worker:dominik","worker:marek"];
task.worktree=true; task.autonomous=true; task.variants=1.

Nie twórz drugiej równoważnej automatyzacji. Uruchamiaj tylko Issue z worker:grzegorz
i ready. Przed startem sprawdź AGENTS.md, .ai/agentic.config.json, zależności,
assignee, claim, blokady i istniejący PR. Jeśli Issue jest blocked, in-progress,
ma innego workera albo ma już PR, zakończ bez duplikowania pracy.
Po claim dodaj in-progress, usuń ready i zostaw komentarz z workerem, sandboxem
i runem. Wykonuj wyłącznie zakres Issue w osobnym worktree przez zainstalowany
om-auto-create-pr oraz lokalne overrides. Uruchom walidację i przygotuj PR z Fixes
#NUMER. Nie wykonuj merge. Przy blokadzie opisz przyczynę i ustaw blocked.
Push wymaga potwierdzenia zgodnie z AGENTS.md.

Wykonaj `cez automation check`, pokaż wynik i link do włączenia automatyzacji.
Nie włączaj jej bez mojego potwierdzenia.
```

### Marek — sandbox `747c69d5`

```text
Skonfiguruj w tym projekcie Cezara automatyzację GitHub dla bigklata/energy-ring.
Mój worker: worker:marek. Ten sandbox: 747c69d5-fc44-4d25-9fc8-68f3015b676c.

Utwórz jedną definicję automatyzacji, paused:
kind=github; events=["issue.labeled"]; intervalSeconds=60;
filters.changedLabels=["ready"];
filters.allLabels=["worker:marek","ready"];
filters.excludeLabels=["blocked","in-progress","worker:dominik","worker:grzegorz"];
task.worktree=true; task.autonomous=true; task.variants=1.

Nie twórz drugiej równoważnej automatyzacji. Uruchamiaj tylko Issue z worker:marek
i ready. Przed startem sprawdź AGENTS.md, .ai/agentic.config.json, zależności,
assignee, claim, blokady i istniejący PR. Jeśli Issue jest blocked, in-progress,
ma innego workera albo ma już PR, zakończ bez duplikowania pracy.
Po claim dodaj in-progress, usuń ready i zostaw komentarz z workerem, sandboxem
i runem. Wykonuj wyłącznie zakres Issue w osobnym worktree przez zainstalowany
om-auto-create-pr oraz lokalne overrides. #7 ma pierwszeństwo przed #8; nie uruchamiaj
tych dwóch Issues równocześnie. Uruchom walidację i przygotuj PR z Fixes #NUMER.
Nie wykonuj merge. Przy blokadzie opisz przyczynę i ustaw blocked.
Push wymaga potwierdzenia zgodnie z AGENTS.md.

Wykonaj `cez automation check`, pokaż wynik i link do włączenia automatyzacji.
Nie włączaj jej bez mojego potwierdzenia.
```

Po podglądzie operator włącza automatyzację w **Automations**. Cezar musi działać.
Dopiero potem dodać `ready` do gotowego Issue; istniejący backlog nie musi zostać
uruchomiony po samym włączeniu. Przed dodaniem `ready` usunąć rozstrzygnięte `blocked`.
Utrzymywać najwyżej jedno aktywne zadanie implementacyjne na osobę; następne Issue
otrzymuje `ready` po zwolnieniu jej bieżącego zadania. Filtry nie są globalnym lockiem
między sandboxami, dlatego jednej etykiety workera nie obsługują dwa automaty.

W odczycie GitHub z 2026-09-19 #2–#8 miały `blocked`; nie odblokowywać ich masowo.
Tryb Autonomous nie znosi wymogu potwierdzenia push. Definicje automatyzacji trzeba
utworzyć w każdym sandboxie; sam commit tej instrukcji ich nie instaluje.

Źródła: [referencja Cezara](https://github.com/open-mercato/cezar/blob/main/docs/reference.md),
[schema automatyzacji](https://github.com/open-mercato/cezar/blob/main/packages/cezar/src/automations/types.ts).

## Podłączenie środowisk

W każdym sandboxie należy przygotować:

- osobną kopię repozytorium `bigklata/energy-ring`;
- projekt Cezara wskazujący na tę kopię, z `main` jako bazą nowych zadań;
- dostęp do GitHuba przez konto odpowiedniej osoby z uprawnieniami do repo;
- osobną bazę developerską, dane testowe i konfigurację środowiska;
- zalogowanego agenta obsługiwanego przez Cezara.

Jeżeli repo nie jest jeszcze podłączone, przykładowa konfiguracja terminalowa
wygląda następująco (wymaga Git, GitHub CLI, Node.js 20+ i agenta):

```bash
gh auth login
gh auth setup-git
git clone https://github.com/bigklata/energy-ring.git
cd energy-ring
npx cezar-cli
```

Jeżeli sandbox już udostępnia Cezara, należy wskazać w nim właściwy checkout,
zamiast uruchamiać dodatkową instancję. Jeśli repo jest już sklonowane, należy
najpierw sprawdzić jego `git status` i `git remote -v`.

Sklonowanie repo nie przełącza automatycznie podglądu aplikacji. Proces
developerski i podgląd muszą wskazywać na właściwy checkout/worktree. Równoległe
procesy w jednym sandboxie wymagają rozdzielenia portów oraz zasobów testowych.
Sekrety środowiskowe pozostają poza repozytorium.

## Widoczność pracy na GitHubie

Utworzyć Project „Energy Ring”, powiązać go z repozytorium i udostępnić zespołowi.

Statusy: `Backlog → Ready → In progress → Review → Done`.

Każde Issue powinno zawierać:

- jednego właściciela (`Assignee`);
- obszar: `area:data`, `area:analytics` albo `area:ui`;
- zakres plików/modułów i granice zadania;
- kryteria ukończenia, wymagane testy i zależności;
- identyfikator sandboxa;
- link do PR i opcjonalnie zadania Cezara.

Nie zakładamy automatycznej synchronizacji zajętości zadań pomiędzy trzema
instancjami Cezara. Przed uruchomieniem zadania trzeba sprawdzić jego właściciela
i status na GitHubie. Samo lokalne uruchomienie agenta nie zapewnia widoczności
pracy w repozytorium.

## Cykl pojedynczego zadania: pięć faz

Każde zadanie — wykonywane ręcznie albo przez automatyzację Cezara — przechodzi
te same pięć faz. To jest rozwinięcie skróconego cyklu z sekcji wyżej, nie
osobny proces: automatyzacja realizuje fazy 3–5 w jednym uruchomieniu, a fazy
1–2 zależą od bramki `spec-first`/`direct`/`reuse-spec` z
`.ai/guides/spec-delivery.md` (patrz też `workflow-analysis-mvp-20h.md`, sekcja 4).

1. **Analiza.** Przypisać Issue do jednej osoby i jej `worker:*`. Nowa
   funkcja/kontrakt/schemat/API/zmiana cross-module wymaga zatrzymania się i
   przygotowania specyfikacji w `.ai/specs/` przez `om-spec-writing`
   (`spec-first`). Bug fix, mała poprawka, dokumentacja albo izolowany
   refaktor przechodzą bez spec (`direct`) — decyzję zanotować w komentarzu do
   Issue, żeby drugi reviewer widział, czy spec był wymagany. Dowód
   zakończenia fazy: zatwierdzona specyfikacja w PR albo jawna notatka
   „direct”.
2. **Plan.** Rozbić Issue na fazy implementacji zgodnie z „Implementation
   phase gate” ze `spec-delivery.md`; potwierdzić zakres plików, zależności i
   kryteria odbioru z Definition of Ready (patrz wyżej). Sprawdzić zależności
   oraz aktualność lokalnego `main` (czysty checkout aktualizować przez
   `git pull --ff-only`; lokalne zmiany uporządkować bez ich utraty). Po
   spełnieniu zależności dodać `ready`. Dowód: krótki plan w opisie Issue/PR
   albo w `.ai/runs/<task>/`.
3. **Development.** Automatyzacja uruchamia Issue w osobnym worktree i
   branchu; claim ustawia `in-progress`. Implementacja przez
   `om-implement-spec` (lokalne fazy) albo `om-auto-create-pr` (małe
   zatwierdzone zadanie) — nigdy oba naraz dla tej samej pracy. Po pierwszych
   zmianach opublikować draft PR, aby zakres pracy był widoczny.
4. **Testy.** Przed oznaczeniem `Review` uruchomić pełny gate repo:
   `yarn generate && yarn typecheck && yarn lint && yarn ds:check && yarn test && yarn build`;
   dla zmian integracyjnych/cross-seam dodać `yarn test:integration:ephemeral`
   przez `om-integration-tests`. Nie deklarować PASS dla nieuruchomionych
   komend. Jeśli `.ai/agentic.config.json` ma `qaGate: true`, dodać `needs-qa`
   i nie usuwać jej samodzielnie — QA scenariusza wykonuje druga osoba, nie
   autor PR.
5. **Dokumentacja.** W opisie PR podać zakres zmian, listę uruchomionych
   testów/komend i `Closes #NUMER_ISSUE`; zaktualizować `docs/` lub
   `.ai/specs/`, jeśli zmiana zmienia ustalony kontrakt lub proces. Ustawić
   `Review`; druga osoba sprawdza PR. Po przejściu CI i review scalić PR do
   `main`. Powiązane Issue zamyka się automatycznie, jeśli `main` jest
   domyślną gałęzią repozytorium.

Automatyzacja jednej osoby (`.ai/cezar/automations.json`, lokalna dla
sandboxa, nieśledzona w git) powinna odzwierciedlać te pięć faz w treści
`task.prompt`; każdy z trójki aktualizuje własną automatyzację niezależnie.

Push i inne ryzykowne operacje wykonywane przez agenta wymagają potwierdzenia
zgodnie z instrukcjami użytkownika. Ten dokument nie jest takim potwierdzeniem.

## Ograniczanie konfliktów

Worktree izoluje pliki podczas pracy, ale nie eliminuje konfliktów przy scalaniu.

- Jedno zadanie = jeden branch = jeden PR; preferować małe, krótkie zadania.
- Przed równoległą implementacją uzgodnić model danych i kontrakty API.
- Wyznaczyć jednego koordynatora zmian wspólnych: zależności, lockfile,
  konfiguracja hosta, CI oraz wspólne schematy i migracje.
- Zmiany poza zakresem zadania uzgadniać z właścicielem danego obszaru.
- Po scaleniu zmian zależnych aktualizować branch zadania z `main` i ponownie
  sprawdzać integrację.
- Utrzymywać osobne bazy i dane testowe dla sandboxów.

Po ustaleniu loginów i struktury modułów dodać `.github/CODEOWNERS`.
CODEOWNERS kieruje review do właścicieli; nie blokuje edycji plików.

Dla `main` skonfigurować ochronę: obowiązkowy PR, co najmniej jedno zatwierdzenie
innej osoby, wymagane działające testy CI oraz zakaz force push. Wymagane review
właścicieli kodu można włączyć po ustaleniu CODEOWNERS. Dostępność ochrony
prywatnego repo zależy od planu GitHub.

## Warunek rozpoczęcia równoległej implementacji

2026-09-19 użytkownik wybrał **MVP prognozy RDN**: import PSE → kontrola jakości → korekta baseline’u → porównanie z opublikowanymi cenami. Bez tradingu, portfela i treningu ML. Decyzja jest zapisana w [issue #2](https://github.com/bigklata/energy-ring/issues/2), a projekt rozwija [robocza specyfikacja](../.ai/specs/2026-09-19-rdn-forecast-mvp.md).

`CONTEXT.md` i `docs-grzegorz/product-brief.md` zachowują historyczne alternatywy. `docs-marek/` jest materiałem wejściowym, nie automatycznie zatwierdzonym kontraktem technicznym. Weryfikacja źródeł (#6, część A) może rozpocząć się przed kontraktami #3. Kod importu (#6 B), analiz (#7) i UI (#8) wymaga uzgodnionych kontraktów oraz wspólnego szkieletu #4/#5. Praca w fazie importu obejmuje od razu jego UI; kolejna faza dostarcza prognozę i ocenę z ich UI.

Kolejność uruchomienia pracy:

1. Utrwalić zatwierdzony zakres prognozy RDN i wskazać obowiązujące dokumenty (#2).
2. Ustalić moduły, właścicieli, kontrakty danych i zależności zadań.
3. Przygotować wspólny szkielet Open Mercato i podstawowe CI w jednym PR.
4. Scalić szkielet do `main`, a następnie zaktualizować trzy sandboxy.
5. Dostarczyć import razem z jego UI, potem prognozę/ocenę razem z ich UI; równoległość ograniczyć do niezależnych prac wewnątrz aktualnej fazy.

## Źródła

- [Open Mercato Sandboxes](https://github.com/open-mercato/open-mercato/blob/main/.ai/specs/enterprise/Sandboxes.md)
- [Cezar — uruchomienie i izolacja zadań](https://github.com/open-mercato/cezar)
- [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects)
- [Powiązanie PR z Issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
- [Review, CODEOWNERS i reguły repozytorium](https://docs.github.com/en/pull-requests/reference/managing-and-standardizing-pull-requests)
- [Ochrona gałęzi i dostępność w planach GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
