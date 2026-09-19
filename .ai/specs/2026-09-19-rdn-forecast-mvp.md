# Energy Ring — MVP prognozy RDN

**Date**: 2026-09-19
**Status**: Draft

## TLDR

Użytkownik zatwierdził 2026-09-19 wariant „Prognoza RDN”: import PSE → kontrola jakości → prognoza ceny na jutro przez korektę baseline’u → porównanie z opublikowanymi cenami. Odbiorcą pierwszego pokazu jest zespół Energy Ring. Bez tradingu, portfela, P&L, lewara i treningu ML.

To specyfikacja zakresu i dopracowania backlogu, nie zatwierdzony projekt techniczny. Decyzja produktowa jest rozstrzygnięta; kontrakty i mechanizmy implementacji zamyka #3. Źródłem decyzji w trackerze jest https://github.com/bigklata/energy-ring/issues/2. Zgoda na MVP nie zatwierdza automatycznie wszystkich ADR-ów z `docs-marek/`.

## Problem Statement

Trzy wcześniejsze propozycje opisywały różne produkty. Backlog #6–#8 pozostawał placeholderem, a założenia o dostępności danych, godzinie publikacji i historii nie stanowiły kontraktu. Potrzebny jest jeden demonstracyjny przepływ pozwalający odtworzyć pochodzenie prognozy i uczciwie porównać ją z prostymi metodami odniesienia.

## Overview and Success Measures

- **Primary outcome:** dla kompletnej doby pokazać zaakceptowane wejścia, prognozę, dwa baseline’y, rzeczywiste ceny po publikacji oraz MAE na tym samym zbiorze interwałów.
- **Leading indicators:** kompletność, najnowszy czas publikacji, wiek pobrania, liczba zaakceptowanych/odrzuconych partii i przyczyna braku prognozy.
- **Baseline:** poprzednia doba i poprzedni tydzień dla odpowiadających interwałów; szczegółowe dopasowanie DST zatwierdza #7 przed implementacją.
- **Sukces dostarczenia:** odtwarzalny przepływ i poprawne zabezpieczenia. **Skuteczność metody:** MAE niższe od obu baseline’ów na z góry ustalonym okresie; brak poprawy jest wynikiem eksperymentu, nie powodem ukrycia dni lub błędów. Nie przyjmujemy z poprzedniej wizji progu 10%.
- **Market / product reference:** publiczne raporty PSE jako źródło i porównanie prognozy z realizacją. Szerszy benchmarking narzędzi prognozowania pozostaje poza tym dopracowaniem; nie twierdzimy, że zbadano liderów rynku. Minimalizm dotyczy braku tradingu, platformy ML i wieloźródłowości.

## Goals

- **REQ-001** — audytowalny import i widoczna ocena jakości danych PSE.
- **REQ-002** — deterministyczna prognoza RDN z dwoma baseline’ami, wyjaśnieniem korekty i dowodem dostępności wejść w momencie odcięcia.
- **REQ-003** — ocena na opublikowanych cenach i uczciwy replay z oznaczeniem ograniczeń historii.
- **REQ-004** — dostępny dla uprawnionego użytkownika pełny scenariusz UI; brak dostępu między tenantami/organizacjami.

## Non-goals

Trading rzeczywisty lub demo, portfel, P&L, lewar, kill-switch, rekomendacje transakcyjne, trening ML, SHAP, Python ML service, ENTSO-E, Open-Meteo, IMGW, prognozy RDB, SaaS onboarding i ręczna edycja surowych punktów pomiarowych. Izolacja tenant/organization pozostaje obowiązkowa mimo wewnętrznego odbiorcy.

## Proposed Solution

Zawęzić backlog do jednego wyniku: użytkownik widzi, z jakich danych powstała prognoza i jak wypadła względem cen oraz baseline’ów. Zachować niezmienne wersje wejść i wyników. Każde niewykonanie operacji ma zrozumiały powód. Dane demonstracyjne i replay są oznaczone; nie udają prognozy live.

### Design Decisions and Alternatives

| Decision | Rationale | Alternative considered | Why rejected / deferred |
|---|---|---|---|
| Prognoza RDN, bez handlu | Decyzja użytkownika 2026-09-19 | Trading demo | Osobny produkt i inny miernik sukcesu |
| Korekta baseline’u bez treningu | Mały, interpretowalny eksperyment | SaaS ML + SHAP | Poza zatwierdzonym MVP |
| Najpierw sprawdzenie źródeł w #6 A | Korekta potrzebuje danych dostępnych przed odcięciem | Przyjęcie całego modelu Marka | Wskazane tam źródła nie gwarantują prognoz wiatru/PV |
| Nazwy modułów, business rules, scheduler i transport aktualizacji do ustalenia w #3 | Nie wybieramy mechanizmów wyłącznie pod podział na trzy osoby | Automatyczne przyjęcie ingest/quality/forecast i SSE | Brak zatwierdzenia granic i weryfikacji seamów |

## Domain Vocabulary and Business Rules

| Term / invariant | Precise meaning or rule | Source of truth | Failure behavior |
|---|---|---|---|
| Doba D | Doba dostawy w Europe/Warsaw | Kalendarz i kontrakt PSE | Nie zakładać zawsze 96 MTU: zwykła doba 96, zmiana czasu 92/100 |
| MTU | Interwał 15 minut identyfikowany po granicach UTC, z lokalną etykietą i offsetem | Kontrakt #3 | Odrzucić duplikaty/luki; nie scalać powtórzonej godziny lokalnej |
| Cena | Cena RDN w PLN/MWh, dopuszczalne wartości ujemne | `csdac-pln.csdac_pln` | Null nie oznacza zera; brak danych blokuje ocenę |
| Publikacja | Czas podany przez dostawcę dla konkretnego rekordu/wersji | `publication_ts_utc` | Nie zastępować czasem pobrania ani jednym timestampem całej partii |
| Pobranie | Czas, kiedy aplikacja pozyskała wersję | Zegar aplikacji | Zachować niezależnie od publikacji |
| Odcięcie | Jawny moment zamknięcia wejść, wcześniejszy od pierwszej publikacji ceny dla D | Utrwalone uruchomienie | Uruchomienie po poznaniu celu nie jest prognozą live |
| Dostępność wejścia | Publikacja wersji nie później niż odcięcie; w live również faktyczne pobranie przed odcięciem | Niezmienny snapshot | Nieweryfikowalną historię oznaczyć lub wykluczyć z oceny point-in-time |
| Kompletność | Pełny oczekiwany zbiór unikalnych interwałów i niepustych wymaganych pól | #3 + katalog źródeł #6 A | Brak prognozy zamiast cichego uzupełniania |
| Rewizja | Nowa wersja bez nadpisania poprzedniej | Import | Poprzednie prognozy i oceny zachowują wskazanie wersji |
| Jakość | Akceptacja lub odrzucenie z kodami przyczyn; dokładny automat stanów zamyka #3 | Właściciel partii | Nigdy nie konsumować częściowego/odrzuconego importu |

Nie przyjmować ~13:50 z pojedynczego pomiaru jako SLA, terminu giełdowego ani stałego odcięcia. #7 definiuje odcięcie z marginesem i kryterium spóźnienia. Progi cen nie mogą pochodzić z zaobserwowanego minimum/maksimum ani niepotwierdzonej hipotezy o limicie EUR.

## Users, Permissions, and Scope

| Actor | Allowed outcomes | Scope rule | Required feature IDs |
|---|---|---|---|
| Czytelnik | Odczyt danych, jakości, prognoz i ocen | Uwierzytelniony tenant i organization | Dokładne identyfikatory ustala #3 |
| Operator | Import, ponowienie bez duplikacji, uruchomienie prognozy/replay | Ten sam zaufany scope, sprawdzany po stronie serwera | Oddzielne uprawnienia mutacji w #3 |

Scope z sesji/autoryzowanego kontekstu serwera; brak scope oznacza odmowę. Publiczne dane PSE nie oznaczają zgody na `organizationId: null` ani globalny zapis. Nie używać nazw ról jako reguł autoryzacji.

## Reuse and Ownership Map

| Capability | Reuse / extend / app-own | Existing module or new module | Integration seam | Why |
|---|---|---|---|---|
| Sesja i uprawnienia | Reuse | auth platformy | Zaufany kontekst i feature gates | Nie tworzyć własnego uwierzytelniania |
| Dane, prognozy, oceny | App-own | Dokładne granice ustala #3 | IDs/snapshots/events, bez między-modułowych relacji ORM | Jednoznaczna własność niezmienników |
| Import, planowanie, jakość, odświeżanie | Reuse przed custom | Installed capabilities do oceny w #3 | Zweryfikowane kontrakty, bez zgadywania kluczy | Nie budować równoległych kolejek/cache/transportu |
| Panel | App-own, shared UI | Właściciel ustalany w #3 | Page metadata, DataTable, wspólne API helpers | Spójność hosta |

## Architecture and Data Flow

```text
PSE -> wersjonowany import -> ocena jakości -> zamknięty snapshot wejść
                                                    -> prognoza + baseline’y
opublikowane ceny D -> wersjonowany zbiór odniesienia -> ocena -> UI
```

- **Module boundaries:** otwarte w #3; każda encja ma jednego właściciela, wspólny plik encji dla trzech modułów nie jest kontraktem.
- **Extension points:** dokładne API/page/event/worker seams, ich pliki referencyjne i testy należą do wyjścia #3. Obecny dokument nie deklaruje nowych identyfikatorów runtime.
- **Alternatives considered:** jeden moduł domenowy kontra rozdzielenie importu i analityki. Wybór wymaga przeglądu niezmienników, nie liczby osób.
- **Compatibility:** brak zmian istniejących kontraktów w tym zadaniu; obowiązuje `.ai/guides/upstream/BACKWARD_COMPATIBILITY.md` przy ich projektowaniu.

## User Journeys

### Journey J-001 — Od danych do oceny

1. Operator otwiera panel, wybiera dobę i widzi dostępność danych oraz czas ich publikacji/pobrania.
2. Importuje lub bezpiecznie ponawia pobranie. W UI pojawia się kompletność i wynik jakości z przyczynami.
3. Uruchamia prognozę przed odcięciem, gdy wymagane dane są zaakceptowane; wynik zawiera baseline’y i składniki korekty.
4. Po publikacji kompletnego celu ogląda ceny rzeczywiste oraz porównywalne MAE.
5. Braki, spóźnienie, odmowa dostępu i konflikt są odrębnymi stanami; retry nie duplikuje wyników.

### Journey J-002 — Odtworzenie

Użytkownik wybiera utrwalony snapshot/uruchomienie. Replay pokazuje moment odcięcia, wersje wejść, parametry i ograniczenia historycznej dostępności. Ponowienie daje ten sam wynik. Niekompletna historia nie jest przedstawiana jako wiarygodny historyczny backtest.

## UI and Interaction Contracts

Dokładne ścieżki i odpowiedzi API ustala #3 przed implementacją #8. Referencja source-present, runtime-disabled: `src/modules/example/backend/todos/page.tsx` i `src/modules/example/components/TodosTable.tsx`; sprawdzono użycie `Page`, `PageBody`, `DataTable`, scoped helpers i obsługi konfliktów. To wzorzec hosta, nie funkcja Energy Ring już dostępna w aplikacji.

| Surface / route | Purpose and primary actions | Data source / mutations | Closest installed reference | Canonical shell / components | Required states | Requirement IDs |
|---|---|---|---|---|---|---|
| Panel danych i prognozy; route w #3 | Doba, import/retry, prognoza/replay, ocena | Kontrakty odczytu i komend #3 | Powyższy przykład aplikacji; nie założono nowego installed hosta | Page, PageBody, DataTable, StatusBadge, wspólne helpers | loading, empty, error, denied, pending, blocked, success, conflict | REQ-001–004 |

### UI architecture

| Role | Navigation groups in order | Dashboard / injected widgets | Login-to-primary-task flow |
|---|---|---|---|
| Uprawniony użytkownik | Energy Ring → Prognoza RDN; ostateczny klucz w #3 | Brak wymagania widgetów/injekcji | Login → panel → wybór doby; cel ≤3 kliknięcia |

| Surface / widget | Empty state guidance and action | Responsive behavior | Keyboard / focus behavior |
|---|---|---|---|
| Panel | Powód braku danych + import, tylko gdy dozwolony | Sterowanie zawija się; tabela zachowuje dostęp do kolumn | Etykiety, logiczny fokus, komunikaty async, brak pułapek |

### Panel prognozy RDN — route do zamknięcia w #3

```text
Prognoza RDN   [Doba dostawy] [Odśwież]
Dane: publikacja / pobranie / kompletność / jakość [Import / Ponów]
Prognoza: odcięcie / wersja / tryb live lub replay [Uruchom]
Interwał | baseline D-1 | baseline D-7 | korekta | prognoza | cena
Ocena: MAE prognozy / obu baseline’ów / liczba ocenionych MTU
```

- **Behavior:** stan oczekiwania na ceny nie jest błędem ani zerową ceną; stary wynik pozostaje oznaczony. Referencje mają nazwy dat/serii, nie UUID. Mutacje przez komendy; błędy nie kasują wyboru doby.
- **Responsive and accessibility:** light/dark, narrow/wide, klawiatura, focus, czytelne etykiety i ogłaszanie rezultatów. Wykres, jeśli wybrany w #8, ma dostępny odpowiednik tabelaryczny i korzysta z istniejącej rodziny komponentów.
- **Localization:** wszystkie teksty w i18n; daty jawnie opisane Europe/Warsaw, UTC w kontrakcie.
- **Design-system and theming:** shared tokens, bez statusów kodowanych kolorem. DataTable dla tabel, CrudForm tylko jeśli #3 przewidzi edytowalną konfigurację; nie rozszerzać MVP o CRUD surowych pomiarów.

## Data Models

Model logiczny do zamknięcia w #3: seria źródłowa, wersjonowana partia i punkty, uruchomienie prognozy, punkty wyniku, wersjonowana ocena. Właściciel encji, nazwy klas, indeksy i schemat nie są zatwierdzone przez wybór wariantu produktu.

Wymagane informacje: tenant/organization, seria i pole/jednostka, granice interwału UTC, doba lokalna, publikacja per rekord, pobranie, rewizja/provenance, jakość i przyczyny. Prognoza przechowuje odcięcie, snapshot wejść, wersję algorytmu/parametrów oraz tryb. Ocena wskazuje wersję cen odniesienia. Równoczesne identyczne uruchomienia muszą mieć udokumentowaną idempotencję; edytowalne rekordy wymagają `updated_at`. Retencję i wielkość backfillu ustala #6 A, nie pobierać całego archiwum bez potrzeby.

## API, Command, and Error Contracts

Dokładne endpointy, IDs, payloady i statusy są blokującym wynikiem #3. Wymagane operacje: odczyt partii/jakości, uruchomienie importu, odczyt prognozy/oceny, uruchomienie prognozy/replay. Każda mutacja przez komendę; CRUD przez `makeCrudRoute` tam, gdzie pasuje. Każda metoda ma `metadata` i `openApi`. Kontrakty muszą pokryć walidację, 401/403, scoped not-found, konflikt 409 i provider-unavailable; klucz powtórzenia nie zastępuje wersji edytowanego rekordu.

Nie ma jeszcze zatwierdzonych nowych publicznych kontraktów. #3 dostarcza przykład request/response i fixture dla każdej operacji, a nie „szkicowo spisane kontrakty”.

## Events, Jobs, Notifications, and Cross-Module Flows

#3 wybiera istniejące mechanizmy uruchomienia importu, postępu i odświeżania. Efekty dopiero po commit, idempotentni konsumenci, ograniczone retry/backoff i czytelny terminalny błąd. Częściowy import nie emituje gotowości do prognozy. Scheduler i SSE z analizy Marka to kandydaci, nie już zatwierdzony zakres. Harmonogram w #6 nie jest gwarancją świeżości PSE. Powiadomienia i nowa infrastruktura nie są wymagane.

## Security, Privacy, and Compliance

Feature gates na serwerze, filtr scope dla odczytu i zapisu, scoped fixtures w testach; UI nie jest granicą autoryzacji. Publiczne dane rynkowe nie wymagają udawania danych osobowych, lecz sesje i ewentualne sekrety pozostają w mechanizmach platformy. Adapter akceptuje wyłącznie ustalone źródło/endpointy, nie dowolny URL użytkownika; kolejne strony muszą pozostać w dozwolonym źródle. Nie wykonywać migracji w ramach dopracowania ani walidacji planu.

## Integration Coverage

Poniższe to plan testów, nie wykonane testy aplikacji. Dokładne ścieżki i osobny test każdego extension surface zostaną dopisane w #3.

| Test ID | Level | Setup / fixture | Actions | Assertions | Requirement IDs |
|---|---|---|---|---|---|
| TEST-001 | API/integration | Własny scope, provider stub, dwie strony, rewizja i przerwanie | Import + retry + równoczesne powtórzenie | Bez duplikacji, brak publikacji częściowego zestawu, zachowane wersje | REQ-001 |
| TEST-002 | API/domain | Doby zwykłe i DST; null, ujemne ceny, luki/duplikaty | Import i ocena jakości | Poprawne 92/96/100 MTU, null ≠ 0, czytelne przyczyny | REQ-001 |
| TEST-003 | API/domain | Jawne snapshoty przed/po odcięciu, parametry i ręcznie policzony wynik | Prognoza i replay | Identyczny wynik; późne dane wykluczone; brak wymaganej wersji blokuje | REQ-002 |
| TEST-004 | API/domain | Kompletna/niekompletna cena i jej późniejsza rewizja | Ocena prognozy i baseline’ów | MAE na tym samym N, brak cichego doboru dni, wersjonowana ocena | REQ-003 |
| TEST-005 | Security/integration | Dwa tenanty, dwie organizacje w jednym tenancie i niedozwolone uprawnienia | Wszystkie odczyty/mutacje, także po znanym ID | Brak przecieku i zapisu poza scope | REQ-001–004 |
| TEST-006 | Browser/E2E | Self-contained fixtures z poprzednich testów | J-001/J-002, loading/empty/error/blocked/conflict, keyboard, narrow, light/dark | Wynik zgodny z API, jasny powód blokady, bez surowych UUID | REQ-004 |

## Implementation Phases

### Phase 0 — Zamknięcie kontraktów i źródeł

- **Depends on:** zaakceptowany zakres #2; nie wymaga kodu szkieletu.
- **Outcome:** #6 A dostarcza katalog źródeł i dowody, refinement #7 określa wzór/odcięcie/mapowanie, a #3 zamyka kontrakt oraz przykłady dla trzech obszarów.
- **Why this order / value delivered:** eliminuje zgadywanie danych, wzajemnie blokujące się kontrakty i pozorny backtest.
- **Deliverables:** spec techniczna, źródła/ograniczenia, właściciele, endpointy/schematy/ACL, ledger extension surfaces z exact example file + klasyfikacją + testem.
- **Independent slices / estimated commits:** weryfikacja źródeł i przegląd własności mogą trwać równolegle; refinement #7 korzysta z wyników #6 A, a finalny kontrakt #3 czeka na obie prace. Estymacja po #3.
- **Requirements closed:** gotowość projektowa, żadna funkcja runtime.
- **Tests:** przegląd traceability i fixtures TEST-001–006.
- **Validation:** odczyt kontraktów i dowodów, bez migracji.
- **Exit gate:** brak blokujących decyzji technicznych całego MVP, w tym z refinementu #7; spec gotowa oraz zgoda na implementację; następnie #4/#5 dostarczają wspólny działający host i CI.

### Phase 1 — Import i jakość widoczne w panelu

- **Depends on:** Phase 0, #4, #5.
- **Outcome:** operator pobiera dane i widzi kompletność/provenance oraz przyczynę odrzucenia.
- **Why this order / value delivered:** pierwsza samodzielnie użyteczna ścieżka, bez obietnicy prognozy na nieznanych danych.
- **Deliverables:** #6 B + część #8; docelowe pliki i seams z #3.
- **Independent slices / estimated commits:** adapter i UI na uzgodnionych fixtures; spięcie wymagane przed wyjściem. Estymacja po #3.
- **Requirements closed:** REQ-001, część REQ-004.
- **Tests:** TEST-001, TEST-002, TEST-005 i TEST-006 dla importu.
- **Validation:** broad gate z AGENTS.md + `yarn test:integration:ephemeral`; dane syntetyczne, nie zależność CI od PSE.
- **Exit gate:** import/retry/odrzucenie działają w API i UI, także przy provider failure, w light/dark i narrow.

### Phase 2 — Prognoza, ocena i replay

- **Depends on:** Phase 1 exit gate.
- **Outcome:** kompletne J-001 i J-002.
- **Why this order / value delivered:** pokazuje wynik zatwierdzonego MVP na wersjonowanych danych.
- **Deliverables:** #7 + pozostała część #8; wzór korekty i odcięcie zatwierdzone przed kodowaniem.
- **Independent slices / estimated commits:** obliczenia i UI mogą powstawać równolegle na fixtures wewnątrz tej fazy; estymacja po kontraktach.
- **Requirements closed:** REQ-002–004.
- **Tests:** TEST-003–006; pełny scenariusz obejmuje import z Phase 1.
- **Validation:** `yarn generate && yarn typecheck && yarn lint && yarn ds:check && yarn test && yarn build`; `yarn test:integration:ephemeral`.
- **Exit gate:** deterministyczny wynik, porównywalne MAE, blokada leakage/braków, dozwolone i zabronione scope oraz pełne stany UI. Niższy MAE nie jest gwarantowany ani fabrykowany.

## Requirement Traceability

| Requirement | Journey / surface | Data/API/event contracts | Phase | Tests | Acceptance criterion |
|---|---|---|---|---|---|
| REQ-001 | J-001 / dane | #3, #6 A/B | 1 | TEST-001/002/005/006 | AC-001 |
| REQ-002 | J-001/J-002 / prognoza | #3, #7 | 2 | TEST-003/005/006 | AC-002 |
| REQ-003 | J-001/J-002 / ocena | #3, #7 | 2 | TEST-004/005/006 | AC-003 |
| REQ-004 | J-001/J-002 / panel | #3, #8 | 1–2 | TEST-005/006 | AC-004 |

Blokada gotowości: #3 musi dopisać osobny wiersz dla każdego nowego API/page/event/worker/ACL/setup surface, exact file z `src/modules/example/references/surface-inventory.json`, klasyfikację mechanizmu oraz własny self-contained test. Ta macierz produktowa tego nie zastępuje.

## Rollout, Migration, and Rollback

To zmiana dokumentacji, bez instalacji, wdrożenia ani migracji. Implementacja generuje migracje przez `yarn db:generate`, przegląda SQL/snapshot i pyta przed zastosowaniem. Wyłączenie uruchomień zachowuje surowe wersje i wyniki; nie usuwa się historycznych obserwacji w ramach rollbacku. Szczegółowy plan migracji/retencji i odwracania wdrożenia zamyka #3.

### Migration & Backward Compatibility

Nie zmieniono runtime API, encji ani eksportów. Historyczne wizje zachowano z informacją o nowym zakresie. Przyszłe additive kontrakty i wersjonowanie są przeglądane według `.ai/guides/upstream/BACKWARD_COMPATIBILITY.md`.

## Risks and Tradeoffs

| Risk / tradeoff | Impact | Mitigation / detection | Residual risk |
|---|---|---|---|
| API zwraca najnowszą rewizję zamiast wersji znanej historycznie | Fałszywa przewaga w backteście | Snapshoty, publikacja i pobranie per wersja; ujawnienie braków historii | Nie każdą dawną dobę da się uczciwie odtworzyć |
| Godzinowe wejścia vs MTU celu | Błędna korekta lub przesunięcie | Jawne mapowanie przed #7, testy granic UTC i DST | Nie podnosi to realnej rozdzielczości źródła |
| Stała 13:50 lub 96 rekordów | Leakage/blokowanie prawidłowych dni | Odczyt faktycznej publikacji, kalendarz i stała polityka odcięcia | PSE nie gwarantuje harmonogramu na podstawie naszych prób |
| Retry, przerwanie i równoległe uruchomienia | Duplikaty/niepełne wyniki | Idempotencja, atomowa publikacja kompletnego zestawu, post-commit effects | Konkretny seam wymaga #3 |
| Wspólne źródło pomylone z globalnym scope | Przeciek/nieautoryzowana mutacja | Fail-closed i TEST-005 | Brak wyjątku dla wewnętrznej aplikacji |
| Brak poprawy MAE | Słaby wynik eksperymentu | Raportować pełny z góry wybrany okres i oba baseline’y | Korekta może być gorsza; bez strojenia na zbiorze oceny |
| Provider outage/skala archiwum | Nieaktualne dane/długi import | Bounded backfill, limit żądań, retry i widoczna świeżość | Parametry operacyjne do zamknięcia w #6 A |

## Acceptance Criteria

- [ ] **AC-001** — operator w swoim scope importuje kompletną dobę; retry nie duplikuje, rewizja zachowuje historię, niekompletna doba ma widoczny powód blokady.
- [ ] **AC-002** — prognoza i replay z identycznego snapshotu i parametrów są identyczne; nie używają wersji późniejszych niż odcięcie, wskazują brak wymaganych danych.
- [ ] **AC-003** — po publikacji kompletnego celu UI pokazuje MAE prognozy i dwóch baseline’ów na tych samych MTU oraz jawne ograniczenia historii.
- [ ] **AC-004** — J-001/J-002 działają dla uprawnionego użytkownika, brak przecieku między tenantami i organizacjami; UI pokrywa loading/empty/error/blocked/conflict/keyboard/a11y/narrow/light/dark.
- [ ] Każda runtime surface ma zatwierdzony kontrakt i własny self-contained integration test; configured validation gate przechodzi.

## Final Compliance Report

| Check | Status | Evidence / resolution |
|---|---|---|
| Applicable AGENTS and routed spec/UI context reviewed | pass | om-spec-writing, spec-delivery, backend-ui, quality-states, BC |
| Data models, APIs, events, UI and tests internally consistent | fail | Niekompletne do implementacji (nie sprzeczne): dokładne kontrakty i ledger wymagają #3 |
| End-to-end phases without catch-all integration phase | pass | Faza 1 import + UI, faza 2 prognoza/ocena + UI |
| Platform-native reuse chosen before custom code | fail | Zasada przyjęta; mechanizmy jakości/uruchomień do weryfikacji w #3 |
| UI references and state/theme coverage | pass | Example Page/TodosTable + jawna macierz stanów |
| Every phase has bounded slices, tests, value and exit gate | fail | Sekwencja i kryteria określone; pliki/seams oraz zakres commitów czekają na kontrakty |

**Verdict: Blocked — dokładne kontrakty, katalog źródeł i parametry metody wymagają #3, #6 A i #7.** Dopracowanie backlogu nie oznacza zakończenia jego implementacji.

## Open Questions

| ID | Question | Owner | Blocking? | Resolution / decision date |
|---|---|---|---|---|
| Q-001 | Który produkt? | Użytkownik / #2 | resolved | Prognoza RDN, 2026-09-19 |
| Q-002 | Jakie moduły, kontrakty, ACL i mechanizmy platformy? | #3 | yes, implementation | Doprecyzować z installed evidence; nie blokuje research #6 A |
| Q-003 | Które prognozowane pola/wersje są dostępne przed odcięciem? | #6 A | yes, source contract | Kandydaci i odczyty poniżej; historia rewizji do potwierdzenia |
| Q-004 | Jaki wzór, współczynniki, cutoff, mapowanie godzin/DST i okres oceny? | #7 refinement | yes, analytics implementation | Jawny, wersjonowany kontrakt bez treningu; zatwierdzić przed kodowaniem |
| Q-005 | Loginy A/B/C i koordynator wspólnych plików? | Zespół / #3 | yes, assignment | Zachowano dotychczasowe role i sandboxy, bez wymyślania assignee |

To prace przypisane do backlogu, nie żądanie ponownego wyboru produktu. Dokument nie otrzyma statusu Ready przed ich zamknięciem i akceptacją implementacji.

## Changelog

| Date | Change |
|---|---|
| 2026-09-19 | Wybór użytkownika zapisany; trzy wizje zastąpione jednym zakresem; rozpisano warunki gotowości #2/#3/#6/#7/#8 |

## Source evidence — ograniczona weryfikacja 2026-09-19

W tej sesji wykonano publiczne GET `https://api.raporty.pse.pl/api/{endpoint}` z `$filter=business_date eq 'YYYY-MM-DD'`. Wyniki są obserwacją, nie SLA ani dowodem pełnej historii:

| Doba | Endpoint | Wynik |
|---|---|---|
| 2026-09-19 | csdac-pln | 96 rekordów; pierwszy publication_ts_utc = 2026-09-18 11:50:10.036; csdac_pln, dtime_utc, period_utc |
| 2026-09-19 | kse-load | 96 rekordów; pola load_fcst i load_actual; pierwszy publication_ts_utc = 2026-09-19 10:05:05.217 |
| 2026-09-19 | pk5l-wp | 24 rekordy; grid_demand_fcst, fcst_wi_tot_gen, fcst_pv_tot_gen, plan_dtime_utc |
| 2026-09-20 | csdac-pln | 0 rekordów w chwili odczytu |
| 2026-09-20 | pk5l-wp | 24 rekordy; co najmniej dwa czasy publikacji UTC: 2026-09-19 09:32:41.886 i 10:02:31.573 |

Wniosek ograniczony: `pk5l-wp` jest konkretnym kandydatem wejścia prognozowanego dostępnym w próbce przed ceną na tę samą dobę; partia nie ma koniecznie jednego czasu publikacji. Nie sprawdzono kompletności/wartości wszystkich pól, historycznych wersji, jednostek MW w dokumentacji dostawcy, licencji, limitów API ani harmonogramu na wielu dobach. Weryfikacja należy do #6 A. Pomiary z `docs-marek/pomiary-api-pse.md` pozostają osobnym historycznym źródłem, bez przepisywania ich jako gwarancji.
