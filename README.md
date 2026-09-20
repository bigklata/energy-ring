# Energy Ring — lokalne uruchomienie

Energy Ring rozwija demonstrator prognozy cen RDN na danych PSE. **Ten przewodnik obejmuje uruchomienie hosta Open Mercato i jego panelu `/backend`.** Dostępność klienta PSE oraz modułu RDN wymaga osobnej weryfikacji w uruchamianej wersji; panel RDN, API i replay nie są potwierdzone tym przewodnikiem. [Issue #40](https://github.com/bigklata/energy-ring/issues/40) zależy od [#39/G1](https://github.com/bigklata/energy-ring/issues/39), które ma połączyć panel z rzeczywistym API i potwierdzić pełną ścieżkę E2E. Samo uruchomienie hosta nie oznacza działającego demo RDN.

## Od czystego klona do panelu hosta

Potrzebne są Git, Node.js **co najmniej 24**, Yarn **4.17.1** przez Corepack oraz Docker z Compose. `package.json` deklaruje wersję Yarn i wymaga Node >=24. Poniższe komendy zakładają lokalną, przeznaczoną do tego projektu bazę; **`yarn setup` wykonuje migracje**. Przed uruchomieniem sprawdź `DATABASE_URL` w `.env` i nie kieruj go na istniejącą bazę z ważnymi danymi.

```bash
git clone https://github.com/bigklata/energy-ring.git
cd energy-ring
corepack enable
node --version
yarn --version
cp .env.example .env
docker compose up -d postgres redis meilisearch
yarn setup
```

W `.env.example` są lokalne wartości `DATABASE_URL=postgres://postgres:postgres@localhost:5432/open-mercato` i odpowiadające im zmienne `POSTGRES_*`, z których korzysta `docker-compose.yml`. Jeśli zmienisz nazwę bazy, użytkownika, hasło lub port, utrzymaj `DATABASE_URL` i `POSTGRES_*` spójne w lokalnym `.env` przed `yarn setup`; nie trzeba edytować pliku Compose. Nie umieszczaj prawdziwych sekretów w repozytorium. `yarn setup` instaluje pakiety, uruchamia `yarn generate`, `yarn db:migrate`, `yarn initialize`, a następnie serwer deweloperski; nie należy uruchamiać tych kroków drugi raz tylko po to, aby „dokończyć” tę sekwencję. Jeśli któryś etap się nie powiedzie, odczytaj błąd w terminalu zamiast zakładać gotowość panelu.

**Sekrety.** `JWT_SECRET` i `AUTH_SECRET` w `.env.example` (linie 17 i 25) to placeholdery deweloperskie (`change-me-dev-secret`, `change-me-dev-auth-secret`). Wystarczają do lokalnego `yarn setup`, ale — jak zapisano w komentarzu przy `JWT_SECRET` — serwer w trybie produkcyjnym **odmawia startu**, gdy sekret jest pusty, krótszy niż 32 znaki albo rozpoznany jako placeholder. Dotyczy to także weryfikacji na efemerycznej instancji. Zanim uruchomisz cokolwiek poza lokalnym trybem deweloperskim, wygeneruj własne wartości (`openssl rand -hex 32`) i podaj je przez zmienne środowiskowe tej jednej komendy; nie commituj ich i nie wpisuj prawdziwych sekretów do repozytorium.

**Meilisearch.** Zmienne `MEILISEARCH_*` w `.env.example` (linie 791–794) są zakomentowane, więc wyszukiwanie działa w trybie zastępczym (token-based) i kontener `meilisearch` nie jest wymagany do `yarn setup` ani do otwarcia panelu hosta. Jest w komendzie `docker compose up` dla wygody; jeśli chcesz testować wyszukiwanie pełnotekstowe, odkomentuj `MEILISEARCH_HOST=http://localhost:7700` oraz `MEILISEARCH_API_KEY` i ustaw klucz zgodny z `MEILI_MASTER_KEY` z `docker-compose.yml` (domyślnie `meilisearch-dev-key`).

Po zakończeniu startu otwórz [http://localhost:3000/backend](http://localhost:3000/backend) i zaloguj się kontem utworzonym przez inicjalizację. Lokalny skrypt rozgrzewający logowanie (`scripts/dev-runtime.mjs`) domyślnie próbuje `superadmin@acme.com` / `secret`; jeśli `yarn initialize` utworzył konto z innymi danymi, użyj tych danych i ustaw odpowiadające im `OM_INIT_SUPERADMIN_EMAIL` oraz `OM_INIT_SUPERADMIN_PASSWORD` w lokalnym `.env`, aby rozgrzewanie nie zwracało 401. To wyłącznie domyślne dane deweloperskie — nie używaj ich poza lokalnym środowiskiem. Strona postępu jest domyślnie pod [http://localhost:4000](http://localhost:4000). Przy kolejnym uruchomieniu przygotowanego środowiska użyj `yarn dev`; ten skrypt domyślnie próbuje zastosować oczekujące migracje, więc ponownie sprawdź cel `DATABASE_URL` przed startem. Nie ustawiaj `OM_AUTOLOGIN_*` do zwykłego lokalnego logowania.

## Granica obecnego uruchomienia

| Krok | Stan w tym commicie |
| --- | --- |
| Start lokalnej infrastruktury, instalacja, inicjalizacja i panel hosta `/backend` | Komendy istnieją w repozytorium; poprawny start na czystej maszynie wymaga osobnego wykonania i weryfikacji. |
| Panel RDN `/backend/rdn-forecast` | **Niedostępny**: to proponowana trasa, nie zarejestrowana strona. |
| Import PSE, kontrola jakości, prognoza, ocena i replay przez UI/API | **Niepotwierdzone przez ten przewodnik**: wymagają aktywnego modułu RDN, spięcia PSE i dowodu E2E z #39/G1. |

Scenariusz przyszłego pokazu oraz warunki uczciwego oznaczenia replay są w [docs/demo.md](docs/demo.md). Kontrakt produktu i ograniczenia danych opisują [specyfikacja MVP](.ai/specs/2026-09-19-rdn-forecast-mvp.md), [projekt kontraktów](.ai/specs/2026-09-19-rdn-forecast-mvp-technical-contracts.md) i [metoda prognozy](docs/rdn-forecast-method.md). Są to źródła wymagań, a nie dowód, że odpowiadający im kod już działa.
