<?php

namespace App\Console\Commands;

use App\Models\Photo;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Dopočíta `width`/`height` fotkám, ktoré vznikli pred tým, ako sa rozmery
 * ukladali. Bez nich appka skladá koláže naslepo.
 *
 * Štandardne číta plnú fotku, aby v stĺpcoch boli tie isté čísla, aké tam
 * pri novom uploade zapíše `Images::store()`. S `--thumb` sa číta miniatúra —
 * stiahne sa ~30 kB namiesto megabajtov a pomer strán vyjde rovnaký, ale
 * v stĺpcoch potom budú rozmery miniatúry (~480 px). Na výber políčka v koláži
 * to stačí, na čokoľvek, čo by rátalo so skutočnou veľkosťou, nie.
 *
 * Musí bežať na serveri — z lokálu sa na databázu ani na R2 nedostaneš.
 *
 * Príklad:
 *   php artisan photos:dimensions
 *   php artisan photos:dimensions --thumb --chunk=200
 */
class BackfillPhotoDimensions extends Command
{
    protected $signature = 'photos:dimensions
        {--thumb : Čítať miniatúru namiesto plnej fotky (rýchle, ale uloží rozmery miniatúry)}
        {--chunk=100 : Koľko fotiek spracovať naraz}';

    protected $description = 'Dopočíta rozmery fotkám, ktoré ich nemajú';

    public function handle(): int
    {
        $disk = Storage::disk(config('filesystems.media'));
        $fromThumb = (bool) $this->option('thumb');

        $query = Photo::query()->whereNull('width');
        $total = $query->count();

        if ($total === 0) {
            $this->info('Všetky fotky už rozmery majú.');

            return self::SUCCESS;
        }

        $this->info("Dopočítavam rozmery pre {$total} fotiek…");
        $bar = $this->output->createProgressBar($total);

        $done = 0;
        $failed = 0;

        $query->chunkById((int) $this->option('chunk'), function ($photos) use ($disk, $fromThumb, $bar, &$done, &$failed) {
            foreach ($photos as $photo) {
                // Pri videu je obrazom poster; samotný súbor GD prečítať nevie.
                $path = $fromThumb
                    ? ($photo->is_video ? ($photo->poster_thumb_path ?: $photo->poster_path) : ($photo->thumb_path ?: $photo->path))
                    : ($photo->is_video ? $photo->poster_path : $photo->path);

                $size = $path && $disk->exists($path)
                    ? @getimagesizefromstring($disk->get($path))
                    : false;

                if (! $size) {
                    $failed++;
                    $bar->advance();

                    continue;
                }

                $photo->forceFill(['width' => $size[0], 'height' => $size[1]])->save();
                $done++;
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);
        $this->info("Hotovo: {$done} doplnených".($failed ? ", {$failed} sa nepodarilo prečítať" : '').'.');

        return self::SUCCESS;
    }
}
