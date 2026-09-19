# ADR-0011: Osobny serwis ML

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Open Mercato używa TypeScript i odpowiada za warstwę biznesową, natomiast LightGBM, XGBoost i SHAP mają dojrzały ekosystem w Pythonie. Umieszczenie logiki ML bezpośrednio w module utrudniłoby niezależne testowanie i wersjonowanie modelu.

## Decyzja

MVP będzie składać się z:

- modułu Open Mercato odpowiedzialnego za źródła danych, PostgreSQL, scenariusze, uprawnienia, dashboard i kolejkę zadań,
- osobnego serwisu Python odpowiedzialnego za trening, backtesting, inferencję i wyjaśnienia SHAP.

Komunikacja będzie odbywać się przez wersjonowane API. Serwis ML nie będzie posiadać bezpośrednich danych logowania do PostgreSQL.

## Konsekwencje

- Open Mercato pozostaje właścicielem danych i trwałych wyników.
- Żądania do serwisu ML muszą być uwierzytelnione, walidowane i posiadać identyfikator idempotencji.
- Długie operacje będą uruchamiane jako zadania w tle, a nie w cyklu żądania użytkownika.
- Kontrakt API musi zawierać wersję zestawu cech i modelu.
- Awaria serwisu ML nie może blokować importowania ani przeglądania danych historycznych.

