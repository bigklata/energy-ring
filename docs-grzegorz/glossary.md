# Glossary

## RDN

Rynek Dnia Następnego. Rynek spot, na którym energia jest kupowana i sprzedawana dla okresów dostawy następnej doby.

## Okres dostawy

Przedział czasu, którego dotyczy cena i wolumen energii będące przedmiotem transakcji.

## Prognoza ceny

Przewidywana cena energii dla konkretnego okresu dostawy wraz z informacją o niepewności prognozy.

## Rekomendacja zakupowa

Proponowana cena i wolumen zakupu dla okresu dostawy, wyznaczone na podstawie prognozy rynku oraz danych portfela. W MVP nie powoduje automatycznego złożenia zlecenia.

## Sygnał rynkowy

Ocena oczekiwanego kierunku lub poziomu ceny wynikająca wyłącznie z danych rynkowych, niezależna od portfela konkretnego tradera.

## Portfel tradera

Zapotrzebowanie, zakontraktowane pozycje, limity oraz inne ograniczenia potrzebne do wyznaczenia ceny i wolumenu rekomendowanego zakupu.

## Symulowany portfel

Sztucznie wygenerowany, odtwarzalny zestaw zapotrzebowania, pozycji i limitów tradera używany do demonstracji oraz backtestingu rekomendacji. Nie reprezentuje rzeczywistego uczestnika rynku.

## Segment portfela

Część symulowanego portfela reprezentująca gospodarstwa domowe, firmy usługowe albo przemysł, posiadająca własny profil zapotrzebowania i określony udział w portfelu.

## Scenariusz portfela

Wersjonowana konfiguracja udziałów segmentów, ich profili zapotrzebowania oraz całkowitego wolumenu symulowanego portfela.

## MTU

Market Time Unit. Najmniejszy przedział czasu używany do handlu i rozliczenia energii. Na rynku SDAC wynosi 15 minut; nie jest tym samym co godzinowa rozdzielczość prognozy MVP.

## Rozdzielczość prognozy

Długość przedziału, dla którego model zwraca pojedynczą prognozę. W MVP wynosi jedną godzinę.

## Pełne pokrycie zapotrzebowania

Zakup na RDN wolumenu odpowiadającego brakującej pozycji symulowanego portfela dla każdego okresu dostawy.

## Backtesting

Ocena prognozy lub symulowanej rekomendacji na danych historycznych, które nie były dostępne modelowi w momencie podejmowania symulowanej decyzji.

## Model bazowy

Prosta metoda odniesienia, z którą porównywany jest model prognostyczny, na przykład cena z poprzedniego dnia dla odpowiadającego okresu dostawy.

## Opóźnienie danych

Różnica między czasem publikacji danych przez źródło a czasem ich zapisania w systemie.

## Idempotentny import

Import, którego ponowne wykonanie dla tych samych danych nie tworzy duplikatów ani nie zmienia poprawnego wyniku.

## Dane źródłowe

Niezmieniona wartość pobrana z zewnętrznego źródła wraz z identyfikatorem źródła, okresem dostawy, czasem publikacji, czasem pobrania i wersją.

## Pochodzenie danych

Metadane pozwalające ustalić, z którego źródła i endpointu pochodzi wartość, kiedy została opublikowana oraz kiedy system ją pobrał.

## Archiwalna prognoza pogody

Prognoza zachowana w wersji dostępnej przed danym okresem dostawy. Umożliwia backtesting bez wykorzystania późniejszych pomiarów rzeczywistych.

## Wyciek informacji z przyszłości

Błąd oceny modelu polegający na użyciu danych, które nie były dostępne w chwili sporządzania prognozy.

## MAE

Mean Absolute Error. Średnia bezwzględna różnica między prognozowaną a rzeczywistą ceną, raportowana w PLN/MWh.

## Kroczący backtesting

Ocena kolejnych prognoz w porządku chronologicznym, w której model w każdym kroku korzysta tylko z danych dostępnych przed prognozowanym okresem.

## Gradient boosting

Rodzina modeli budujących kolejne drzewa decyzyjne w celu korygowania błędów wcześniejszych drzew. W MVP służy do prognozowania cen i zapotrzebowania.

## SHAP

Metoda wyjaśniania prognozy przez oszacowanie wpływu poszczególnych cech na wynik modelu.

## Serwis ML

Oddzielna usługa Python wykonująca trening, backtesting, inferencję i generowanie wyjaśnień modelu na żądanie Open Mercato.

## Inferencja

Uruchomienie wytrenowanego modelu na nowych danych w celu wygenerowania prognozy.

## Wersja zestawu cech

Identyfikator definicji danych wejściowych użytych do treningu i inferencji modelu.

## Kandydat modelu

Nowo wytrenowana wersja modelu oczekująca na ocenę jakości i ewentualną aktywację.

## Aktywny model

Zatwierdzona wersja modelu używana do generowania bieżących prognoz.

## Artefakt modelu

Wersjonowana, serializowana reprezentacja wytrenowanego modelu wraz z metadanymi i hashem integralności.

## Dane platformowe

Wspólne dane rynkowe, pogodowe, modele i prognozy niezależne od konkretnego klienta, zapisywane wyłącznie przez zaufane procesy platformy.

## Dane tenantowe

Dane należące do konkretnej firmy lub organizacji, takie jak scenariusze portfela i wyniki symulacji, izolowane za pomocą tenant_id oraz organization_id.

## Viewer

Rola odczytująca dane, prognozy i udostępnione wyniki bez możliwości uruchamiania analiz.

## Analyst

Rola tworząca scenariusze oraz uruchamiająca symulacje i backtesting w zakresie własnego tenantu.

## Tenant Admin

Rola zarządzająca użytkownikami i ustawieniami własnego tenantu bez dostępu do konfiguracji całej platformy.

## Platform Admin

Rola zarządzająca wspólnymi źródłami danych, treningami, wersjami modeli i zadaniami platformowymi.

## Backfill

Kontrolowany import danych historycznych sprzed uruchomienia bieżącej synchronizacji.

## Pokrycie danych

Informacja o zakresie czasu, kompletności, lukach i rozdzielczości dostępnej serii danych.

## Stale

Stan prognozy lub źródła, którego dane przekroczyły dopuszczalne opóźnienie i nie powinny być traktowane jako aktualne.

## Cecha krytyczna

Dana wejściowa, bez której system nie publikuje nowej prognozy zgodnie z wersją zestawu cech.

## Health check

Automatyczne sprawdzenie, czy usługa działa i jest gotowa do obsługi zadań.
