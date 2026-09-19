# ADR-0002: Symulowany portfel w MVP

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

Publiczne raporty opisują pracę KSE i zagregowaną aktywność rynku, ale nie udostępniają pozycji konkretnego tradera. Projekt nie ma obecnie dostępu do rzeczywistych danych portfelowych.

## Decyzja

MVP będzie wykorzystywać symulowany, mieszany portfel tradera do generowania rekomendacji ceny i wolumenu zakupu na RDN. Portfel będzie składać się z oddzielnych segmentów gospodarstw domowych, firm usługowych i przemysłu. Użytkownik będzie mógł zmieniać udziały segmentów albo wybrać gotowy scenariusz.

Rekomendacje oparte na takim portfelu będą jednoznacznie oznaczone jako symulacja. Integracja z rzeczywistym portfelem i automatyczne składanie zleceń pozostają poza zakresem MVP.

## Konsekwencje

- Scenariusze portfela muszą być deterministyczne i możliwe do odtworzenia.
- Każdy segment musi mieć osobny profil zapotrzebowania i jawny udział w całym portfelu.
- Suma udziałów segmentów musi wynosić 100%, a zmiana miksu musi tworzyć nową wersję scenariusza.
- Ocena rekomendacji będzie oparta na backtestingu względem historycznych wyników rynku.
- Produkt zademonstruje mechanizm decyzyjny, ale nie potwierdzi skuteczności dla realnego portfela.
- Model danych powinien umożliwiać późniejsze zastąpienie symulacji importem lub integracją API.
