# ADR-0018: Polityka brakujących danych

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Źródła zewnętrzne mogą publikować dane z opóźnieniem, zmieniać format albo czasowo przestać odpowiadać. Ukryte uzupełnianie wartości mogłoby stworzyć pozornie świeżą, ale niewiarygodną prognozę.

## Decyzja

- Źródło jest oznaczane jako opóźnione po 45 minutach bez udanej aktualizacji.
- Brak wartości docelowej wyklucza rekord z treningu i backtestingu.
- Brak niekrytycznej cechy może zostać uzupełniony tylko za pomocą jawnej, wersjonowanej reguły oraz wskaźnika brakującej wartości.
- Brak krytycznych danych blokuje publikację nowej prognozy.
- Ostatnia poprawna prognoza pozostaje widoczna z oznaczeniem stale i czasem wygenerowania.

## Konsekwencje

- Interfejs pokazuje stan kompletności danych użytych przez prognozę.
- Reguły uzupełniania należą do FeatureSetVersion.
- Niedostępność źródła generuje zdarzenie operacyjne i jest widoczna dla Platform Admin.
- System nie przedstawia starej prognozy jako aktualnej.

