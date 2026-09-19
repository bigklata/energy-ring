# UAT #43 — pełna ścieżka operatora na danych PSE

**Status: UAT nie został wykonany. Blokuje go otwarte [#39](https://github.com/bigklata/energy-ring/issues/39).** Ten runbook jest instrukcją dla osoby, która nie pisała testowanego kodu. Do czasu zakończenia #39 nie ma potwierdzonej ścieżki panel → rzeczywiste API → import → jakość → prognoza → ocena bez mocków. Dokument ani automaty nie stanowią dowodu UAT i nie zamykają [#43](https://github.com/bigklata/energy-ring/issues/43).

## Warunki czasowe — zapisz oba

- #43 wymaga uruchomienia prognozy dla doby D **przed 13:50 Europe/Warsaw w D−1**. To kryterium tej próby, **nie SLA PSE**. Około 13:50 to pojedyncza obserwacja publikacji ceny, bez gwarancji powtarzalności.
- [Metoda](rdn-forecast-method.md) §5 ustala osobny, stały `cutoffUtc(D)`: **15:30 Europe/Warsaw w D−1**, przeliczone na UTC dla konkretnej daty i zmiany czasu. Dla każdej użytej wersji wejścia muszą jednocześnie zachodzić `publicationTsUtc <= cutoffUtc(D)` oraz `fetchedAtUtc <= cutoffUtc(D)`. W próbie na żywo potwierdź dodatkowo, że wejścia zostały pobrane przed uruchomieniem prognozy i cena docelowa D nie posłużyła jako wejście.
- Uruchomienie między 13:50 a 15:30 może odpowiadać polityce cutoff metody, lecz **nie zalicza kroku #43 „przed 13:50”**. Jeśli przed 13:50 brakuje zaakceptowanych wejść lub cena D jest już znana, zapisz stan i czasy jako blokadę. Nie przesuwaj okna, nie zastępuj wejść fixture ani nie nazywaj późnego replayu prognozą live. Rozbieżność warunku Issue z polityką metody przedstaw jawnie właścicielowi #43.

## Przygotowanie po ukończeniu #39

1. Sprawdź dowód E2E z #39 i uruchom host według [README](../README.md). Zaloguj się jako uprawniony operator, otwórz panel RDN i potwierdź, że korzysta z rzeczywistych route'ów i PSE. Gdy brakuje panelu, uprawnień lub połączenia, zatrzymaj próbę i zapisz powód. Nie używaj danych z `docs/fixtures/rdn/`, mocków ani demonstracyjnego replayu.
2. **Przed zobaczeniem wyniku** zapisz dobę dostawy D = jutro w Europe/Warsaw, daty D−1 i D−7, operatora, środowisko i zegar ze strefą. Oczekiwaną liczbę MTU wyznacz z kalendarza: 92, 96 albo 100. Zapisz wersję metody i skalibrowaną `paramsVersion`; `params.v0.1-illustrative` to tylko przykład rachunkowy, nie parametry do oceny na PSE. Nie wybieraj innej doby po zobaczeniu MAE.
3. Przygotuj bezpieczne zrzuty panelu lub eksport odczytów oraz tabelę ID wersji. Notuj UTC i czas lokalny z offsetem; przy jesiennej zmianie czasu sama etykieta 02:00 nie identyfikuje MTU. Nie udostępniaj sekretów ani danych innego tenant/organization.

## D−1: import i prognoza na jutro

1. W panelu wybierz dzisiejszą dobę D−1 i uruchom import z **realnego API PSE**. Zapisz serię, ID i wersję partii, czas operacji, status i jakość: MTU oczekiwane, odebrane, zaakceptowane, brakujące, zduplikowane oraz null. Pokaż partię w panelu. Przy statusie partial/rejected lub błędzie dostawcy zapisz kod i przyczynę; nie konsumuj tej partii. Retry wykonuj akcją aplikacji i sprawdź brak duplikatów.
2. Dla prognozy D sprawdź zaakceptowane snapshoty `csdac-pln.csdac_pln` z D−1 i D−7 oraz godzinowe `pk5l-wp` (`fcst_wi_tot_gen`, `fcst_pv_tot_gen`, `grid_demand_fcst`) z D i D−1. Jeśli aplikacja wymaga importu tych dat, użyj jej normalnej akcji. Dla każdej serii zapisz źródło, datę, ID i wersję partii, liczbę punktów, jednostkę, jakość i ID snapshotu. Trzy wejścia `pk5l-wp` są w MW; sprawdź jednostkę zapisanych serii i zgodność `methodVersion` z kontraktem rzeczywiście wdrożonym przed próbą. Ten dokument nie dowodzi wdrożenia metody v1; jeśli brak skalibrowanych parametrów, zapisz blokadę rzeczywistej prognozy.
3. **Przed 13:50 lokalnie** uruchom prognozę D z zaakceptowanych snapshotów. Zachowaj czas żądania i utrwalenia wyniku, ID runu, tryb `live`, status, `cutoffUtc`, `methodVersion`, `paramsVersion` oraz ID wszystkich wejść. Gdy run jest `blocked`, zachowaj kod i wyjaśnienie; nie zastępuj braków zerem.
4. Dla **każdego użytego punktu/wersji**, a nie tylko nagłówka partii, zachowaj wartość, jednostkę, granice MTU w UTC, ID źródła i wersji, `publicationTsUtc` podany przez PSE i `fetchedAtUtc` z aplikacji. Zestaw oba czasy z `cutoffUtc(D)` i czasem uruchomienia. Podaj liczbę punktów spełniających oba warunki, liczbę późnych/brakujących i ich ID. Jeśli UI nie daje śladu per punkt, wpisz lukę dowodową; timestamp partii nie zastępuje timestampów rekordów. Dzisiejszy odczyt archiwum z dawnym czasem publikacji nie dowodzi historycznego pobrania.
5. W tabeli wyniku sprawdź granice UTC i lokalną etykietę/offset każdego MTU, liczbę 92/96/100, baseline D−1, baseline D−7, korektę i prognozę PLN/MWh. Zachowaj przykład przejścia od liczby do wejść, wersji metody i parametrów.

## D: ocena następnego dnia

1. Wróć **następnego dnia po uruchomieniu prognozy**, gdy ceny dla D są dostępne. Nie zakładaj, że PSE publikuje je dopiero w D: zapisz faktyczne `publicationTsUtc` per wiersz. Zaimportuj `csdac-pln.csdac_pln` dla D przez panel, sprawdź kompletność, jakość, ID/wersję zaakceptowanej partii i czasy pobrania. Brak, null lub odrzucona partia oznacza oczekiwanie/blokadę, nie cenę zero.
2. **Przed obejrzeniem MAE** potwierdź utrwalone `windowStart`/`windowEnd` oraz powiązanie z pierwotnym runem i wersją celu. Uruchom ocenę. Zapisz ID, status, `evaluationKind`, `coverageStatus`, MTU oczekiwane, uwzględnione, wyłączone i liczniki przyczyn. Nie zmieniaj okna po wyniku.
3. Odczytaj MAE prognozy i obu baseline'ów w PLN/MWh. Wszystkie trzy wymagają **identycznego zbioru MTU i mianownika N**; brak którejkolwiek serii lub zaakceptowanej ceny wyłącza MTU z całego porównania. Pokrycie poniżej 80% powinno dać `insufficient_coverage`, bez pozornie porównywalnego MAE. Zachowaj gorszy wynik prognozy; nie jest sam w sobie błędem UAT.
4. Dla zwykłego MTU oraz każdego napotkanego przypadku szczególnego (brak, rewizja, cena ujemna, DST) odtwórz cenę D−1 i D−7, sześć wartości prognoz godzinowych D i D−1, mapowanie godziny na MTU, korektę, wagi i współczynniki, prognozę oraz cenę rzeczywistą z konkretnych wersji. Przy braku jednego baseline'u sprawdź renormalizację. Przy powtórzonej jesiennej etykiecie sprawdź **dwa osobne źródłowe przedziały UTC i ich wartości MW**; pierwszego chronologicznie punktu użyj jedynie przy dopasowaniu powtórzonego dnia bazowego do pojedynczej etykiety D. Brak możliwości prześledzenia liczby zgłoś jako problem.

## Pytania operatora o pochodzenie każdej liczby

| Liczba | Co operator musi umieć wskazać |
| --- | --- |
| Kompletność, MTU, odrzucenia | Kalendarz i zakres UTC uzasadniające 92/96/100; ID/wersja partii oraz punkty i kody jakości składające się na każdy licznik. |
| Odcięcie, publikacja, pobranie | Lokalna chwila 15:30 D−1 i przeliczenie na UTC; konkretny rekord z oboma niezależnymi timestampami, porównanymi z cutoff i czasem runu. |
| Baseline D−1 i D−7 | Źródłowy punkt `csdac-pln`, data, MTU UTC, wersja, cena, publikacja; reguła dla brakującej lub powtórzonej godziny. |
| Korekta i prognoza | Sześć punktów `pk5l-wp`, godzina, mapowanie na MTU, `methodVersion`, `paramsVersion`, wagi, współczynniki, jednostki i zaokrąglenie; ręczne przeliczenie przykładu. |
| Cena D i błąd punktu | Zaakceptowany rekord i rewizja celu, status null/ujemnej ceny, różnica bezwzględna. |
| Trzy MAE | Ustalone okno, wspólny zbiór MTU/N, sumy błędów, pokrycie, wyłączenia i wersja oceny po ewentualnej rewizji celu. |

## Wynik w Issue #43

Po **faktycznej** próbie niezależny operator dodaje komentarz do #43. Każdą rozbieżność zgłasza jako osobny Issue i linkuje ją; nie naprawia jej po cichu podczas UAT. Przy zatrzymaniu scenariusza wskazuje wykonane kroki i brakujące dowody, bez deklarowania zaliczenia. Komentarz ma zawierać:

- operatora (potwierdzenie, że nie pisał kodu), środowisko, datę/strefę, D i liczbę oczekiwanych MTU;
- **co działało, co myli, co jest zepsute lub zablokowane**;
- źródło/ID/wersję i wynik jakości importu D−1; czas uruchomienia przed 13:50, ID runu, tryb, `cutoffUtc`, `methodVersion`, `paramsVersion`;
- ID/wersje wejść oraz dowód `publicationTsUtc` i `fetchedAtUtc` **per punkt** względem cutoff i uruchomienia;
- po powrocie następnego dnia: ID/wersję cen D i oceny, okno, status, N, pokrycie, wyłączenia i trzy MAE;
- jeden ręcznie prześledzony MTU z wejściami, parametrami i wersją celu; odnośniki do bezpiecznych dowodów i osobnych Issues z rozbieżnościami;
- werdykt: pełna ścieżka przeszła albo nie przeszła, z konkretną przyczyną.

Nie wpisuj „zaliczony” po użyciu fixtures, po uruchomieniu po 13:50, bez dowodów czasu per rekord lub bez oceny następnego dnia. Historyczny replay wymaga utrwalonego, datowanego importu wymaganych wersji sprzed historycznego cutoff; sam dzisiejszy odczyt archiwum nie wystarcza. Negatywny wynik i blokady są ważnym rezultatem próby, lecz nie spełniają warunku zamknięcia #43 bez pełnego UAT.

## Źródła i blokady

- [#43](https://github.com/bigklata/energy-ring/issues/43) podaje scenariusz i próg akceptacji przez niezależną osobę. [#39](https://github.com/bigklata/energy-ring/issues/39) pozostaje otwartą zależnością realnego API i E2E.
- [Spec MVP](../.ai/specs/2026-09-19-rdn-forecast-mvp.md) i [szkic kontraktu](../.ai/specs/2026-09-19-rdn-forecast-mvp-technical-contracts.md) opisują ścieżkę, snapshoty i wersje; proponowane route'y nie dowodzą, że działają.
- [Metoda](rdn-forecast-method.md) §§3–7 jest źródłem wzoru, DST, cutoff 15:30 i wspólnego MTU dla MAE. [Katalog PSE](pse-source-catalog.md) i [pomiar](../docs-marek/pomiary-api-pse.md) dokumentują źródła i pojedynczą obserwację około 13:50, bez SLA.
- Przed realnym UAT trzeba potwierdzić ukończenie #39 i skalibrowaną wersję parametrów. Jednostki MW pól `pk5l-wp` są udokumentowane; brak poprawnego zapisu jednostki w danych aplikacji nadal blokuje próbę.
