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

Proponowane przypisanie; konkretne osoby trzeba jeszcze wskazać:

| Osoba | Sandbox | Obszar |
| --- | --- | --- |
| A | [8afc4f45](https://app-v2.openmercatocloud.com/sandboxes/8afc4f45-40db-4875-8a85-a30ff0b306c3) | Dane, integracje i import |
| B | [0d04cacd](https://app-v2.openmercatocloud.com/sandboxes/0d04cacd-2602-4917-9868-c303281df8c5) | Analizy i backtest |
| C | [747c69d5](https://app-v2.openmercatocloud.com/sandboxes/747c69d5-fc44-4d25-9fc8-68f3015b676c) | UI i scenariusze użytkownika |

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

1. Przypisać Issue do jednej osoby i ustawić `In progress`.
2. Sprawdzić zależności oraz aktualność lokalnego `main`. Czysty checkout `main`
   można zaktualizować przez `git pull --ff-only`; lokalne zmiany wymagają
   wcześniejszego uporządkowania bez ich utraty.
3. Uruchomić konkretne Issue w Cezarze, w osobnym worktree i branchu zadania.
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
