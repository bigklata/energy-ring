# GUARD blokuje brak kompletności oraz wartości poza zakresem technicznym

Twardą blokadę uruchamiają dwa warunki: liczba interwałów inna niż oczekiwana oraz wartość
poza technicznym zakresem cen rynku. Rewizje, opóźnienia publikacji i podejrzane skoki
trafiają do kwarantanny przez VALIDATION, bo bywają prawdziwe.

## Considered Options

Rozważane było ograniczenie GUARD-a wyłącznie do kompletności, z zakresem jako regułą miękką.
Odrzucone — zakres uznano za warunek na tyle twardy, że jego naruszenie nie powinno w ogóle
wejść do prognozy.

## Consequences

**Próg zakresu musi dopuszczać wartości ujemne i nie może być stałą w PLN.** Pomiar pełnej
historii (`pomiary-api-pse.md`, pomiar 4) daje twarde liczby:

- zakres obserwowany: **−2086,86 … 3048,35 PLN/MWh**
- **3,76% wszystkich interwałów historii ma cenę ujemną** — to co 27. interwał, nie wyjątek

Naiwna reguła „cena musi być dodatnia" blokowałaby poprawne dane kilka razy w tygodniu.

Dodatkowo pięć najniższych wartości w całej historii mieści się w przedziale szerokości
0,42 grosza, co wygląda na odbicie od technicznego limitu wyrażonego w euro (hipoteza:
−500 EUR/MWh po kursie dnia; **niepotwierdzona w źródle regulacyjnym**). Jeśli jest
prawdziwa, próg złotowy przesuwa się z kursem euro i **zaszyty na sztywno z czasem zacznie
odrzucać poprawne dane**.

Dlatego próg jest konfiguracją reguły, a nie stałą w kodzie, i podlega weryfikacji wobec
aktualnego limitu technicznego SDAC przed uruchomieniem.

Zaobserwowane ekstrema są rekordami historii, nie granicami fizyki — próg musi być od nich
szerszy.
