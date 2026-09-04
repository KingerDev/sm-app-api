<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\ImageManager;

/**
 * Spracovanie fotiek pri uploade — WebP v plnej kvalite (max 4096 px, q92)
 * + miniatúra ~480 px pre mriežky. Fotka z mobilu tak zaberie ~3–6 MB
 * namiesto ~1 MB, ale nestráca detail; miniatúra ostáva malá, lebo sa
 * v mriežkach nikdy nezobrazuje vo veľkom.
 * EXIF rotácia sa aplikuje automaticky pri dekódovaní.
 *
 * Web posiela fotky s príznakom `full` — vtedy sa originál uloží tak, ako
 * prišiel, bez zmenšenia a prekódovania. Z prehliadača ide fotka rovno
 * z disku (žiadna kompresia na zariadení ako v natívnej appke), takže by
 * WebP bolo jediné a zbytočné znehodnotenie. Miniatúra sa robí vždy.
 */
class Images
{
    private const MAX_DIMENSION = 4096;
    private const MAX_QUALITY = 92;
    private const THUMB_DIMENSION = 480;
    private const THUMB_QUALITY = 75;

    /**
     * Spracuje nahratú fotku do $dir na public disku. S $full sa originál
     * uloží nedotknutý (bez zmenšenia aj bez prekódovania).
     * Vracia ['path' => ..., 'thumb_path' => ..., 'width' => ..., 'height' => ...].
     *
     * Rozmery patria k `path`, nie k miniatúre — appka podľa nich vyberá, do
     * ktorého políčka koláže fotka sadne, a kam ju v ňom oreže.
     */
    public static function store(UploadedFile $file, string $dir, bool $full = false): array
    {
        $manager = new ImageManager(new GdDriver());
        $image = $manager->decodePath($file->getRealPath());

        $disk = Storage::disk(config('filesystems.media'));
        $base = Str::uuid()->toString();
        $thumbPath = "{$dir}/{$base}-thumb.webp";

        // Po dekódovaní je EXIF rotácia už zarátaná, takže sedia aj fotky
        // odfotené nastojato — v súbore sú na šírku a v hlavičke otočené.
        $width = $image->width();
        $height = $image->height();

        if ($full) {
            $path = "{$dir}/{$base}.".self::extension($file);
            $disk->put($path, file_get_contents($file->getRealPath()));
        } else {
            $path = "{$dir}/{$base}.webp";
            // scaleDown mení ten istý obrázok, z ktorého sa potom robí miniatúra
            $scaled = $image->scaleDown(self::MAX_DIMENSION, self::MAX_DIMENSION);
            $disk->put(
                $path,
                (string) $scaled->encode(new WebpEncoder(quality: self::MAX_QUALITY))
            );
            $width = $scaled->width();
            $height = $scaled->height();
        }

        $disk->put(
            $thumbPath,
            (string) $image->scaleDown(self::THUMB_DIMENSION, self::THUMB_DIMENSION)
                ->encode(new WebpEncoder(quality: self::THUMB_QUALITY))
        );

        return ['path' => $path, 'thumb_path' => $thumbPath, 'width' => $width, 'height' => $height];
    }

    /**
     * Prípona podľa skutočného typu súboru — klient ju v názve mať nemusí
     * (napr. blob z editora) a podľa nej sa fotka servíruje z R2.
     */
    private static function extension(UploadedFile $file): string
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: '');

        return $ext !== '' ? $ext : ($file->guessExtension() ?: 'jpg');
    }

    /**
     * Uloží video do $dir. Samotný súbor sa neprekódováva — prichádza už zmenšený
     * zo zariadenia (720p, obmedzená dĺžka), lebo transkódovanie na serveri je
     * pomalé a vyžadovalo by ffmpeg, ktorý na bežnom hostingu nebýva.
     *
     * Poster je snímka z videa vygenerovaná na zariadení; prejde tou istou
     * obrázkovou linkou ako fotky, takže sa v mriežkach správa rovnako.
     *
     * Vracia ['path', 'poster_path', 'poster_thumb_path', 'width', 'height'].
     */
    public static function storeVideo(UploadedFile $video, ?UploadedFile $poster, string $dir): array
    {
        $base = Str::uuid()->toString();
        $ext = strtolower($video->getClientOriginalExtension() ?: 'mp4');
        $path = "{$dir}/{$base}.{$ext}";

        Storage::disk(config('filesystems.media'))->put(
            $path,
            file_get_contents($video->getRealPath())
        );

        // Rozmery videa berieme z poster snímky — je to ten istý obraz a mriežky
        // aj koláže s videom pracujú cez ňu.
        $poster_paths = ['poster_path' => null, 'poster_thumb_path' => null, 'width' => null, 'height' => null];

        if ($poster) {
            $stored = self::store($poster, $dir);
            $poster_paths = [
                'poster_path'       => $stored['path'],
                'poster_thumb_path' => $stored['thumb_path'],
                'width'             => $stored['width'],
                'height'            => $stored['height'],
            ];
        }

        return ['path' => $path, ...$poster_paths];
    }

    public static function delete(?string ...$paths): void
    {
        foreach (array_filter($paths) as $path) {
            Storage::disk(config('filesystems.media'))->delete($path);
        }
    }
}
