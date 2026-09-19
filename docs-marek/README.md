# Analiza — Marek

> **Zakres MVP zaktualizowany 2026-09-19.** Użytkownik wybrał prognozę RDN: import PSE, kontrola jakości, korekta baseline’u i porównanie z opublikowanymi cenami. Bez tradingu, portfela i treningu ML. Decyzja: [issue #2](https://github.com/bigklata/energy-ring/issues/2); robocza specyfikacja: [.ai/specs/2026-09-19-rdn-forecast-mvp.md](../.ai/specs/2026-09-19-rdn-forecast-mvp.md). Zakres produktowy jest zatwierdzony, projekt techniczny pozostaje Draft.

> Kierunek produktowy tej analizy przyjęto. Jej szczegółowe ADR-y i model domeny pozostają propozycjami do weryfikacji w #3/#6/#7: nie zatwierdzono automatycznie podziału modułów, SSE, stałego odcięcia, 96 interwałów dla każdej doby ani pomijania testów.

Trzecia, niezależna pozycja obok `docs-grzegorz/` i `CONTEXT.md` + `docs/adr/`.
Świadomie nie dotyka cudzych plików — scalenie trzech analiz jest osobnym zadaniem.

## Kontekst

Showcase na hackathonie Open Mercato. Budżet **~10 godzin zegarowych, zespół trzyosobowy**,
praca przez [cezara](https://github.com/open-mercato/cezar) (worktree per zadanie).
Cel dodatkowy: rozpoznać, co platforma potrafi i gdzie stawia opór.

Powstała w sesji grillowej 2026-09-19 metodą `grill-with-docs`, tak jak `CONTEXT.md`.

## Co tu jest

| plik | rodzaj | status przy scalaniu |
|---|---|---|
| [pomiary-api-pse.md](pomiary-api-pse.md) | **obserwacje** | nie podlega negocjacji — do obalenia wyłącznie powtórzeniem pomiaru |
| [domain-model.md](domain-model.md) | model | do uzgodnienia |
| [glossary.md](glossary.md) | słownik | do uzgodnienia |
| [adr/](adr/) | siedem decyzji | do uzgodnienia |

Rozdział na obserwacje i decyzje jest celowy. Obie pozostałe analizy powstały 2026-09-18
**bez odpytania API PSE** i obie zakładają dostępność danych bieżących. Pomiary tego
nie potwierdzają.

## Skrót

Prognozujemy **96 cen rynku dnia następnego** na kolejną dobę, przed momentem decyzji
(~13:50 D-1). O 13:50 PSE publikuje prawdę i różnica jest widoczna tego samego dnia.
Dane wchodzą przez bramkę jakości opartą na module business rules; werdykt bramki jedzie
mostkiem SSE na żywo do interfejsu. Metodą jest korekta baseline'u o różnice znane
w momencie decyzji — bez treningu modelu.

## Trzy zapisy z pozostałych analiz obalone pomiarem

Do rozstrzygnięcia w sesji scalającej, nie tutaj:

1. **`docs-grzegorz` ADR-0017 — backfill od 2021.** Historia `csdac-pln` zaczyna się
   **2024-06-14**. Tych danych nie ma.
2. **`docs-grzegorz` ADR-0008 — rozdzielczość godzinowa.** Sprzeczna z 15-minutową,
   przyjętą tutaj i potwierdzoną przez zleceniodawcę.
3. **Założenie czasu rzeczywistego, obecne w obu analizach.** Wykonanie z PSE ma
   **~10 godzin opóźnienia**; o 10:08 dostępny był jeden wypełniony interwał na 96.

## Decyzje

| ADR | rzecz |
|---|---|
| [0001](adr/0001-cena-rdn-na-jutro-jako-przedmiot-prognozy.md) | przedmiotem prognozy jest cena RDN na jutro |
| [0002](adr/0002-tylko-dane-znane-w-momencie-decyzji.md) | tylko dane znane w momencie decyzji |
| [0003](adr/0003-surowe-punkty-poza-indeksem-zapytan.md) | punkty pomiarowe poza indeksem zapytań |
| [0004](adr/0004-bramka-jakosci-w-module-business-rules.md) | bramka jakości na module business rules |
| [0005](adr/0005-partia-importu-jednostka-oceny.md) | partia importu jako jednostka oceny |
| [0006](adr/0006-guard-kompletnosc-i-zakres-techniczny.md) | GUARD: kompletność i zakres techniczny |
| [0007](adr/0007-korekta-baseline-zamiast-modelu-uczonego.md) | korekta baseline'u zamiast modelu uczonego |

Numeracja ADR-ów jest lokalna dla tego katalogu i **koliduje** z `docs/adr/` oraz
`docs-grzegorz/adr/`. Przenumerowanie należy do sesji scalającej.

## Czego tu nie ma

Handel, portfel, P&L, lewar, limity ryzyka, wielodostęp, trening modelu, dane pogodowe,
ENTSO-E, RDB. Uzasadnienia w [domain-model.md](domain-model.md#poza-zakresem).
