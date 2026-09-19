# Model domeny

Zakres: showcase na hackathonie Open Mercato, budżet ~10 godzin zegarowych, zespół trzyosobowy.
Model jest celowo mały — wszystko, co nie mieści się w tym budżecie, jest wymienione
w sekcji „Poza zakresem", a nie modelowane na zapas.

## Zasada nadrzędna

> **Prognoza korzysta wyłącznie z danych, które istniały w momencie decyzji.**

Momentem decyzji jest ~13:50 D-1 (patrz `pomiary-api-pse.md`, pomiar 2). Każdy byt poniżej
niesie `publication_ts` pochodzący z PSE, a nie czas zapisu do bazy — bo to pierwsze mówi,
kiedy dana stała się **znana**, a drugie tylko kiedy trafiła do nas.

Złamanie tej zasady nie wywoła błędu. Wywoła prognozę, która w ocenie wstecznej wygląda
świetnie i nie działa na żywo. To najdroższy możliwy defekt w tym projekcie.

## Byty

### SeriaZrodlowa

Konfiguracja jednej serii PSE: identyfikator endpointu, nazwa pola z wartością, oczekiwana
liczba interwałów na dobę, rola w systemie (przedmiot prognozy albo wejście).

Trzy instancje w zakresie: `csdac-pln` (przedmiot prognozy), `kse-load` oraz `his-wlk-cal`
(wejście i materiał dla bramki).

### PartiaImportu

**Jednostka, którą ocenia bramka jakości.** Jedno pobranie jednej serii za jedną dobę.

Niesie: serię, dobę dostawy, `publication_ts` z PSE, liczbę otrzymanych interwałów, liczbę
oczekiwanych, wartości skrajne, status jakości oraz — przy rewizji — wskazanie partii,
którą zastępuje.

Jedyny byt importu **zarejestrowany w indeksie zapytań**. Uzasadnienie w ADR-0003.

Status jakości: `przyjeta`, `kwarantanna`, `zablokowana`.

### PunktPomiarowy

Pojedyncza wartość dla jednego MTU. Niesie: partię, znacznik czasu interwału (lokalny i UTC),
wartość.

Rekord bez reguł biznesowych, **poza indeksem zapytań**. Przy ~240 tys. rekordów to jedyna
decyzja, która w ogóle dotyczy wydajności.

### Prognoza

Jedno uruchomienie na dobę dostawy. Niesie: dobę, moment wykonania, wskazanie partii, z
których powstała, oraz — jawnie — **moment odcięcia danych**, czyli granicę point-in-time.

96 wartości `PunktPrognozy`, po jednej na MTU.

### PunktPrognozy

Prognozowana cena dla jednego MTU wraz z rozbiciem, które ją tłumaczy: wartość obu
baseline'ów, wielkość korekty i jej składniki (różnica zapotrzebowania, wiatru, PV).

Rozbicie nie jest ozdobą — jest jedynym sposobem, by po fakcie stwierdzić, **dlaczego**
prognoza była zła.

### OcenaPrognozy

Porównanie prognozy z opublikowaną ceną, wyliczane po 13:50 D-1. Niesie błąd prognozy oraz
błąd obu baseline'ów.

**Prognoza jest udana wtedy i tylko wtedy, gdy bije oba baseline'y.** Bezwzględna wartość
błędu bez tego porównania nic nie znaczy.

## Niezmienniki

- Prognoza nie może powstać z partii o statusie `kwarantanna` ani `zablokowana`.
- Żaden `PunktPomiarowy` użyty jako wejście prognozy nie może pochodzić z partii,
  której `publication_ts` jest późniejszy niż moment odcięcia danych tej prognozy.
- `PartiaImportu` o liczbie interwałów innej niż oczekiwana jest `zablokowana`, nigdy `przyjeta`.
- Rewizja nie nadpisuje poprzedniej partii — powstaje nowa, wskazująca zastępowaną.
- `OcenaPrognozy` powstaje wyłącznie po publikacji ceny rzeczywistej dla całej doby.
- Punkty pomiarowe są dopisywane, nigdy modyfikowane.

## Przepływ

```
scheduler (co 15 min)
    │
    ▼
odpytanie serii PSE ──► czy zmienił się publication_ts?
    │                          │
    │ nie ─► koniec            │ tak
    │                          ▼
    │                   zapis PartiaImportu + PunktPomiarowy
    │                          │
    │                          ▼
    │                   BRAMKA JAKOŚCI  (moduł business rules)
    │                   GUARD      ─► kompletność 96/96, zakres techniczny
    │                   VALIDATION ─► rewizja, opóźnienie, skok
    │                          │
    │                   SET_FIELD  ─► status jakości
    │                   EMIT_EVENT ─► mostek SSE ─► UI na żywo
    │                          │
    │                          ▼
    │                   partia przyjęta?
    │                          │ tak
    │                          ▼
    └──────────────────► Prognoza (baseline + korekta)
                               │
                        po 13:50 D-1
                               ▼
                         OcenaPrognozy
```

## Podział na moduły

Trzy moduły, po jednym na osobę. Granice modułów Open Mercato są jedyną obroną przed
kolizjami trzech agentów pracujących równolegle.

| moduł | odpowiedzialność |
|---|---|
| `ingest` | adaptery serii PSE, scheduler, paginacja kursorowa, wykrywanie rewizji |
| `quality` | reguły bramki, stany partii, ekran kwarantanny, zdarzenia SSE |
| `forecast` | baseline'y, korekta, ocena, widok prognozy i replay |

**Encje są wspólne i zamrażane przez cały zespół w pierwszych 30 minutach.** Worktree cezara
chroni katalog roboczy, ale nie historię — dwie osoby ruszające ten sam plik encji dostaną
konflikt przy scalaniu. Jedna osoba jest właścicielem merge'a i nie pisze kodu w ostatniej godzinie.

## Poza zakresem

Wymienione wprost, żeby nikt nie zbudował tego przypadkiem:

- składanie zleceń, portfel, P&L, lewar, limity ryzyka — cały wątek handlowy z `CONTEXT.md`
- wielodostęp i izolacja tenantów — jest w platformie, ale nie jest przedmiotem pokazu
- trening modelu, walidacja krzyżowa, SHAP — patrz ADR-0007
- ENTSO-E, dane pogodowe, IMGW — trzy serie PSE wystarczają
- RDB i rynek terminowy
- backfill sprzed 2024-06-14 — dane nie istnieją, patrz `pomiary-api-pse.md`
