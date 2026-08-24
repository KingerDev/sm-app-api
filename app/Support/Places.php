<?php

namespace App\Support;

use App\Models\Country;
use App\Models\Moment;

/**
 * Správa krajín a miest (mestá žijú ako JSON pole na krajine)
 * + prepájanie momentov na mestá cez momentIds (sluggy momentov).
 */
class Places
{
    /** Nájde krajinu podľa mena (case-insensitive). */
    public static function findCountry(string $name): ?Country
    {
        return Country::whereRaw('LOWER(name) = ?', [mb_strtolower(trim($name))])->first();
    }

    /** Vytvorí krajinu (ak neexistuje) — súradnice a vlajku doplní geokóder. */
    public static function ensureCountry(string $name, ?string $flag = null): Country
    {
        if ($existing = self::findCountry($name)) {
            return $existing;
        }

        $geo = Geocoder::search($name);

        return Country::create([
            'name'         => trim($name),
            'flag'         => $flag ?: (Geocoder::flagEmoji($geo['country_code'] ?? null) ?? '📍'),
            'lat'          => $geo['lat'] ?? null,
            'lng'          => $geo['lng'] ?? null,
            'cities'       => [],
            'cities_count' => 0,
            'photos_count' => 0,
            'sort_order'   => (Country::max('sort_order') ?? 0) + 1,
        ]);
    }

    /** Pridá mesto do krajiny (ak neexistuje) a voliteľne naviaže moment. */
    public static function ensureCity(Country $country, string $cityName, ?string $momentSlug = null): Country
    {
        $cities = $country->cities ?? [];
        $key = mb_strtolower(trim($cityName));

        $index = null;
        foreach ($cities as $i => $city) {
            if (mb_strtolower($city['name']) === $key) {
                $index = $i;
                break;
            }
        }

        if ($index === null) {
            $cities[] = ['name' => trim($cityName), 'photos' => 0, 'momentIds' => []];
            $index = array_key_last($cities);
        }

        if ($momentSlug && ! in_array($momentSlug, $cities[$index]['momentIds'] ?? [], true)) {
            $cities[$index]['momentIds'][] = $momentSlug;
        }

        $country->update(['cities' => $cities, 'cities_count' => count($cities)]);

        return $country->refresh();
    }

    /** Odstráni slug momentu zo všetkých miest (po zmazaní/premenovaní momentu). */
    public static function unlinkMoment(string $slug): void
    {
        Country::all()->each(function (Country $country) use ($slug) {
            $cities = $country->cities ?? [];
            $changed = false;

            foreach ($cities as $i => $city) {
                $ids = $city['momentIds'] ?? [];
                if (in_array($slug, $ids, true)) {
                    $cities[$i]['momentIds'] = array_values(array_diff($ids, [$slug]));
                    $changed = true;
                }
            }

            if ($changed) {
                $country->update(['cities' => $cities]);
            }
        });
    }

    /**
     * Krajina pre API — počty fotiek miest sa rátajú z naviazaných momentov;
     * seedované (fiktívne) počty ostávajú ako základ, kým mesto nemá reálne momenty.
     */
    public static function present(Country $country, ?\Illuminate\Support\Collection $moments = null): array
    {
        $moments ??= Moment::withCount('photos')->get()->keyBy('slug');

        $cities = collect($country->cities ?? [])->map(function (array $city) use ($moments) {
            $fromMoments = collect($city['momentIds'] ?? [])
                ->map(fn ($slug) => $moments[$slug]->photos_count ?? 0)
                ->sum();

            return [
                ...$city,
                'photos' => max($city['photos'] ?? 0, $fromMoments),
            ];
        })->values();

        return [
            ...$country->toArray(),
            'cities'       => $cities,
            'cities_count' => $cities->count(),
            'photos_count' => max($country->photos_count, $cities->sum('photos')),
        ];
    }
}
