## Co i dlaczego

<!-- Jedno-dwa zdania. -->

Closes #

## Dowód weryfikacji

Każde Issue ma dokładnie jedną etykietę `verify:*` lub `uat`. **Bez dowodu z tej
tabeli PR nie jest gotowy do merge'a, a Issue nie może zostać zamknięte.**
Zielony `ci` pokrywa wyłącznie próg `verify:unit` — dla pozostałych progów CI
nie jest i nie będzie dowodem.

| próg | gdzie uruchamiasz | jaki dowód |
| --- | --- | --- |
| `verify:unit` | GitHub CI, automatycznie | zielony check `ci` **plus** nazwa nowego testu w opisie |
| `verify:instance` | **swój sandbox** | **output tekstowy** — pełne linie podsumowania z licznikami |
| `verify:e2e` | **swój sandbox** | **zrzut ekranu lub nagranie** |
| `uat` | człowiek, który nie pisał kodu | zrzut ekranu + komentarz w Issue |

### Dlaczego tekst, a nie obrazek, dla `verify:instance`

Tam weryfikujemy **liczby**: ile migracji zastosowano, ile testów przeszło, ile
rekordów powstało. Linia podsumowania z licznikami niesie tę informację; zdjęcie
konsoli nie wnosi ponad nią nic, a utrudnia przeszukiwanie.

### Zakotwiczenie w wersji — obowiązkowe

Zrzut ekranu bez wskazania wersji nie mówi, co przedstawia — może pochodzić
sprzed trzech poprawek. Podaj SHA commita, na którym robiłeś dowód:

**SHA dowodu:** `________`

- [ ] `verify:unit` — check `ci` zielony, nowy test nazwany poniżej
- [ ] `verify:instance` — `yarn mercato db:migrate` na czystej bazie **oraz** `yarn test:integration:ephemeral`, output wklejony
- [ ] `verify:e2e` — `yarn test:integration` (Playwright), zrzut lub nagranie załączone
- [ ] `uat` — komentarz w Issue od osoby, która nie pisała tego kodu

```text
<!-- wklej tu output komend (verify:instance) -->
```

<!-- załącz tu zrzuty (verify:e2e, uat) -->

## Zakres plików

- [ ] Ruszone wyłącznie pliki wymienione w sekcji „Pliki, które wolno ruszyć" w Issue
- [ ] Nie dotykałem `src/modules/rdn_forecast/data/entities.ts` ani snapshotu migracji (poza #19)

## Uczciwość

- [ ] Nie ukrywam gorszego wyniku i nie zamieniam braku danych na zero
- [ ] Jeśli czegoś nie zweryfikowałem — napisałem to wprost zamiast pominąć
- [ ] Dowód pochodzi z commita podanego wyżej, nie z wcześniejszej wersji
