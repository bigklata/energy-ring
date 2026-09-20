# Weryfikacja instancyjna (`verify:instance`) — runbook

Procedura dla Issue z etykietą `verify:instance`. Uruchamiasz ją **na swoim
sandboxie**, na commicie, który idzie do PR-a, i wklejasz do PR-a **tekst**
wygenerowany w kroku 5. Zasady progów: `.ai/review-checklist.md`, sekcja
„Verification gate”.

Dowód składa się z dwóch części i obie są obowiązkowe:

1. `yarn db:migrate` na **czystej** bazie — liczba zastosowanych migracji.
2. `yarn test:integration:ephemeral` — ile testów uruchomiono i ile przeszło.

Wszystkie bloki są w `bash`, kopiujesz je po kolei w **jednej** sesji terminala
(kroki 1–2b ustawiają zmienne i funkcję sprzątającą używane w krokach 3–6).
Zakładają katalog główny repo. Jeśli domyślną powłoką jest `zsh`, najpierw
uruchom `bash`.

**Nie włączaj `set -e` / `set -u` w tej sesji.** Każdy blok sam sprawdza błędy
i przy porażce wypisuje `STOP: …` zamiast iść dalej. `set -e` w interaktywnej
powłoce zamyka ją przy pierwszym niepowodzeniu — gubisz zmienne, kod wyjścia
i krok 6 (sprzątanie). Jeśli masz je włączone: `set +eu`.

> **Stan na 2026-09-19 (`main` = `c164c6f`): na `main` nie da się jeszcze
> uzyskać zaliczającego dowodu.** Specy pakietów z `node_modules` są
> wykluczone, więc na `main` krok 4 kończy się `Error: No tests found` i
> `exit=1`. To jest **brak dowodu**, nie zaliczenie. Dowód jest możliwy na
> gałęzi, która wnosi co najmniej jeden spec — w jednej z dwóch lokalizacji
> (patrz krok 4): natywnych speców dymnych
> `.ai/qa/tests/TC-INSTANCE-*.spec.ts` (PR #50, ten branch) albo speców modułów
> `src/modules/<modul>/__integration__/*.spec.ts` (np. `TC-RDN-001-…` z PR #52).

## 0. Wymagania wstępne (jednorazowo na sandboxie)

```bash
node -v                       # wymagane >= 24 (inaczej yarn install: "Node >= 24 required")
corepack enable && yarn -v    # yarn 4.x z packageManager
docker info --format '{{.ServerVersion}}'   # ephemeral stawia Postgresa w kontenerze
openssl version               # krok 4 generuje nim jednorazowe sekrety
grep -E '^DATABASE_URL=' .env | sed -E 's/=.*/=<ustawione>/'
```

- `.env` musi mieć `DATABASE_URL` do Postgresa, na którym wolno utworzyć nową
  bazę (`CREATE DATABASE`). Jeśli nie wolno — krok 2a.
- **Runbook nie modyfikuje `.env`** ani sekretów sandboxa. Serwer w trybie
  produkcyjnym (którego używa ephemeral) odmawia startu z sekretem pustym,
  krótszym niż 32 znaki albo z listy placeholderów (np. `change-me-dev-secret`
  z `.env.example`). Dlatego krok 4 podaje runnerowi **własne, jednorazowe**
  `JWT_SECRET`/`AUTH_SECRET`/`NEXTAUTH_SECRET` tylko na czas tej jednej komendy.
  Zmienne ustawione w powłoce mają pierwszeństwo przed `.env` (CLI ładuje
  `.env` przez `dotenv` bez `override`, a runner przekazuje `process.env` do
  aplikacji), więc sekrety i sesje sandboxa zostają nietknięte.

## 1. Checkout na właściwym commicie

```bash
git status --short            # ma być pusto (poza plikami, o których wiesz, że nie są w PR)
VERIFY_BRANCH="feat/issue-20-rdn-contract-skeleton"   # <- podmień na gałąź swojego PR-a
unset VERIFY_SHA
git switch "$VERIFY_BRANCH" && git pull --ff-only && yarn install && yarn generate \
  && export VERIFY_SHA="$(git rev-parse HEAD)" \
  && echo "SHA dowodu: $VERIFY_SHA" || echo "STOP: checkout/instalacja nie powiodły się" >&2
```

Dowód obowiązuje tylko dla tego SHA. Każdy nowy commit w PR = nowy przebieg.
Bez linii `SHA dowodu: …` nie przechodź dalej.

## 2. Czysta baza — osobna, jednorazowa

Nie migrujemy bazy, na której pracuje sandbox. Tworzymy nową, pustą bazę obok
niej (ten sam serwer co `DATABASE_URL` z `.env`, inna nazwa). Adres serwera
bierzemy **wyłącznie** z `VERIFY_BASE_URL` (krok 2a) albo z `.env` —
odziedziczony z powłoki `DATABASE_URL` jest celowo usuwany (`env -u`), bo
`node --env-file` go nie nadpisuje i baza docelowa byłaby niejednoznaczna.

```bash
unset VERIFY_URL
export VERIFY_DB="om_verify_$(date +%Y%m%d%H%M%S)"
if VERIFY_URL="$(env -u DATABASE_URL node --env-file=.env -e '
const { Client } = require("pg");
const url = new URL(process.env.VERIFY_BASE_URL || process.env.DATABASE_URL);
const db = process.env.VERIFY_DB;
if (!/^om_verify_[0-9]{14}$/.test(db ?? "")) { console.error("zla nazwa bazy: " + db); process.exit(1); }
(async () => {
  const c = new Client({ connectionString: url.toString() });
  await c.connect();
  await c.query(`CREATE DATABASE "${db}"`);
  await c.end();
  url.pathname = "/" + db;
  console.log(url.toString());
})().catch((e) => { console.error(e.message); process.exit(1); });
')" && [ -n "$VERIFY_URL" ] \
   && [ "$(node -e 'console.log(new URL(process.argv[1]).pathname.slice(1))' "$VERIFY_URL")" = "$VERIFY_DB" ]
then
  export VERIFY_URL
  echo "czysta baza: $(node -e 'const u = new URL(process.argv[1]); console.log(u.host + u.pathname)' "$VERIFY_URL")"
else
  unset VERIFY_URL
  echo "STOP: nie utworzono czystej bazy — nie przechodź do kroku 3" >&2
fi
```

Sprawdź wypisany `host/om_verify_…`: host ma być serwerem, na którym wolno
tworzyć bazy, a nazwa — właśnie utworzoną bazą. Przy `STOP` krok 3 i tak
odmówi migracji (patrz niżej).

### 2a. Gdy brak `CREATEDB` — osobny Postgres tylko dla weryfikacji

Tylko jeśli krok 2 skończył się `permission denied to create database`.
Kontener nasłuchuje wyłącznie na `127.0.0.1`, ma losowe hasło, a jego ID jest
zapamiętane, żeby krok 6 usunął **tylko** ten kontener:

```bash
VERIFY_PG_PASSWORD="$(openssl rand -hex 24)"
if VERIFY_PG_CONTAINER="$(docker run -d --name "om-verify-pg-$(date +%s)" \
     -e POSTGRES_PASSWORD="$VERIFY_PG_PASSWORD" -p 127.0.0.1:55432:5432 \
     pgvector/pgvector:pg17-trixie)" && [ -n "$VERIFY_PG_CONTAINER" ]
then
  export VERIFY_PG_CONTAINER; echo "kontener: $VERIFY_PG_CONTAINER"
  for _ in $(seq 60); do
    docker exec "$VERIFY_PG_CONTAINER" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break
    sleep 1
  done
  export VERIFY_BASE_URL="postgres://postgres:${VERIFY_PG_PASSWORD}@127.0.0.1:55432/postgres"
else
  unset VERIFY_PG_CONTAINER
  echo "STOP: kontener nie wystartował (np. port 55432 zajęty)" >&2
fi
```

Potem powtórz krok 2 (użyje `VERIFY_BASE_URL`).

### 2b. Sprzątanie awaryjne — wykonaj zaraz po kroku 2

Definiuje `verify_cleanup` (jedyna implementacja sprzątania w tym runbooku —
krok 6 ją wywołuje) i podpina ją pod wyjście z powłoki. Dzięki temu baza
`om_verify_*` i kontener z 2a znikają także wtedy, gdy przerwiesz przebieg
i zamkniesz terminal przed krokiem 6:

```bash
verify_cleanup() {
  if [ -n "${VERIFY_DB:-}" ]; then
    VERIFY_DB="$VERIFY_DB" env -u DATABASE_URL node --env-file=.env -e '
const { Client } = require("pg");
const db = process.env.VERIFY_DB;
if (!/^om_verify_[0-9]{14}$/.test(db)) { console.error("odmowa: " + db + " nie jest baza z tego runbooka"); process.exit(1); }
(async () => {
  const c = new Client({ connectionString: process.env.VERIFY_BASE_URL || process.env.DATABASE_URL });
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
  const r = await c.query("select count(*)::int n from pg_database where datname like $1", ["om_verify_%"]);
  console.log("pozostale bazy om_verify_*:", r.rows[0].n);
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
' || echo "UWAGA: nie udało się usunąć $VERIFY_DB — usuń ją ręcznie" >&2
  fi
  if [ -n "${VERIFY_PG_CONTAINER:-}" ]; then
    docker rm -f "$VERIFY_PG_CONTAINER" >/dev/null 2>&1 \
      || echo "UWAGA: nie udało się usunąć kontenera $VERIFY_PG_CONTAINER" >&2
    unset VERIFY_PG_CONTAINER VERIFY_BASE_URL VERIFY_PG_PASSWORD
  fi
  return 0
}
trap verify_cleanup EXIT
echo "sprzątanie podpięte pod wyjście z powłoki"
```

- Trap jest podpięty **tylko** pod `EXIT`, nie pod `INT`. `Ctrl+C` przerywa
  długą migrację lub testy i zostawia bazę, żeby dało się obejrzeć stan; bazę
  usuwa dopiero zamknięcie powłoki albo krok 6.
- `verify_cleanup` jest idempotentne (`DROP DATABASE IF EXISTS`, `docker rm -f`
  po cichu), więc krok 6 i trap mogą się wykonać po sobie.
- Jeśli uruchomiłeś 2a **po** 2b, nic nie poprawiaj: funkcja czyta
  `VERIFY_PG_CONTAINER` dopiero w momencie wywołania.
- To zabezpieczenie „best effort”: przy `kill -9` powłoki albo zamknięciu okna
  terminala bez SIGHUP trap się nie wykona. Sprzątanie z kroku 6 pozostaje
  właściwą ścieżką, a pozostałości znajdziesz wzorcem `om_verify_%` i
  `docker ps -a --filter name=om-verify-pg-`.

## 3. Migracje na czystej bazie

```bash
set -o pipefail
rm -f /tmp/verify-migrate.log
if [ -n "${VERIFY_URL:-}" ] && [ -n "${VERIFY_DB:-}" ] \
   && [ "$(node -e 'console.log(new URL(process.argv[1]).pathname.slice(1))' "$VERIFY_URL")" = "$VERIFY_DB" ]
then
  echo "migruję: $(node -e 'const u = new URL(process.argv[1]); console.log(u.host + u.pathname)' "$VERIFY_URL")"
  DATABASE_URL="$VERIFY_URL" yarn db:migrate 2>&1 | tee /tmp/verify-migrate.log
  MIGRATE_EXIT=$?
else
  echo "STOP: brak czystej bazy z kroku 2 — db:migrate NIE uruchomiony" >&2
  MIGRATE_EXIT=nie-uruchomiono
fi
export MIGRATE_EXIT; echo "db:migrate exit=$MIGRATE_EXIT"
```

`db:migrate` dostaje `DATABASE_URL` wprost ze zmiennej; `.env` go nie
nadpisuje (CLI ładuje `.env` przez `dotenv` bez `override`). Bez poprawnego
`VERIFY_URL` z kroku 2 migracja nie startuje wcale, więc nie trafi w bazę
z `.env` ani w żadną inną.

Na czystej bazie **każdy** moduł z migracjami wypisuje `<modul>: N migration(s)
applied`, w tym moduł z Twojego Issue (np. `rdn_forecast: 1 migration applied`).
`no pending migrations` przy module aplikacji oznacza, że baza nie była czysta.

## 4. Testy integracyjne na efemerycznej instancji

```bash
set -o pipefail
rm -f /tmp/verify-int.log
JWT_SECRET="$(openssl rand -hex 32)" AUTH_SECRET="$(openssl rand -hex 32)" \
NEXTAUTH_SECRET="$(openssl rand -hex 32)" \
  yarn test:integration:ephemeral --force-rebuild --no-reuse-env 2>&1 | tee /tmp/verify-int.log
export INT_EXIT=$?; echo "test:integration:ephemeral exit=$INT_EXIT"
```

- Sekrety z prefiksu komendy obowiązują tylko dla tego wywołania — nie trafiają
  do `.env` ani do reszty sesji i nie są wypisywane.
- `--force-rebuild` — bez niego build sprzed ≤ 600 s jest używany ponownie
  (`Build cache valid ... Skipping build pipeline`), więc testy mogą chodzić na
  kodzie sprzed Twojej ostatniej zmiany.
- `--no-reuse-env` — bez niego runner podpina się pod pozostawione środowisko
  (`.ai/qa/ephemeral-env.json`) z danymi poprzedniego przebiegu.
- Runner sam stawia Postgresa w kontenerze, stosuje migracje, buduje i startuje
  aplikację (z `--no-reuse-env` na losowym wolnym porcie, np. `127.0.0.1:58068`),
  a na końcu sprząta kontener.
- Uruchamiane są wyłącznie specyfikacje aplikacji w **dwóch** lokalizacjach,
  które `discoverIntegrationSpecFiles` w `.ai/qa/tests/playwright.config.ts`
  wyszukuje w pierwszej kolejności:
  - `.ai/qa/tests/*.spec.ts` — natywne specy dymne instancji
    (np. `TC-INSTANCE-001-organization-lifecycle.spec.ts`);
  - `src/modules/<modul>/__integration__/*.spec.ts` — specy modułów.
  Specyfikacje pakietów z `node_modules/@open-mercato/**` są wykluczone.

Test musi być samowystarczalny: tworzy własne dane w setupie (unikalne
identyfikatory z sufiksem czasu), weryfikuje efekt **przez API**, sprząta w
teardownie i nie korzysta z danych zasianych.

## 5. Dowód do PR-a — jedna komenda

```bash
{
  echo "SHA dowodu: $VERIFY_SHA"
  [ "$(git rev-parse HEAD)" = "${VERIFY_SHA:-brak}" ] || echo "UWAGA: HEAD różni się od SHA z kroku 1 — dowód nieważny"
  echo "## db:migrate na czystej bazie ($VERIFY_DB) — exit=$MIGRATE_EXIT"
  grep -E "migrations? applied" /tmp/verify-migrate.log \
    | awk '{ m++; s += $2 } END { print "modules=" m+0 ", migrations applied=" s+0 }'
  grep -E "^ *($(ls src/modules | paste -sd'|' -)): [0-9]+ migrations? applied|^ *($(ls src/modules | paste -sd'|' -)): no pending" /tmp/verify-migrate.log
  grep -E "Failed|Error" /tmp/verify-migrate.log
  echo "## test:integration:ephemeral — exit=$INT_EXIT"
  grep -E "^Running [0-9]+ tests? |^ +[0-9]+ (passed|failed|flaky|skipped|interrupted|did not run)|No tests found|Failed:" /tmp/verify-int.log
} | tee /tmp/verify-evidence.txt
```

Wklej całość `/tmp/verify-evidence.txt` do PR-a w blok ```` ```text ````,
a SHA również w pole „SHA dowodu” szablonu PR.

### Które linie są dowodem

| linia | co dowodzi | warunek zaliczenia |
| --- | --- | --- |
| `SHA dowodu: …` | wersja kodu | równa ostatniemu commitowi PR-a |
| `db:migrate … exit=0` | migracje weszły bez błędu | `exit=0` |
| `modules=M, migrations applied=N` | baza była czysta i dostała cały schemat | `N > 0`; `M` = liczba modułów z migracjami |
| `<modul>: N migration(s) applied` | migracja z Twojego Issue weszła (wypisywane są tylko moduły z `src/modules`) | obecna dla modułu z Issue |
| `test:integration:ephemeral — exit=0` | runner zakończył się sukcesem | `exit=0` |
| `Running T tests using …` | ile testów uruchomiono | `T ≥ 1`, w tym test z Twojego Issue |
| `P passed (…)` | ile przeszło | `P = T`; brak linii `failed`/`flaky`/`interrupted`/`did not run` |

Nie są dowodem: sama linia `Done`, `✓ Ready`, zrzut ekranu konsoli, wynik
`yarn test` (to `verify:unit`) ani przebieg na bazie, na której wcześniej
działał sandbox.

### Przykład poprawnego dowodu

Przebieg próbny tej procedury (2026-09-19, lokalnie: macOS + Colima, Postgres
`pgvector/pgvector:pg17-trixie`) na commicie `607337f` z PR #48. Liczby
migracji są prawdziwe. Test pochodził z tymczasowego specu dymnego, bo w
repozytorium nie było jeszcze żadnego specu aplikacji — patrz „Częste porażki”.

```text
SHA dowodu: 607337f…
## db:migrate na czystej bazie (om_verify_20260919160604) — exit=0
modules=46, migrations applied=295
 rdn_forecast: 1 migration applied
## test:integration:ephemeral — exit=0
Running 1 test using 1 worker
  1 passed (19.8s)
```

## 6. Sprzątanie — zawsze, także po porażce w krokach 2–5

Wywołuje `verify_cleanup` z kroku 2b. Funkcja łączy się z tym samym serwerem
co krok 2 (`VERIFY_BASE_URL` albo `.env`, bez odziedziczonego `DATABASE_URL`)
i usuwa wyłącznie bazę `om_verify_<czas>` utworzoną w tej sesji oraz — jeśli
był krok 2a — wyłącznie jego kontener:

```bash
if declare -f verify_cleanup >/dev/null; then
  verify_cleanup
else
  echo "STOP: brak verify_cleanup — wykonaj blok z kroku 2b w tej samej sesji" >&2
fi
docker ps --format '{{.Names}} {{.Image}}'   # nie powinno być kontenerów po ephemeral
```

`testcontainers-ryuk-*` może być widoczny jeszcze przez kilkanaście sekund —
to sprzątacz testcontainers, sam się wyłącza. Innych kontenerów ani baz
nie usuwaj — runbook sprząta tylko to, co sam utworzył.

## Częste porażki

| objaw | przyczyna | co zrobić |
| --- | --- | --- |
| `Error: No tests found` i `exit=1` | w `.ai/qa/tests/*.spec.ts` i `src/modules/*/__integration__/` nie ma żadnego specu; specy pakietów są wykluczone | To **nie** jest dowód. Dodaj w swoim zadaniu spec — natywny `.ai/qa/tests/TC-…spec.ts` albo modułowy `src/modules/<modul>/__integration__/TC-…spec.ts` — weryfikujący efekt przez API. Jeśli Issue na to nie pozwala — napisz komentarz i podziel zadanie; nie obniżaj progu. |
| `Refusing to run in production with an unsafe signing secret` / `Application process exited before readiness check` | krok 4 uruchomiony bez prefiksu z sekretami albo w `.env` jest słaby `JWT_<X>_SECRET` (np. `JWT_STAFF_SECRET`) | Powtórz krok 4 dokładnie z bloku. Dla zgłoszonego `JWT_<X>_SECRET` dopisz do prefiksu `JWT_<X>_SECRET="$(openssl rand -hex 32)"`. Nie edytuj `.env`. |
| `Node >= 24 required` przy `yarn install` | stary Node | `nvm install 24 && nvm use 24`. |
| `Container runtime is unavailable` / `Docker CLI is not available` | brak Dockera | Uruchom Docker (na macOS np. `colima start`) i powtórz krok 4. |
| `CREATE DATABASE` → `permission denied` | użytkownik z `DATABASE_URL` nie ma `CREATEDB` | Krok 2a (osobny Postgres na `127.0.0.1`), potem ponownie krok 2. Krok 6 usuwa tylko ten kontener. |
| `STOP: …` z kroku 1–3 | poprzednia komenda zawiodła; zmienne celowo wyczyszczone | Napraw przyczynę (komunikat nad `STOP`) i powtórz od kroku, który zawiódł. Nie ustawiaj `VERIFY_URL` ręcznie. |
| terminal zamknął się w trakcie | włączone `set -e` (np. z wcześniejszej wersji runbooka) | Trap z kroku 2b zwykle posprząta sam — sprawdź to. Jeśli nie (np. `kill -9`): nowa sesja, `set +eu`, `VERIFY_DB=om_verify_<czas>` (nazwa z wcześniejszego wydruku), blok z kroku 2b i krok 6; kontener z kroku 2a znajdziesz przez `docker ps -a --filter name=om-verify-pg-`. Potem od kroku 1. |
| migracja nie wchodzi na czystej bazie | błąd w SQL albo zależność od stanu, którego czysta baza nie ma | Popraw encję, wygeneruj migrację ponownie (`yarn db:generate`), przejrzyj SQL. Nigdy nie edytuj migracji już scalonej do `main` — dodaj nową. Jeśli `db:generate` wygenerował pliki dla innych modułów, usuń je. |
| `<modul aplikacji>: no pending migrations` w kroku 3 | migracje poszły na starą bazę (np. `DATABASE_URL` nie został podmieniony) | Dowód nieważny — powtórz kroki 2–3 w tej samej sesji terminala. |
| `Build cache valid ... Skipping build pipeline` w logu | uruchomienie bez `--force-rebuild` | Powtórz krok 4 z flagami. |
| test przechodzi raz, a przy drugim przebiegu pada na unikalności | test nie sprząta albo używa stałych identyfikatorów | Sufiks czasu w identyfikatorach, sprzątanie w `afterAll` przez API. Sprawdzenie: `--keep`, a potem drugi przebieg z tym samym środowiskiem. |
| sandbox ma stan po poprzednim zadaniu | brudny checkout, stare `.ai/qa/ephemeral-env.json`, zostawione kontenery lub bazy `om_verify_*` | `git status`, `--no-reuse-env`, `docker ps -a`, krok 6. |
| `[query_index] Could not read reindex declarations from …: Cannot find package 'src'` | znane ostrzeżenie CLI przy migracjach aplikacji | Nie blokuje; wynik oceniasz po liczniku i `exit`. |
