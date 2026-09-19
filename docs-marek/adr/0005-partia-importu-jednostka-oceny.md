# Jednostką ocenianą przez bramkę jest partia importu, nie punkt pomiarowy

Bramka ocenia `PartiaImportu` — jedno pobranie jednej serii za jedną dobę — a nie pojedyncze
wartości. Najważniejsza kontrola brzmi „czy jest 96 interwałów ze 96", a to jest pytanie
o zbiór, nie o rekord.

## Consequences

- Partia niesie `publication_ts` z PSE, więc wykrycie rewizji (ponownej publikacji tej samej
  doby) jest porównaniem dwóch partii, a nie skanowaniem wartości.
- Punkty pomiarowe nie mają reguł ani indeksu, co domyka ADR-0003.
- To jest encja, którą zespół zamraża wspólnie w pierwszych 30 minutach — wszystkie trzy
  moduły jej dotykają.
