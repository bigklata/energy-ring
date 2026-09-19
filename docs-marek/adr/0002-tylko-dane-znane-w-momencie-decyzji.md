# Prognoza korzysta wyłącznie z danych znanych w momencie decyzji

Wykonanie z PSE (`load_actual`, `demand`, `pv`, `wi`) przychodzi około dziesięciu godzin po
fakcie, więc w momencie decyzji o cenie na jutro dane o dzisiejszym wykonaniu jeszcze nie
istnieją. Wejściem prognozy mogą być wyłącznie rekordy, których `publication_ts` jest
wcześniejszy niż moment odcięcia danych; wykonanie służy tylko uczeniu i ocenie.

## Consequences

- Każda `Prognoza` zapisuje swój moment odcięcia danych, a zapytania o wejście filtrują
  po `publication_ts`, nie po dobie dostawy.
- Ocena wsteczna prowadzona bez tego filtra da wynik zawyżony i **nie zgłosi błędu** —
  to jedyny defekt w tym projekcie, który jest całkowicie cichy.
- Obie pozostałe analizy w repozytorium zakładają dostępność danych bieżących; to założenie
  jest sprzeczne z pomiarem (`pomiary-api-pse.md`, pomiar 1).
