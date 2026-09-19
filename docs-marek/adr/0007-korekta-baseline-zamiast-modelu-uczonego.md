# Metodą prognozy jest korekta baseline'u, nie model uczony

Prognoza to cena z tego samego MTU dobę wcześniej i tydzień wcześniej, przesunięta o różnice
znane w momencie decyzji: prognozowane zapotrzebowanie, wiatr i PV na jutro względem dziś.
Nie ma treningu, zbiorów uczących ani artefaktów modelu.

## Considered Options

- **Mieszanka samych baseline'ów** — odrzucona, bo nie sięga po żadne dane PSE, przez co cała
  warstwa importu staje się dekoracją.
- **Regresja liniowa na tych samych wejściach** — odrzucona mimo niskiego kosztu
  implementacji: wymaga poprawnego rozdziału zbiorów **w czasie**, a zrobiona niepoprawnie
  daje wynik, który wygląda dobrze i jest fałszywy (ADR-0002).
- **Gradient boosting w osobnym serwisie Python** (`docs-grzegorz` ADR-0010/0011/0012) —
  poza budżetem dziesięciu godzin.

## Consequences

- Metoda tłumaczy się jednym zdaniem: jutro więcej wiatru i mniejsze zapotrzebowanie, więc taniej.
- Nie ma czego testować, co jest zgodne z założeniem, że na testy nie ma czasu.
- Sukces mierzy się wyłącznie przez porównanie z oboma baseline'ami; bezwzględny błąd
  prognozy bez tego porównania nie znaczy nic.
