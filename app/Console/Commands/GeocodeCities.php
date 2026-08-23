<?php

namespace App\Console\Commands;

use App\Models\Country;
use App\Support\Geocoder;
use Illuminate\Console\Command;

/**
 * Doplní súradnice mestám, ktoré vznikli skôr, než sa začali geokódovať —
 * bez lat/lng sa mesto nedá pripnúť na mapu.
 *
 * Nominatim má limit ~1 požiadavka za sekundu, preto sa medzi mestami čaká.
 *
 * Príklady:
 *   php artisan places:geocode-cities --dry-run
 *   php artisan places:geocode-cities
 *   php artisan places:geocode-cities --force   (skúsi znova aj tie, čo zlyhali)
 */
class GeocodeCities extends Command
{
    protected $signature = 'places:geocode-cities
        {--force : Skúsi znova aj mestá, ktorým sa súradnice nepodarilo nájsť}
        {--dry-run : Len vypíše, čo by sa doplnilo}';

    protected $description = 'Doplní chýbajúce súradnice miest (pre piny na mape)';

    public function handle(): int
    {
        $force = (bool) $this->option('force');
        $dry = (bool) $this->option('dry-run');

        $found = 0;
        $missed = 0;
        $skipped = 0;

        foreach (Country::orderBy('sort_order')->get() as $country) {
            $cities = $country->cities ?? [];
            $changed = false;

            foreach ($cities as $i => $city) {
                $hasCoords = ($city['lat'] ?? null) !== null && ($city['lng'] ?? null) !== null;
                $tried = array_key_exists('lat', $city);

                if ($hasCoords || ($tried && ! $force)) {
                    $skipped++;
                    continue;
                }

                $query = $city['name'] . ', ' . $country->name;

                if ($dry) {
                    $this->line("  bude sa hľadať: {$query}");
                    $found++;
                    continue;
                }

                $geo = Geocoder::search($query);
                $cities[$i]['lat'] = $geo['lat'] ?? null;
                $cities[$i]['lng'] = $geo['lng'] ?? null;
                $changed = true;

                if ($geo) {
                    $found++;
                    $this->info("  ✔ {$query} → {$geo['lat']}, {$geo['lng']}");
                } else {
                    $missed++;
                    $this->warn("  ✖ {$query} — nenašlo sa");
                }

                sleep(1); // Nominatim: max ~1 req/s
            }

            if ($changed) {
                $country->update(['cities' => $cities]);
            }
        }

        $this->newLine();
        $this->info("Doplnené: {$found} · nenájdené: {$missed} · preskočené: {$skipped}");

        return self::SUCCESS;
    }
}
