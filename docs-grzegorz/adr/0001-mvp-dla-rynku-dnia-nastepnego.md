# ADR-0001: MVP dla Rynku Dnia Następnego

- Status: zaakceptowana
- Data: 2026-09-18

## Kontekst

System ma wspierać sprzedawcę lub tradera energii działającego na polskim rynku hurtowym. Celem jest wykorzystanie danych o zapotrzebowaniu, generacji i cenach energii do podejmowania decyzji zakupowych.

Rynki dnia bieżącego i terminowy wymagają innych horyzontów prognozowania, danych oraz sposobów oceny rekomendacji.

## Decyzja

Pierwsza wersja produktu będzie wspierać Rynek Dnia Następnego. Dla każdego okresu dostawy system ma:

- prognozować cenę energii i prezentować wynik z poziomem niepewności,
- generować rekomendację ceny oraz wolumenu zakupu na podstawie danych portfela tradera,
- zapewniać pełne pokrycie symulowanego zapotrzebowania wyłącznie na RDN.

Automatyczne składanie zleceń, strategia „kup lub czekaj”, Rynek Dnia Bieżącego i rynek terminowy nie należą do zakresu pierwszego MVP.

## Konsekwencje

- Model będzie prognozował ceny dla następnej doby.
- Trafność będzie można oceniać względem opublikowanych wyników rynku.
- Dane z PSE, ENTSO-E i GPI mogą być używane jako cechy modelu.
- Rekomendacja ceny i wolumenu będzie w MVP działała na portfelu symulowanym zgodnie z ADR-0002.
- Prognoza rynkowa musi działać niezależnie od dostępności danych konkretnego portfela.
- Rozdzielczością prognozy MVP jest jedna godzina zgodnie z ADR-0008.
- Dane 15-minutowe będą agregowane do wartości godzinowych przed uczeniem i backtestingiem.
