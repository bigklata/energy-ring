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

## Cykl pojedynczego zadania

1. Przypisać Issue do jednej osoby i jej `worker:*`; po spełnieniu zależności dodać `ready`.
2. Sprawdzić zależności oraz aktualność lokalnego `main`. Czysty checkout `main`
   można zaktualizować przez `git pull --ff-only`; lokalne zmiany wymagają
   wcześniejszego uporządkowania bez ich utraty.
3. Automatyzacja uruchamia Issue w osobnym worktree i branchu; claim ustawia `in-progress`.
4. Po pierwszych zmianach opublikować draft PR, aby zakres pracy był widoczny.
5. W opisie PR podać zakres zmian, testy i `Closes #NUMER_ISSUE`.
6. Po zakończeniu implementacji ustawić `Review`; druga osoba sprawdza PR.
7. Po przejściu CI i review scalić PR do `main`. Powiązane Issue zamyka się
   automatycznie, jeśli `main` jest domyślną gałęzią repozytorium.

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

W dokumentacji istnieją rozbieżne założenia:

- [CONTEXT.md](../CONTEXT.md): PSE, reguły i backtest, ML później,
  automatyczny trading demo na kontraktach z limitami ryzyka.
- [docs-grzegorz/product-brief.md](../docs-grzegorz/product-brief.md): wiele
  źródeł danych, prognozy ML i symulowany portfel, bez automatycznego składania
  zleceń; rynek terminowy poza MVP.

Ten dokument nie rozstrzyga, która wizja obowiązuje. Pierwsze wspólne Issue:
**„Uzgodnić zakres MVP, strukturę modułów i kontrakty danych”**.

Kolejność uruchomienia pracy:

1. Uzgodnić jedną wersję MVP i wskazać obowiązujące dokumenty.
2. Ustalić moduły, właścicieli, kontrakty danych i zależności zadań.
3. Przygotować wspólny szkielet Open Mercato i podstawowe CI w jednym PR.
4. Scalić szkielet do `main`, a następnie zaktualizować trzy sandboxy.
5. Rozpocząć równoległą pracę nad danymi, analizami i UI.

## Źródła

- [Open Mercato Sandboxes](https://github.com/open-mercato/open-mercato/blob/main/.ai/specs/enterprise/Sandboxes.md)
- [Cezar — uruchomienie i izolacja zadań](https://github.com/open-mercato/cezar)
- [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects)
- [Powiązanie PR z Issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
- [Review, CODEOWNERS i reguły repozytorium](https://docs.github.com/en/pull-requests/reference/managing-and-standardizing-pull-requests)
- [Ochrona gałęzi i dostępność w planach GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches)
