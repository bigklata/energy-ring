# ADR-0007: Dane pogodowe w MVP

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Temperatura wpływa na zapotrzebowanie, a wiatr i nasłonecznienie na produkcję OZE. Backtesting wymaga prognozy pogody dostępnej w chwili podejmowania historycznej decyzji, a nie późniejszego pomiaru rzeczywistego.

## Decyzja

MVP wykorzysta:

- Open-Meteo jako źródło bieżących i archiwalnych prognoz pogody,
- IMGW jako źródło rzeczywistych obserwacji meteorologicznych do walidacji.

Prognozy i obserwacje będą przechowywane jako oddzielne typy danych.

## Konsekwencje

- Backtesting używa wyłącznie wersji prognozy dostępnej przed prognozowanym okresem dostawy.
- Dane IMGW muszą być prezentowane z wymaganą informacją o źródle.
- Przed wykorzystaniem komercyjnym trzeba ponownie sprawdzić warunki licencyjne obu źródeł.
- Minimalny zestaw zmiennych obejmuje temperaturę, prędkość wiatru, zachmurzenie i promieniowanie słoneczne.

