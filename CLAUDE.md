# S+M — backend a web

Laravel API pre natívnu appku **a zároveň** webová verzia (React SPA
v `resources/js`). Súkromná appka pre pár: momenty, chvíľky, bucket list,
mapa, koláže, kapsuly, Wrapped.

Natívna appka je v samostatnom adresári bez odkazu odtiaľto:
`~/www/react-native-projects/sm_app`. Zmena API sa väčšinou dotkne oboch —
a často aj webových obrazoviek, ktoré sú portom tých istých.

## Príkazy

```bash
php artisan test        # sqlite v pamäti, produkčných dát sa nedotkne
php artisan db:backup   # záloha DB na R2 (plánovač ju púšťa denne o 3:30)
php artisan media:sync s3 --from-url=https://...   # prenos médií
```

## Čo treba vedieť

- **Na databázu sa z lokálu nedá pripojiť** — `.env` má interné meno kontajnera
  (`DB_HOST=wazf...`). Čokoľvek, čo siaha na dáta (`migrate`, `db:backup`,
  `tinker`), sa musí spustiť **na serveri**. Lokálne fungujú len testy.
- **Médiá idú na Cloudflare R2** (`MEDIA_DISK=s3`, `AWS_URL=https://media.kinger.dev`).
  Testy majú disk podvrhnutý cez `phpunit.xml`, na ostré úložisko sa nedostanú.
- **Mestá žijú ako JSON pole na krajine** (`countries.cities`), nie ako tabuľka.
  Pomocník je `App\Support\Places`.
- **Wrapped sa nikde neukladá** — `App\Support\WrappedBuilder` ho ráta zo živých
  dát pri každom volaní. Ročný Wrapped si appka ráta sama na klientovi.
- **Chvíľky sa mažú mäkko** a dajú sa vrátiť (`POST /notes/{id}/restore`). Fotka
  sa z disku maže až pri `forceDelete` — inak by sa chvíľka vrátila bez nej.
- **Udalosti**: okrem tabuľky `events` vracia `/events` aj odvodené (výročia,
  míľniky dní, odomknutia kapsúl) — tie majú `is_custom: false` a `id: null`.
- **Pády natívnej appky** chodia na `POST /client-errors` a zapisujú sa do
  `storage/logs/client.log`.

## Konvencie

- Kód aj komentáre po slovensky; komentár hovorí *prečo*, nie *čo*.
- Nová alebo zmenená koncovka API má mať test v `tests/Feature/ApiTest.php`.
- Commituje sa len na výslovné požiadanie. Push do `main` spúšťa nasadenie,
  takže migrácie treba na serveri pustiť vedome.
