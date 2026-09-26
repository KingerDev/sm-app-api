<?php

namespace App\Support;

use App\Models\BucketItem;
use App\Models\Moment;
use App\Models\Note;
use App\Models\Photo;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Mesačný Wrapped počítaný zo živých dát (momenty, chvíľky, fotky, bucket list).
 *
 * Nič sa neukladá — každé volanie vracia aktuálny stav, takže nový mesiac pribudne
 * sám, len čo v ňom niečo vznikne. Tvar výstupu zámerne kopíruje pôvodnú tabuľku
 * `monthly_wrappeds`, aby klienti (webová SPA aj natívna appka) ostali nezmenení.
 */
class WrappedBuilder
{
    private const SEASONS = [
        12 => 'winter', 1 => 'winter', 2 => 'winter',
        3 => 'spring', 4 => 'spring', 5 => 'spring',
        6 => 'summer', 7 => 'summer', 8 => 'summer',
        9 => 'autumn', 10 => 'autumn', 11 => 'autumn',
    ];

    /**
     * Všetky uzavreté mesiace, v ktorých sa niečo udialo — od najnovšieho.
     *
     * Prebiehajúci mesiac chýba zámerne: september sa otvorí až 1. októbra,
     * inak by Wrapped ukazoval polovičný mesiac a menil sa každý deň.
     */
    public static function all(): Collection
    {
        $moments = Moment::orderBy('date_start')->get([
            'id', 'slug', 'title', 'place', 'place_short', 'date_start', 'date_end', 'photos_count',
        ]);

        $notes = Note::get(['date', 'photo_path']);

        $dayCounts = self::photosPerDay($moments, $notes);

        // Splnené položky bucket listu. Dátum splnenia sa nikde neuchováva, takže
        // sa opierame o updated_at — čo je moment posledného odškrtnutia.
        $bucketDone = BucketItem::where('is_done', true)->get(['text', 'updated_at']);

        $togetherSince = DB::table('settings')->where('key', 'together_since')->value('value');
        $since = $togetherSince ? Carbon::parse($togetherSince)->startOfDay() : null;

        // preserveKeys: v skupinách potrebujeme ostať pri dátumoch dní, nie indexoch
        $photosByMonth = $dayCounts->groupBy(fn (int $n, string $d) => substr($d, 0, 7), true);
        $momentsByMonth = $moments->groupBy(fn (Moment $m) => $m->date_start->format('Y-m'));
        $notesByMonth = $notes->groupBy(fn (Note $n) => $n->date->format('Y-m'));
        $bucketByMonth = $bucketDone->groupBy(fn (BucketItem $b) => $b->updated_at->format('Y-m'));

        $keys = $photosByMonth->keys()
            ->concat($momentsByMonth->keys())
            ->concat($notesByMonth->keys())
            ->concat($bucketByMonth->keys())
            ->unique()
            ->filter(fn (string $key) => $key < now()->format('Y-m'))
            ->sortDesc()
            ->values();

        if ($keys->isEmpty()) {
            return collect();
        }

        // Mesiac s najviac fotkami dostane hviezdičku (klienti ho čítajú ako is_top).
        $topKey = $photosByMonth->only($keys)->map->sum()->sortDesc()->keys()->first();

        return $keys->values()->map(fn (string $key, int $i) => self::build(
            $key,
            $momentsByMonth->get($key, collect()),
            $notesByMonth->get($key, collect()),
            $photosByMonth->get($key, collect()),
            $bucketByMonth->get($key, collect()),
            $since,
            $key === $topKey,
            $i + 1,
        ));
    }

    public static function find(string $wrappedId): ?array
    {
        return self::all()->firstWhere('wrapped_id', $wrappedId);
    }

    /**
     * Počet fotiek na jednotlivé dni: ['Y-m-d' => n].
     *
     * Fotka s vyplneným `taken_at` sa priradí presne. Zvyšné (appka zatiaľ dátum
     * fotenia neukladá, takže dnes sú to prakticky všetky) rozdelíme rovnomerne
     * po dňoch trvania momentu — inak by sa napr. celá štvordňová dovolenka
     * zrátala do jediného dňa a „top deň mesiaca" by tvrdil nezmysel.
     */
    private static function photosPerDay(Collection $moments, Collection $notes): Collection
    {
        $days = [];
        $add = function (string $day, int $n) use (&$days): void {
            $days[$day] = ($days[$day] ?? 0) + $n;
        };

        $byMoment = Photo::where('photoable_type', Moment::class)
            ->get(['photoable_id', 'taken_at'])
            ->groupBy('photoable_id');

        foreach ($moments as $moment) {
            $photos = $byMoment->get($moment->id, collect());
            if ($photos->isEmpty()) {
                continue;
            }

            $undated = 0;
            foreach ($photos as $photo) {
                if ($photo->taken_at) {
                    $add($photo->taken_at->format('Y-m-d'), 1);
                } else {
                    $undated++;
                }
            }

            if ($undated === 0) {
                continue;
            }

            $start = $moment->date_start;
            $end = $moment->date_end ?: $start;
            $span = max(1, $start->diffInDays($end) + 1);

            for ($i = 0; $i < $span; $i++) {
                $share = intdiv($undated, $span) + ($i < $undated % $span ? 1 : 0);
                if ($share > 0) {
                    $add($start->copy()->addDays($i)->format('Y-m-d'), $share);
                }
            }
        }

        // Chvíľky s fotkou sa rátajú tiež — sú to plnohodnotné fotky.
        foreach ($notes->whereNotNull('photo_path') as $note) {
            $add($note->date->format('Y-m-d'), 1);
        }

        return collect($days);
    }

    private static function build(
        string $key,
        Collection $moments,
        Collection $notes,
        Collection $photoDays,
        Collection $bucketDone,
        ?Carbon $since,
        bool $isTop,
        int $sortOrder,
    ): array {
        $date = Carbon::createFromFormat('Y-m-d', $key.'-01')->startOfDay();
        $photosCount = $photoDays->sum();

        // Najsilnejší deň mesiaca
        $topDay = null;
        $topDayCount = 0;
        if ($photoDays->isNotEmpty()) {
            $byDay = $photoDays->sortDesc();
            $topDayDate = Carbon::createFromFormat('Y-m-d', $byDay->keys()->first());
            $topDay = $topDayDate->day.'. '.SkDate::MONTHS_SHORT[$topDayDate->month];
            $topDayCount = $byDay->first();
        }

        $topMoment = $moments->sortByDesc('photos_count')->first();
        $firstBucket = $bucketDone->first();

        return [
            'wrapped_id'       => $key,
            'label'            => SkDate::MONTHS[$date->month].' '.$date->year,
            'month'            => SkDate::MONTHS[$date->month],
            'short'            => SkDate::MONTHS_SHORT[$date->month],
            'season'           => self::SEASONS[$date->month],
            'days_range'       => self::daysRange($date, $since),
            'headline'         => self::headline($moments->count(), $notes->count(), $photosCount),
            'photos_count'     => $photosCount,
            'top_day'          => $topDay ?? '',
            'top_day_count'    => $topDayCount,
            'top_moment_title' => $topMoment->title ?? '',
            'top_moment_place' => $topMoment->place_short ?? ($topMoment->place ?? ''),
            'top_moment_id'    => $topMoment->slug ?? null,
            'bucket_count'     => $bucketDone->count(),
            'bucket_txt'       => $firstBucket->text ?? null,
            'outro'            => self::outro($photosCount),
            'is_top'           => $isTop,
            'sort_order'       => $sortOrder,
        ];
    }

    /** "486–516" — koľký deň spolu bol prvý a posledný deň mesiaca. */
    private static function daysRange(Carbon $monthStart, ?Carbon $since): string
    {
        if (! $since) {
            return '';
        }

        $from = $monthStart->copy()->max($since);
        $to = $monthStart->copy()->endOfMonth()->startOfDay();

        if ($to->lt($since)) {
            return '';
        }

        return $since->diffInDays($from).'–'.$since->diffInDays($to);
    }

    private static function headline(int $moments, int $notes, int $photos): string
    {
        if ($moments > 0) {
            return self::plural($moments, 'moment', 'momenty', 'momentov')
                .' a '.self::plural($photos, 'fotka', 'fotky', 'fotiek');
        }

        if ($notes > 0) {
            return self::plural($notes, 'chvíľka', 'chvíľky', 'chvíľok').' bez veľkých plánov';
        }

        return 'tichý mesiac';
    }

    private static function outro(int $photos): string
    {
        if ($photos === 0) {
            return 'Aj tiché mesiace sa rátajú.';
        }

        // Ukazovacie zámeno sa musí zhodovať s pádom po číslovke:
        // 1 → „za tú jednu", 2–4 → „za tie dve", 5+ → „za tých päť" (genitív).
        if ($photos === 1) {
            return 'Stálo to za tú jednu fotku.';
        }

        return $photos <= 4
            ? "Stálo to za tie {$photos} fotky."
            : "Stálo to za tých {$photos} fotiek.";
    }

    /** Slovenské skloňovanie po číslovke: 1 / 2–4 / 5+ */
    private static function plural(int $n, string $one, string $few, string $many): string
    {
        if ($n === 1) {
            return $n.' '.$one;
        }

        return $n.' '.($n >= 2 && $n <= 4 ? $few : $many);
    }
}
