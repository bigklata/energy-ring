## Co i dlaczego

<!-- Jedno-dwa zdania. Link do Issue: Closes #NNN -->

Closes #

## Próg weryfikacji

Każde Issue ma dokładnie jedną etykietę `verify:*` lub `uat`. **Bez dowodu z tej
tabeli PR nie jest gotowy do merge'a, a Issue nie może zostać zamknięte.**
Zielony `typecheck` i przechodzące review NIE wystarczają.

Zaznacz próg swojego Issue i **wklej wynik poniżej**:

- [ ] `verify:unit` — `yarn test`, z widocznym **nowym** testem (nie pusty zielony przebieg)
- [ ] `verify:instance` — `yarn mercato db:migrate` na czystej bazie **oraz** `yarn test:integration:ephemeral`
- [ ] `verify:e2e` — `yarn test:integration` (Playwright)
- [ ] `uat` — komentarz w Issue od osoby, która nie pisała tego kodu

```text
<!-- wklej tu wynik komend -->
```

## Zakres plików

- [ ] Ruszone wyłącznie pliki wymienione w sekcji „Pliki, które wolno ruszyć" w Issue
- [ ] Nie dotykałem `src/modules/rdn_forecast/data/entities.ts` ani snapshotu migracji (poza #19)

## Uczciwość wyniku

- [ ] Nie ukrywam gorszego wyniku i nie zamieniam braku danych na zero
- [ ] Jeśli czegoś nie zweryfikowałem — napisałem to wprost zamiast pominąć
