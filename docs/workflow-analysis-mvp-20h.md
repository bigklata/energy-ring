# Energy Ring: analiza workflow i propozycja MVP na 20 godzin

Data analizy: 2026-09-19. Status: rekomendacja do decyzji zespołu.

## Rekomendacja

Użyć istniejącego procesu Open Mercato jako podstawy wykonawczej, a z `dx-workflow`
przejąć krótkie planowanie, małe pionowe przyrosty, jawne wyłączenia zakresu oraz
sprawdzanie zgodności implementacji z planem. GitHub pozostaje wspólnym miejscem
przydzielania zadań. Cezar uruchamia agentów w izolowanych worktrees.

Nie instalować na czas sprintu drugiego pełnego systemu zarządzania pracą w `context/`.
Nie uruchamiać dwóch agentów wykonawczych dla jednego Issue. Zamiast jednego zadania
„zbuduj całe MVP” przygotować małe zadania z wynikiem możliwym do pokazania i sprawdzenia.

Proponowany wynik MVP: zalogowany użytkownik importuje ograniczony zestaw danych PSE,
widzi ocenę kompletności i aktualności danych, uruchamia prostą prognozę bazową oraz
porównuje ją z opublikowanymi wartościami. To demonstrator analityczny, bez obietnicy
przewagi predykcyjnej i bez handlu.

Ta propozycja ogranicza wcześniejsze wizje produktu i wymaga decyzji w Issue #2.
Nie zastępuje obowiązujących ADR-ów ani gotowej specyfikacji implementacyjnej.
W tej pracy nie zmieniono kodu aplikacji, konfiguracji pipeline, Issues ani uprawnień.

## 1. Zakres i aktualność sprawdzenia

Analiza opiera się na pobranych repozytoriach i odczycie GitHub API, nie tylko README.

| Repozytorium / źródło | Sprawdzona rewizja |
| --- | --- |
| `bigklata/energy-ring`, zdalny `main` | `7836e464def22a0c59cfb38fb088e9847092979f` |
| `dikamilo/dx-workflow` | `f10d3c4f42d73e3c151f98e1d88b21ff4ff04560` |
| `open-mercato/skills`, aktualny checkout | `7c81ffe68d99a9263143110c150e903d910f7526` |
| Open Mercato Skills przypięte w Energy Ring | `c6103c034571f3610323a1b53d97c81abe110b58` |

Lokalny checkout podczas analizy był na `452e7e1`; odczytano także zdalny `main`.
Jedyna różnica między tymi rewizjami to włączenie `labels.enabled`.
Nie aktualizowano roboczego checkoutu, żeby zapis raportu nie zmieniał innych plików.

Sprawdzono kod konfiguracji, katalogi modułów, dokumenty trzech koncepcji, otwarte
Issues, etykiety i status ochrony `main`. Nie uruchamiano aplikacji, builda ani testów;
nie sprawdzono konfiguracji wewnątrz trzech sandboxów, ich kont i baz danych.
Nie powtarzano pomiarów API PSE. Pomiary z `docs-marek` są materiałem repozytorium,
a nie wynikiem niezależnego testu wykonanego przy tym raporcie.

## 2. Co faktycznie jest w Energy Ring

| Obszar | Dowód i stan | Konsekwencja dla sprintu |
| --- | --- | --- |
| Host aplikacji | `package.json`, `src/modules.ts`, Dockerfile i pliki Compose | Szkielet Open Mercato jest już w repo; nie generować nowej aplikacji |
| Runtime | Node `>=24`, Yarn `4.17.1`; pakiety OM `0.7.1-develop.7202.1.a52dc6707c` | Wymaganie Node 20+ samego Cezara nie wystarcza do uruchomienia tej aplikacji; zamrozić wersje |
| Kod domeny | `src/modules/` zawiera `agent_examples`, `example`, `example_customers_sync`, `ratelimit_probe` | Brak własnych modułów energetycznych w sprawdzonym `main`; przykłady nie są gotowym MVP |
| Pipeline | `.ai/agentic.config.json`: tracker GitHub, `baseBranch: auto`, `labels.enabled: true`, `qaGate: false` | Claim może korzystać z etykiet; bramka QA nie jest wymuszana tą konfiguracją |
| Skills | `.ai/skills/tiers.json` przypina zewnętrzny commit i hashe; część lokalnych `SKILL.md` to tylko overrides | Obecność override nie potwierdza instalacji właściwego skilla w sandboxie |
| Walidacja | generate, typecheck, lint, ds:check, test, build w config i package.json | Komendy istnieją, ale nie potwierdzono, że przechodzą |
| CI i ochrona | Brak śledzonego `.github/workflows` i CODEOWNERS; API `main` zwraca `protected: false` | Lokalne komendy nie są jeszcze wymaganym CI; to zadanie do wykonania |
| Backlog | Otwarte Issues #2–#10, bez assignees; #2–#8 mają `blocked`; brak otwartych PR w odczytanym zestawie | Są kontenery pracy, lecz nie ma jeszcze przydziału wykonawców |
| Etykiety | W GitHub istnieją m.in. `in-progress`, `review`, `blocked`, `area:*`, `priority-*`, `risk-*` | Nie trzeba zakładać taksonomii od zera |

Issue #9 opisuje brak scope `project` w tokenie używanym w jednym sandboxie.
To treść zgłoszenia, nie niezależna weryfikacja bieżącego tokenu. Utworzenie tablicy
Project nie może blokować implementacji: lista Issues i PR zapewnia minimalną widoczność.

### Trzy koncepcje produktu

| Dokument | Kierunek | Ocena przy 20 godzinach |
| --- | --- | --- |
| `CONTEXT.md` + `docs/adr/` | Reguły/backtest, trading demo, kontrakty, margin, P&L, limity | Zbyt wiele niezależnych mechanizmów jak na start od szkieletu |
| `docs-grzegorz/product-brief.md` | Wieloźródłowe dane, ML, SHAP, osobny Python service, scenariusze portfela | Największy koszt integracji i walidacji; odłożyć poza ten sprint |
| `docs-marek/` | PSE, bramka jakości, baseline z korektą, replay, bez ML i tradingu | Najbliżej wykonalnego demo, ale nadal wymaga cięć i testów |

Aktualne polecenie użytkownika daje 20 godzin; zapis 10 godzin w `docs-marek` jest
starszym założeniem. Issue #2 opisuje głównie dwie pierwsze wizje i wymaga uwzględnienia
trzeciej. Ma też omyłkową zależność od samego siebie; nie odwzorowywać jej w grafie prac.

### Korekty do założeń Marka

- Zapis „nie ma czego testować” w ADR-0007 jest błędny: baseline, odcięcie czasowe,
  dopasowanie interwałów i MAE to testowalna logika, której błędy fałszują demonstrację.
- Około 10 godzin opóźnienia w konkretnej próbce nie dowodzi stałego opóźnienia API;
  około 13:50 nie jest potwierdzonym SLA publikacji. Pokazywać faktyczny timestamp i wiek danych.
- Pierwszy wiersz bez jawnego sortowania nie wystarcza do dowodu początku historii.
  Pełne odtworzenie stanu wiedzy sprzed rewizji wymaga zachowanych wersji, nie samego
  `publication_ts` aktualnego rekordu.
- Rozbieżność jednostki czasu wymaga decyzji: proponuję MTU 15 minut. Zwykła doba to
  96 interwałów, ale doby zmiany czasu mają 92/100; nie wpisywać `96` jako uniwersalnego guardu.
- Samo „więcej wiatru, więc taniej” nie ustala współczynników korekty i nie dowodzi
  przewagi nad baseline. Korekta pozostaje eksperymentem dodatkowym.
- Można pokazywać jedną organizację, ale nie wolno wyłączać istniejących mechanizmów
  uprawnień ani izolacji tenant/organization dla skrócenia implementacji.

## 3. Porównanie workflow

| Kryterium | dx-workflow | Open Mercato Skills | Wniosek dla Energy Ring |
| --- | --- | --- | --- |
| Sterowanie | Człowiek uruchamia kolejne skills; `Next:` sugeruje następny krok i zatrzymuje wykonanie | Interaktywne skills i autonomiczne łańcuchy `om-auto-*` | Człowiek ustala zakres; automat wykonuje mały, gotowy ticket |
| Stan pracy | Markdown w `context/`, frontmatter `change.md`, checklisty `Progress` | Specyfikacje, `.ai/runs`, GitHub Issues/PR i etykiety | Pozostać przy istniejących `.ai/*` i GitHub, bez równoległego rejestru |
| Planowanie | Wywiad skalowany do niewiadomych, standardy i słownik; plan wymagany, ale mały dla małego zadania | Spec-first dla istotnych zmian; plan wykonawczy osobno | Jeden wspólny, zatwierdzony zakres i małe plany zadań |
| Wykonanie | `dx-implement` / `dx-tdd`: jedna faza na wywołanie | Plan, worktree, commity, PR, review i wznowienia | Wybrać OM do obsługi pracy trzech sandboxów |
| Równoległość | Brak wbudowanej synchronizacji z trackerem; izolacja wymaga organizacji poza dx | Claim przez assignee, etykietę i komentarz; izolowane worktrees | OM lepiej pasuje do wspólnego repo, ale claim nie zastępuje przydziału ludzi |
| Review | Osobne raporty planu i implementacji; osobny triage | Review PR, severity, autofix, validation i QA | Jedno rzeczowe review przez inną osobę; nie mnożyć równoległych pętli |
| Wznowienie | Pierwszy niezakończony punkt `Progress` | `om-auto-continue-pr`, plan i istniejący PR | Wznawiać istniejące zadanie, nie tworzyć konkurencyjnej implementacji |
| Koszt procesu | Mała infrastruktura, więcej ręcznych przejść i artefaktów | Więcej integracji, potencjalnie kosztowne pętle i pełne gates | Wykorzystać już istniejący OM; ograniczać wielkość zadań, nie uczciwość testów |

Źródła dx: [opis workflow][DX-FLOW], [plan][DX-PLAN], [implement vs TDD][DX-TDD].
Źródła OM: [tworzenie PR][OM-CREATE], [claim][OM-CLAIM], [review][OM-REVIEW].

### Co przejmuję z dx

1. Krótką rozmowę tylko o decyzjach, których nie rozstrzyga repo.
2. Jawne „robimy / nie robimy” i jeden słownik pojęć.
3. Przyrosty pokazujące zachowanie od danych do widoku.
4. Checklistę sprawdzonych wyników, z dowodem lub SHA, nie sam deklarowany procent ukończenia.
5. Review: zgodność z planem, bezpieczeństwo, wzorce i standardy.
6. Test-first dla obliczeń oraz napraw błędów; bez sztucznych testów boilerplate.

To adaptacja zasad, nie twierdzenie, że zmodyfikowany proces wykonuje oryginalne
skills dx. Bez `dx-init`, `dx-new` i odpowiednich artefaktów nie należy traktować
`/dx-plan` jako bezstanowego polecenia działającego na dowolnym Issue.

### Co przejmuję z Open Mercato

- Istniejące skills domenowe i repo-local overrides dla standalone app.
- Jeden claim, branch/worktree i PR na zadanie.
- Wczesną widoczność postępu w PR, wspólny plan i wznowienie pracy.
- Zdefiniowaną walidację oraz review uwzględniające auth, scope, migracje i retry.
- QA rzeczywistego widoku, a nie wyłącznie przeczytanego diffu.

Nie proponuję automatycznej instalacji najnowszego `main`. Energy Ring przypina starszy
commit kolekcji. Między nim a sprawdzonym najnowszym stanem zmieniły się m.in. zachowanie
review przy czerwonym CI, szablony raportów i publikacja wczesnego draft PR.
Na sprint należy utrzymać jeden sprawdzony pin we wszystkich sandboxach; potrzebne
funkcje zweryfikować na tym pinie. Wcześniejszy draft można utworzyć ręcznie po push,
jeśli przypięty workflow nie tworzy go na początku.

## 4. Proponowany proces zespołu

```text
Decyzja zakresu (#2) → kontrakty i ownership (#3) → działająca podstawa (#4–#5)
  → przydzielone małe Issues → Cezar/worktree → PR → testy + review → merge
  → pokaz zintegrowanego przyrostu → następny przyrost
```

### Jedno miejsce na każdy rodzaj informacji

- Zakres i kontrakty: jedna zatwierdzona specyfikacja w `.ai/specs/`.
- Przydział i zależności: istniejące GitHub Issues, opcjonalnie Project.
- Szczegóły wznowienia: plan `.ai/runs/` danego zadania, zgodny z używanym skillem.
- Wynik review i testów: PR.
- Ten dokument: analiza porównawcza i propozycja procesu, nie druga specyfikacja.

### Definition of Ready pojedynczego zadania

Issue wskazuje właściciela, sandbox, cel, dozwolone pliki, zależności, kryteria odbioru,
testy i limit czasu. Nie ma nierozstrzygniętej decyzji produktowej. Jego implementacja
ma trwać około 1–2 godzin pracy właściciela; większy zakres podzielić.

Agent dostaje instrukcję ograniczoną do Issue i bieżącej fazy, nie całe MVP.
Specyfikację przygotować wymaganym `om-spec-writing`, a implementację dobrać przez
`om-help`: lokalne fazy przez `om-implement-spec` albo małe zatwierdzone zadanie przez
`om-auto-create-pr`. Nie uruchamiać obu wykonawców jednocześnie dla tej samej pracy.
W tej analizie nie uruchamiano tych skills wykonawczych.

### Kontrola równoległości

1. Trzy osoby używają własnych kont GitHub; przed startem sprawdzają wynik `gh api user`.
2. Koordynator przypisuje każde Issue dokładnie jednej osobie przed uruchomieniem Cezara.
3. Claim uwzględnia assignee, `in-progress` i komentarz; komentarz powinien dodatkowo
   identyfikować sandbox/run, bo samo konto nie identyfikuje procesu.
4. Ten sam użytkownik GitHub jest przez OM traktowany jako re-entry. Wspólny token
   trzech instancji może więc osłabić ochronę przed podwójnym wykonaniem.
5. Etykieta nie jest atomowym rozproszonym mutexem: odczyt i zapis są osobnymi operacjami.
   Nie uruchamiać trzech automatycznych konsumentów tej samej kolejki niezajętych Issues.
6. Nie zakładać, że Cezar synchronizuje wszystkie prywatne stany paneli; synchronizacja
   widoczności ma wynikać z konkretnych operacji na GitHubie.
7. W Cezarze używać jego istniejącego worktree zadania; nie tworzyć worktree w worktree.
8. Po awarii sprawdzić właściciela, branch, PR i ostatni wynik; wznowić ten sam run.
   Przejęcie zadania wymaga świadomego przekazania; nie skracać samowolnie czasu claim.

### Review i integracja

WIP: najwyżej jedno aktywne zadanie implementacyjne na osobę. Review rotacyjne A → B,
B → C, C → A. Reviewer nie równolegli autofixu z autorem na tym samym branchu.
Approval człowieka z innego konta jest oddzielny od samooceny agenta.

Koordynator scala PR-y kolejno i chroni wspólne pliki. Co około 2 godziny krótki pokaz
zintegrowanego wyniku. Zablokowane zadanie po 20–30 minutach diagnozy trafia do decyzji:
pomoc, odcięcie dodatku albo powrót do prostszego wariantu. To limit zarządzania pracą,
nie obietnica istnienia takiego parametru w Cezarze lub skillach.

Push, migracje i operacje ryzykowne pozostają zgodne z zasadami projektu i wymaganymi
potwierdzeniami. Plan nie daje agentom nowej zgody na publikację ani zmianę uprawnień.

## 5. Zakres MVP: jeden uczciwy scenariusz

### Must-have

1. Istniejące logowanie i uprawnienia Open Mercato; jeden demonstracyjny tenant/org.
2. Import wybranego dnia `csdac-pln`, paginacja, zachowane źródło, jednostka,
   czas interwału UTC i czas publikacji. Ograniczony zakres historii, np. 7–14 dni.
3. Ocena partii: brakujące/zdublowane interwały, null, data publikacji, liczby skończone;
   poprawne ceny ujemne nie są odrzucane. Zapis partii nie udaje pełnego sukcesu po błędzie.
4. Dwa proste baseline: odpowiadający interwał poprzedniej doby i poprzedniego tygodnia.
   Dobór interwału oraz zachowanie dla zmiany czasu muszą być jawne; brak pary oznacza
   brak wyniku, nie przesunięcie indeksów lub podmienienie wartości na zero.
5. Widok danych i jakości, prognozy bazowej oraz porównania z opublikowaną ceną.
6. MAE liczone na tym samym wspólnym zbiorze prawidłowych interwałów, wraz z liczbą
   porównanych punktów i jednostką PLN/MWh. Bez wyniku liczbowego dla pustej próby.
7. Odtwarzalny scenariusz demo z zapisanym źródłem danych; jawne oznaczenie replay/fixture.

Nie obiecywać MAE o 10% lepszego ani przewagi nad dwoma baseline w ciągu 20 godzin.
Kryterium inżynierskie to poprawny import, kontrola jakości, obliczenia i demonstracja;
jakość prognoz jest odrębną hipotezą badawczą.

### Dodatki tylko po ukończeniu podstawy

- Jedna dodatkowa seria wejściowa PSE i wyjaśnialna korekta z ustalonymi parametrami.
- Reguły jakości w module `business_rules`, jeśli krótki spike potwierdzi gotowy seam.
- Odświeżanie okresowe istniejącym schedulerem; SSE dopiero po działającym przepływie.

Start z ręcznym importem i odświeżeniem jest świadomą propozycją redukcji zakresu.
Nie budować własnego silnika reguł, event busa, kolejki czy scheduler frameworka.

### Poza sprintem

Python/ML, SHAP, trening, wiele źródeł pogodowych, pełny historyczny backfill, trading,
P&L/lewar, realne zlecenia, billing SaaS, własny system auth i rozbudowany panel reguł.

### Dane historyczne i prawda w demonstracji

`publication_ts <= cutoff` jest potrzebnym filtrem, lecz sam nie gwarantuje pełnego
point-in-time, gdy API pokazuje wyłącznie ostatnią rewizję. Zachowywać wersje i osobno
czas pobrania; nie dopisywać sztucznie wcześniejszych timestampów. Jeśli nie ma danych
odtwarzających historyczny stan wiedzy, pokazać porównanie na dostępnych danych z tym
ograniczeniem, nie nazywać go wiarygodnym backtestem strategii.

Pobranie odpowiedzi zawierającej już cenę docelową nie może pozwolić funkcji prognozy
na jej odczyt. Cel oceny i wejścia prognozy to oddzielne zbiory. Fixture do pokazania
błędnej partii jest jawnie syntetyczny, nie udaje pomiaru PSE.

## 6. Podział odpowiedzialności

Proponuję jeden mały moduł domenowy `energy_signals` z rozdzieleniem plików pracy.
To rekomendacja do #3, nie utworzony moduł. Trzy osoby nie wymagają trzech modułów
frameworka; dodatkowe granice i zdarzenia zwiększają koszt integracji.

| Osoba / sandbox | Odpowiedzialność | Wyłączna powierzchnia pracy po ustaleniu kontraktów |
| --- | --- | --- |
| A / `8afc4f45…` | Import, dane i koordynacja | `data/`, `migrations/`, adapter PSE, API importu; wspólne pliki tylko przez A |
| B / `0d04cacd…` | Jakość, obliczenia i testy | Biblioteki jakości/baseline/MAE oraz uzgodnione API obliczeń |
| C / `747c69d5…` | Widoki i scenariusz odbioru | `backend/`, komponenty, tłumaczenia i testy UI |

Wspólne `src/modules.ts`, `package.json`, lockfile, `acl.ts`, `setup.ts`, rejestracje
i kontrakty mają jednego właściciela A. Gdy potrzeba zmiany kontraktu, autor najpierw
uzgadnia ją z pozostałymi, a A scala zmianę przed dependent task. C może pracować na
uzgodnionym fixture w tej samej fazie, ale faza kończy się dopiero na prawdziwym API.

Nie współdzielić bazy developerskiej między sandboxami. W jednym sandboxie również
rozróżnić bazę aplikacji od bazy testów; nie uruchamiać migracji/reinstalacji trzech
worktrees przeciw temu samemu środowisku.

## 7. Budżet: 20 godzin zegarowych, trzy osoby

Założenie robocze: trzy osoby mają wspólne okno 20 godzin, czyli maksymalnie 60
roboczogodzin. To nie jest 60 godzin kodowania: rezerwuję 42 roboczogodziny na pracę
zaplanowaną i 18 na poprawki, review, integrację i nieprzewidziane problemy.
Jeśli limit oznacza 20 roboczogodzin łącznie, obowiązuje wariant w następnej sekcji.

| Okno od startu | Wynik i podział pracy | Bramka wyjścia |
| --- | --- | --- |
| 0–1 h | Wspólnie #2–#3: wybór jednej wizji, kontrakty, ownerzy; A koordynuje | Zatwierdzony zakres i gotowe małe zadania |
| 1–3 h | A: uruchomienie i minimalny moduł/CI; B: walidacja próbki i fixture; C: sprawdzenie istniejącego UI, smoke hosta | Host działa; kontrakt zintegrowany; znany wynik pełnego gate; sandboxy na tej samej podstawie |
| 3–7 h | Przyrost 1: A import i zapis; B jakość; C tabela partii i błędów | W UI widać zapisany poprawny import oraz odrzuconą niepełną partię |
| 7–11 h | Przyrost 2: A dostęp do zapisanych partii; B baseline i MAE; C ekran porównania | Jeden kompletny przebieg: import → kontrola → wynik → ocena |
| 11–14 h | Replay i przypadki graniczne; opcjonalny dodatek tylko gdy rdzeń zielony | Powtarzalne demo, sensowne komunikaty błędów, dowody testów |
| 14–17 h | Zamrożenie funkcji, poprawki i integracja; A głównie review/merge | Zintegrowany `main`, wszystkie obowiązkowe testy i gate zielone |
| 17–19 h | Końcowe QA, próba na docelowym sandboxie, instrukcja uruchomienia | Demo działa z nowej sesji; rozróżnione live/replay; znane ograniczenia |
| 19–20 h | Rezerwa demonstracji i awarii | Brak nowych funkcji; gotowy punkt odtworzenia |

Praca 0–14 h × 3 osoby = 42 roboczogodziny, pozostałe 6 h × 3 = 18 rezerwy.
Testy i review odbywają się też we wcześniejszych fazach; końcowa rezerwa nie jest
odłożeniem całego testowania na koniec. Estymata jest propozycją, nie pomiarem wydajności.

### Punkty redukcji zakresu

- Po 3 h host nie działa lub gate jest czerwony: wstrzymać dodatki i usunąć blokadę;
  nie udawać, że baza jest gotowa, oraz nie ukrywać błędów walidacji.
- Po 7 h import nie dociera do UI: zamrozić dodatkowe serie, scheduler i SSE.
- Po 11 h brak pełnego przepływu: utrzymać jeden baseline, tabelę i jawny replay;
  drugi baseline oraz korektę przenieść do backlogu.
- Po 14 h bez nowych funkcji. Po 17 h tylko poprawki blokujące demonstrację.
- Nie usuwać testów odcięcia czasowego, zakresów uprawnień i poprawności obliczeń,
  aby „zmieścić się” w czasie. Zmniejszać produkt.

## 8. Wariant ostrożny: 20 roboczogodzin łącznie

| Praca | Budżet zespołu |
| --- | ---: |
| Zakres i kontrakt; A przygotowuje, B/C krótko zatwierdzają | 1,5 h |
| Uruchomienie istniejącego hosta i modułu | 2,5 h |
| Jeden import PSE, zapis i minimalna jakość | 4 h |
| Jeden baseline i MAE | 3 h |
| Jedna strona: dane, jakość i porównanie | 3 h |
| Testy, review, integracja i demo | 4 h |
| Rezerwa | 2 h |
| **Suma** | **20 h** |

Odpadają korekta, dodatkowa seria, scheduler, SSE i konfigurowalne reguły. Brak czasu
na uruchomienie hosta lub pełnego gate oznacza ryzyko niedostarczenia MVP. Jeżeli zostanie
wyłącznie fixture i UI, rezultat nazywamy prototypem, nie ukończonym MVP z integracją.
Równoległość trzech osób nie oznacza automatycznie ukończenia w 6 h 40 min: istnieją
zależności oraz praca wymagająca wspólnego odbioru.

## 9. Minimalna walidacja, której nie usuwać

| Przypadek | Oczekiwany dowód |
| --- | --- |
| Powtórzenie importu i paginacja | Brak duplikacji; komplet stron; błąd pośredniej strony nie daje statusu pełnego sukcesu |
| Niepełna partia, null, duplikat, cena ujemna | Niepoprawne dane blokowane/oznaczone; poprawna ujemna cena zachowana |
| Dane po cutoff i rewizje | Nie trafiają do wejścia prognozy; jawna informacja o braku wersji historycznej |
| Baseline/MAE | Ręcznie policzony mały fixture; wspólne interwały; brak dzielenia przez zero |
| DST i dopasowanie czasu | Jawna obsługa 92/96/100 albo bezpieczna odmowa nieobsługiwanego dnia z komunikatem |
| Uprawnienia i scope | Brak dostępu bez uprawnienia; brak odczytu danych innej organizacji |
| Pełny przebieg | Test integracyjny import → zapis → odczyt → obliczenia, oraz test negatywny |
| UI | Loading/empty/error, klawiatura, wąska szerokość, light/dark; screenshot działającego przepływu |

W pętli kodowania uruchamiać testy dotkniętej logiki. Przed odbiorem kodowego PR
obowiązuje aktualny gate repo, a nie krótsza lista wymyślona na potrzeby sprintu:

```bash
yarn generate && yarn typecheck && yarn lint && yarn ds:check && yarn test && yarn build
```

Testy integracyjne korzystają z przygotowanego środowiska, zgodnie z lokalnym
`om-integration-tests` i `yarn test:integration:ephemeral`. Migracji nie wykonywać
w celu samego „sprawdzenia” na nieustalonej bazie. Generator migracji i zastosowanie
migracji to oddzielne kroki, z review SQL i wymaganym potwierdzeniem.

`qaGate: false` nie oznacza, że QA zrobiono. Dla MVP trzeba ustalić obowiązkowy
odbiór scenariusza przez drugą osobę; ewentualne włączenie automatycznej bramki jest
oddzielną zmianą konfiguracji. Nie deklarować PASS dla nieuruchomionych poleceń.

## 10. Jak wykorzystać istniejące Issues

| Issue | Proponowana aktualizacja, jeszcze niewykonana |
| --- | --- |
| [#2](https://github.com/bigklata/energy-ring/issues/2) | Wybrać demonstrator i limit budżetu; uwzględnić `docs-marek`; usunąć omyłkową samozależność |
| [#3](https://github.com/bigklata/energy-ring/issues/3) | Właściciele, jeden mały moduł lub uzasadniony podział, kontrakty i testy odbioru |
| [#4](https://github.com/bigklata/energy-ring/issues/4) | Nie tworzyć ponownie hosta; dodać minimalny moduł energetyczny i rzeczywiste CI |
| [#5](https://github.com/bigklata/energy-ring/issues/5) | Potwierdzić uruchomienie tej samej podstawy w trzech sandboxach, a nie tylko obecność plików |
| [#6](https://github.com/bigklata/energy-ring/issues/6) | Ograniczyć do jednej serii, małej historii, paginacji, idempotencji i jakości |
| [#7](https://github.com/bigklata/energy-ring/issues/7) | Baseline i MAE; nazwać replay zgodnie z dostępnością wersji historycznych |
| [#8](https://github.com/bigklata/energy-ring/issues/8) | Jeden główny przepływ danych/jakości/porównania; usunąć alternatywne wizje UI po decyzji #2 |
| [#9](https://github.com/bigklata/energy-ring/issues/9) | Project opcjonalny na start; nie blokuje #6–#8 |
| [#10](https://github.com/bigklata/energy-ring/issues/10) | CODEOWNERS i ochrona main; wymagany check dopiero po jego rzeczywistym uruchomieniu |

Issues #6–#8 można pozostawić jako nadrzędne kontenery i podzielić na krótkie zadania
wewnątrz bieżącej fazy. Nie uruchamiać jednocześnie trzech całych wieloetapowych planów,
które zakładają, że zależności „jakoś dojdą”.

## 11. Decyzje przed startem implementacji

1. Potwierdzić, czy 20 godzin to czas zegarowy trzech osób czy łączny nakład.
2. Zatwierdzić albo odrzucić proponowane cięcie do demonstratora PSE/baseline.
3. Ustalić loginy, koordynatora, ownership i konta używane przez sandboxy.
4. Przygotować zatwierdzoną specyfikację w repo przez `om-spec-writing`, z wymaganymi
   kontraktami i kryteriami, zgodnie z `AGENTS.md` i `spec-delivery.md`.
5. Potwierdzić działający host i wynik gate przed uruchomieniem równoległej implementacji.

Do uruchomienia tego procesu nie potrzeba budowy nowego orchestratora ani instalacji
pełnego dx. Największą oszczędność daje ograniczenie produktu i małe, jednoznaczne zadania.

## Źródła i ścieżki dowodowe

- [Energy Ring — sprawdzony main][ER]; `package.json`, `src/modules.ts`, `src/modules/`.
- [Konfiguracja pipeline][ER-CONFIG], [przypięte skills][ER-TIERS], [AGENTS.md][ER-AGENTS].
- [Koncepcja tradingowa][ER-CONTEXT], [koncepcja ML][ER-GRZEGORZ], [analiza Marka][ER-MAREK], [pomiary w repo][ER-PSE].
- [Istniejący plan zespołu](team-workflow.md), [backlog GitHub](https://github.com/bigklata/energy-ring/issues).
- [dx: workflow][DX-FLOW], [plan][DX-PLAN], [implement vs TDD][DX-TDD], [review i triage][DX-REVIEW].
- [OM: tworzenie PR][OM-CREATE], [claim][OM-CLAIM], [review][OM-REVIEW], [wersja przypięta w aplikacji][OM-PIN].

[ER]: https://github.com/bigklata/energy-ring/tree/7836e464def22a0c59cfb38fb088e9847092979f
[ER-CONFIG]: https://github.com/bigklata/energy-ring/blob/7836e464def22a0c59cfb38fb088e9847092979f/.ai/agentic.config.json
[ER-TIERS]: https://github.com/bigklata/energy-ring/blob/7836e464def22a0c59cfb38fb088e9847092979f/.ai/skills/tiers.json
[ER-AGENTS]: https://github.com/bigklata/energy-ring/blob/7836e464def22a0c59cfb38fb088e9847092979f/AGENTS.md
[ER-CONTEXT]: https://github.com/bigklata/energy-ring/blob/7836e464def22a0c59cfb38fb088e9847092979f/CONTEXT.md
[ER-GRZEGORZ]: https://github.com/bigklata/energy-ring/blob/7836e464def22a0c59cfb38fb088e9847092979f/docs-grzegorz/product-brief.md
[ER-MAREK]: https://github.com/bigklata/energy-ring/blob/7836e464def22a0c59cfb38fb088e9847092979f/docs-marek/domain-model.md
[ER-PSE]: https://github.com/bigklata/energy-ring/blob/7836e464def22a0c59cfb38fb088e9847092979f/docs-marek/pomiary-api-pse.md
[DX-FLOW]: https://github.com/dikamilo/dx-workflow/blob/f10d3c4f42d73e3c151f98e1d88b21ff4ff04560/docs/explanation/workflow-overview.md
[DX-PLAN]: https://github.com/dikamilo/dx-workflow/blob/f10d3c4f42d73e3c151f98e1d88b21ff4ff04560/skills/dx-plan/SKILL.md
[DX-TDD]: https://github.com/dikamilo/dx-workflow/blob/f10d3c4f42d73e3c151f98e1d88b21ff4ff04560/docs/explanation/implement-vs-tdd.md
[DX-REVIEW]: https://github.com/dikamilo/dx-workflow/blob/f10d3c4f42d73e3c151f98e1d88b21ff4ff04560/docs/tutorials/review-and-triage.md
[OM-CREATE]: https://github.com/open-mercato/skills/blob/7c81ffe68d99a9263143110c150e903d910f7526/skills/om-auto-create-pr/SKILL.md
[OM-CLAIM]: https://github.com/open-mercato/skills/blob/7c81ffe68d99a9263143110c150e903d910f7526/skills/om-auto-create-pr/references/claim-pr.md
[OM-REVIEW]: https://github.com/open-mercato/skills/blob/7c81ffe68d99a9263143110c150e903d910f7526/skills/om-auto-review-pr/SKILL.md
[OM-PIN]: https://github.com/open-mercato/skills/tree/c6103c034571f3610323a1b53d97c81abe110b58
