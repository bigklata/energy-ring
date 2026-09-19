# Pomiary API PSE

**Data pomiarów: 2026-09-19, strefa Europe/Warsaw.**
Wszystko poniżej zostało zmierzone przez odpytanie `https://api.raporty.pse.pl`, a nie
wywnioskowane z dokumentacji. Każda sekcja podaje polecenie, którym da się pomiar powtórzyć.

Ten plik jest celowo oddzielony od ADR-ów. ADR-y są decyzjami i podlegają negocjacji przy
scalaniu analiz. **Ten plik nie** — to obserwacje. Jeśli któraś z nich jest nieprawdziwa,
należy ją obalić powtórzeniem pomiaru, nie dyskusją.

## Podsumowanie dla niecierpliwych

1. **Wykonanie z PSE jest opóźnione o ~10 godzin.** Nie ma czego obserwować „w czasie rzeczywistym".
2. **Ceny RDN na kolejną dobę pojawiają się D-1 około 13:50**, w jednej paczce, komplet 96 wartości naraz.
3. **Historia cen zaczyna się 2024-06-14.** Backfill od 2021 jest niewykonalny — tych danych nie ma.
4. **3,76% historycznych cen jest ujemnych**, a minimum to −2086,86 PLN/MWh.
5. Pełna historia jednej serii to ~79,5 tys. wierszy i **38 sekund** pobierania przy 6 równoległych workerach.

## Kształt API

Styl OData. Parametry, które działają:

| parametr | uwagi |
|---|---|
| `$first=N` | ogranicza liczbę wierszy |
| `$select=a,b,c` | wybór pól; `$select=*` **nie działa** (HTTP 400) |
| `$filter=business_date eq 'YYYY-MM-DD'` | filtr po dobie |
| `$filter=business_date ge 'A' and business_date le 'B'` | zakres dat, działa |
| `$after=<kursor>` | paginacja; zwracana w polu `nextLink` |

`$top` **nie jest obsługiwany** (HTTP 400, `Invalid Query Parameter: $top`).

**Strona ma twardo 100 wierszy.** Filtr zakresowy tego nie omija — zapytanie o siedem dób
(oczekiwane 672 wiersze) zwróciło 100 wierszy i `nextLink`. Przy 96 interwałach na dobę
oznacza to mniej więcej **jedno żądanie na jedną dobę danych**.

Nieistniejąca ścieżka zwraca HTTP 404 z `EntityNotFound`; istniejąca ścieżka z błędnym
parametrem zwraca HTTP 400. To wygodny sposób na sprawdzenie, czy endpoint w ogóle istnieje.

## Endpointy potwierdzone jako istniejące

| endpoint | zawartość | rozdzielczość |
|---|---|---|
| `csdac-pln` | `csdac_pln` — cena rynku dnia następnego w PLN/MWh | 15 min |
| `rce-pln` | `rce_pln` — rynkowa cena energii | 15 min |
| `kse-load` | `load_fcst` (prognoza PSE), `load_actual` (wykonanie) | 15 min |
| `his-wlk-cal` | `demand`, `pv`, `wi`, jednostki grafikowe, wymiana międzysystemowa | 15 min |
| `pk5l-wp` | `fcst_pv_tot_gen`, `fcst_wi_tot_gen`, `grid_demand_fcst`, `req_pow_res` | **godzinowa** |

Sprawdzone i **nieistniejące**: `pdgobm`, `crb-rozlicz`, `crb-rozlicz-i`, `crs`, `poeb-pom`, `mb-kmb`.

Nazw `his-wlk-cal` i `pk5l-wp` nie rozwijam — nie udało się potwierdzić, co skracają.
Opisane są przez zawartość, którą faktycznie zwracają.

Każdy wiersz niesie `publication_ts` oraz `publication_ts_utc` — **moment, w którym dana stała
się publicznie znana**. To pole jest fundamentem zasady point-in-time (ADR-0002).

## Pomiar 1: opóźnienie publikacji wykonania

```bash
curl -s "https://api.raporty.pse.pl/api/his-wlk-cal?\$filter=business_date%20eq%20'2026-09-19'"
curl -s "https://api.raporty.pse.pl/api/kse-load?\$filter=business_date%20eq%20'2026-09-19'"
```

Stan o **10:08 CEST**:

| seria | wierszy na dobę | z wypełnioną wartością | najświeższy interwał | `publication_ts` |
|---|---|---|---|---|
| `his-wlk-cal` (`demand`) | 96 | **1** | 00:15 | 2026-09-19 10:07:16 |
| `kse-load` (`load_actual`) | 96 | **1** | 00:15 | 2026-09-19 10:05:10 |

O 10:08 najświeższe dostępne wykonanie dotyczy interwału kończącego się o 00:15.
**Opóźnienie ≈ 9 godzin 53 minuty.** Obie serie niezależnie wskazują ten sam dystans,
co wyklucza jednorazową awarię.

`load_fcst` w tej samej odpowiedzi ma komplet 96 wartości — **prognoza jest dostępna,
wykonanie nie**. To rozróżnienie jest sednem ADR-0002.

## Pomiar 2: harmonogram publikacji cen

```bash
curl -s "https://api.raporty.pse.pl/api/csdac-pln?\$filter=business_date%20eq%20'2026-09-19'"
curl -s "https://api.raporty.pse.pl/api/csdac-pln?\$filter=business_date%20eq%20'2026-09-20'"
```

Stan o **10:19 CEST**:

| doba dostawy | wierszy | z ceną | `publication_ts` |
|---|---|---|---|
| 2026-09-19 (dziś) | 96 | 96 | **2026-09-18 13:50:10** |
| 2026-09-20 (jutro) | **0** | — | brak, jeszcze nieopublikowane |

`rce-pln` zachowuje się identycznie: komplet na dziś opublikowany 2026-09-18 o 13:50:10,
jutro pusto. Obie serie mają ten sam znacznik czasu co do sekundy, czyli **są publikowane
jedną paczką**.

**Wniosek operacyjny: dobowy termin zapada około 13:50 D-1.** Przed nim cena jutrzejsza nie
istnieje. Po nim znana jest w komplecie i nie ma czego prognozować. To jedyny moment w dobie,
w którym system ma coś do powiedzenia.

## Pomiar 3: zakres historii i rewizje

```bash
curl -s "https://api.raporty.pse.pl/api/csdac-pln?\$first=1&\$select=business_date,dtime"
```

Najstarszy rekord `csdac-pln`: **2024-06-14 00:15**. Domyślne sortowanie API idzie rosnąco
po `dtime_utc` (widoczne w kursorze `nextLink`), więc to jest faktyczny początek serii.

**Konsekwencja: backfill od 1 stycznia 2021 jest dla tej serii niewykonalny.**
Dostępne jest ~28 miesięcy historii, nie pięć lat.

**Rewizje występują.** W próbce historycznej `business_date 2024-06-13` niesie
`publication_ts 2024-06-15 19:36` — publikacja dwa dni po dobie dostawy. Dodatkowo część
wierszy `kse-load` ma `load_fcst: null`. Jedno i drugie musi łapać bramka jakości.

## Pomiar 4: pełna historia cen — zakres wartości

Skan całej dostępnej historii `csdac-pln` (28 miesięcy, paginacja kursorowa,
6 równoległych workerów, jeden worker na miesiąc):

```
pobrane wiersze: 79488   z ceną: 79488   czas: 38,2 s
MIN: -2086,86 PLN/MWh   (2026-05-01, 13:00)
MAX:  3048,35 PLN/MWh   (2026-09-14, 20:00)
ujemnych interwałów: 2992  =  3,76% historii
```

Pięć najniższych wartości w całej historii:

```
-2086,86  -2086,86  -2086,82  -2086,48  -2086,44   (wszystkie 2026-05-01)
```

**Ceny ujemne to nie przypadek brzegowy — to co 27. interwał.** Minimum wypada 1 maja
w południe: dzień wolny, niskie zapotrzebowanie, pełne słońce.

### Hipoteza o technicznym limicie ceny — NIEPOTWIERDZONA

Zbicie pięciu najniższych wartości w przedziale szerokości 0,42 grosza nie wygląda na
przypadek, tylko na **odbicie od twardego limitu**. Dzielenie −2086,86 przez −500 daje
4,1737, co jest wiarygodnym kursem EUR/PLN. Stąd hipoteza, że techniczne dno rynku SDAC
wynosi −500 EUR/MWh i widzimy je przeliczone na złotówki po kursie z tamtego dnia.

**Nie zostało to potwierdzone w żadnym źródle regulacyjnym.** Przed zakodowaniem progu
należy sprawdzić aktualny techniczny limit SDAC.

Jeśli hipoteza jest prawdziwa, ma konkretną konsekwencję inżynierską: **granica nie jest
stałą w PLN, tylko przesuwa się z kursem euro**. Zaszyty na sztywno próg złotowy z czasem
zacznie odrzucać poprawne dane. Szczegóły w ADR-0006.

## Pomiar 5: przepustowość backfillu

Pełna historia jednej serii — 79 488 wierszy, ~795 żądań — pobrana w **38,2 sekundy**
przy 6 równoległych workerach dzielących zakres po miesiącach. Pojedyncze żądanie ≈ 0,2 s.

Trzy serie to rząd **240 tys. wierszy i ok. 2 minut** pobierania.

**Wąskim gardłem nie jest pobieranie, tylko zapis** — 240 tys. rekordów przechodzących
przez zwykłą ścieżkę CRUD z reindeksem na każdym zapisie. Rozwiązanie w ADR-0003.
