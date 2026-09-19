# Słownik

Format zgodny z `CONTEXT-FORMAT.md` skilla domain-modeling: definicja mówi, **czym coś jest**,
nie co robi. `_Unikaj_` wskazuje określenia, które w tym projekcie mylą.

Świadomie nie nadpisuję głównego `CONTEXT.md` — zgodnie z ustaleniem ta analiza jest trzecią,
osobną pozycją. Tam, gdzie moje rozumienie różni się od tamtego, jest to zaznaczone.

## Rynek i instytucje

**KSE**:
Krajowy System Elektroenergetyczny — całość polskiej sieci: wytwórcy, przesył, odbiorcy.
_Unikaj_: „sieć", „grid" bez doprecyzowania

**PSE**:
Polskie Sieci Elektroenergetyczne, operator sieci przesyłowej. W tym projekcie występuje
wyłącznie jako **wydawca publicznych danych**, nie jako kontrahent.
_Unikaj_: „dostawca energii", „sprzedawca"

**RDN**:
Rynek Dnia Następnego. Jedna aukcja dziennie: dziś kupujesz na jutro. Jedyny rynek w zakresie.
_Unikaj_: „giełda" bez doprecyzowania, „spot"

**RDB**:
Rynek Dnia Bieżącego, handel w trakcie doby dostawy. **Poza zakresem.**
_Unikaj_: mylenia z RDN

**SDAC**:
Europejski mechanizm łączący rynki dnia następnego wielu krajów i wyznaczający dla nich
wspólną cenę.
_Unikaj_: traktowania jako osobnego rynku

**MTU**:
Najkrótszy okres z własną ceną. Obecnie 15 minut, więc doba ma 96 cen.
_Unikaj_: „godzina", „slot", „tick"

## Dane

**Cena RDN**:
`csdac_pln` — cena rozliczenia rynku dnia następnego w PLN/MWh dla jednego MTU.
**Przedmiot prognozy.**
_Unikaj_: „cena energii" bez wskazania rynku, mylenia z RCE

**RCE**:
Rynkowa cena energii, `rce_pln`, używana w rozliczeniach. **Nie jest przedmiotem prognozy**,
pobierana pomocniczo.
_Unikaj_: używania zamiennie z ceną RDN

**Zapotrzebowanie**:
Moc pobierana przez KSE. Występuje w dwóch wariantach, których **nie wolno mylić**:
`load_fcst` — prognoza PSE, znana z wyprzedzeniem; `load_actual` — wykonanie,
dostępne ~10 godzin po fakcie.
_Unikaj_: „load" bez wskazania wariantu

**Wykonanie**:
Zmierzony, faktyczny stan systemu: `demand`, `pv`, `wi`. Dostępne z ~10-godzinnym opóźnieniem.
Służy **wyłącznie** do uczenia i oceny, nigdy jako wejście prognozy na tę samą dobę.
_Unikaj_: „dane bieżące", „real-time", „aktualny stan"

**Moment decyzji**:
Chwila przed publikacją cen RDN, około **13:50 D-1**. Wszystko, co system wie, musi
istnieć przed tym momentem.
_Unikaj_: „teraz", „czas rzeczywisty"

**Dana znana w momencie decyzji**:
Rekord, którego `publication_ts` jest wcześniejszy niż moment decyzji. Jedyny rodzaj danych
dopuszczony na wejście prognozy.
_Unikaj_: „dostępna dana" — bo dziś dostępne jest też to, czego wtedy nie było

**Przeciek z przyszłości**:
Użycie w prognozie danej, która w momencie decyzji jeszcze nie istniała. Nie powoduje błędu
— powoduje wynik, który wygląda dobrze i jest fałszywy.
_Unikaj_: „błąd danych" — to nie jest błąd, to cichy defekt metody

## Import i jakość

**Partia importu**:
Jedno pobranie jednej serii za jedną dobę. **Jednostka, którą ocenia bramka jakości**
i jedyna encja importu zarejestrowana w indeksie zapytań.
_Unikaj_: „import", „job", „run" bez doprecyzowania zakresu

**Punkt pomiarowy**:
Pojedyncza wartość dla jednego MTU jednej serii. Rekord bez reguł, poza indeksem zapytań.
_Unikaj_: „pomiar" — w energetyce sugeruje licznik fizyczny, a tu chodzi o dane rynkowe

**Bramka jakości**:
Zestaw reguł modułu business rules oceniających partię importu przed dopuszczeniem
jej do prognozy.
_Unikaj_: „walidacja" — walidacja jest jednym z pięciu typów reguł, nie całością

**Kwarantanna**:
Stan partii, która przeszła kontrolę kompletności, ale wzbudziła podejrzenie. Widoczna
w adminie z przyczyną; prognoza jej nie konsumuje.
_Unikaj_: „odrzucona", „błędna" — partia w kwarantannie bywa poprawna

**Rewizja**:
Ponowna publikacja tej samej doby pod późniejszym `publication_ts`. Zdarza się nawet
dwa dni po dobie dostawy.
_Unikaj_: „aktualizacja", „poprawka"

## Prognoza

**Baseline**:
Prognoza odniesienia, wobec której mierzy się sens całej reszty. Dwa: cena z tego samego
MTU dobę wcześniej i tydzień wcześniej.
_Unikaj_: „model bazowy" jako jeden byt — są dwa i raportujemy oba

**Korekta**:
Przesunięcie baseline'u o różnice znane w momencie decyzji: prognoza zapotrzebowania,
wiatru i PV na jutro względem dziś. **Całość metody prognostycznej.**
_Unikaj_: „model", „ML", „predykcja" — sugerują trening, którego nie ma

**Replay**:
Odtworzenie doby historycznej w przyspieszeniu na potrzeby demonstracji, **jawnie oznaczone
w interfejsie**. Nie jest trybem produkcyjnym.
_Unikaj_: prezentowania jako czasu rzeczywistego

## Rozbieżności wobec pozostałych analiz

| pojęcie | tutaj | gdzie indziej |
|---|---|---|
| rozdzielczość prognozy | 15 min | `docs-grzegorz` ADR-0008: godzinowa, jawnie wyklucza 15-minutowe MTU |
| zakres historii | od 2024-06-14 (fizyczna granica danych) | `docs-grzegorz` ADR-0017: od 2021 |
| metoda | korekta baseline'u, bez treningu | `docs-grzegorz` ADR-0010/0011/0012: gradient boosting, serwis Python, codzienny trening |
| czas rzeczywisty | nie istnieje, wykonanie ma ~10 h opóźnienia | obie analizy zakładają dane bieżące |
| wielodostęp | nierozstrzygnięty, poza zakresem 10 h | `docs-grzegorz` ADR-0014: multi-tenant; `CONTEXT.md`: wyłącznie zespół założycielski |
| handel | poza zakresem | `CONTEXT.md` + ADR-0003/0006: demo auto-trading z lewarem i P&L |
