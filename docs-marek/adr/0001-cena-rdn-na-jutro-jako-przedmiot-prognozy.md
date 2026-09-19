# Przedmiotem prognozy jest cena RDN na kolejną dobę

Prognozujemy 96 wartości `csdac_pln` na dobę D, wyznaczane przed momentem decyzji
(~13:50 D-1), a weryfikowane publikacją PSE tego samego dnia.

## Considered Options

- **Kierunek zamiast poziomu** (jutro drożej czy taniej) — jedna liczba dziennie to za mało
  materiału na cokolwiek widocznego; odrzucone mimo niższego kosztu.
- **Prognoza zapotrzebowania zamiast ceny** — PSE publikuje własną prognozę zapotrzebowania
  (`load_fcst`), więc konkurowalibyśmy z operatorem bez powodu, a wynik i tak nie prowadzi
  do decyzji o kupnie ani sprzedaży.

## Consequences

Pętla informacji zwrotnej zamyka się w ciągu jednej doby, co jest jedynym powodem, dla
którego dziesięciogodzinny projekt może w ogóle pokazać, że coś działa.
