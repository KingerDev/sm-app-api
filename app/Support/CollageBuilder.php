<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;
use Intervention\Image\Drivers\Gd\Driver as GdDriver;
use Intervention\Image\Encoders\JpegEncoder;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageInterface;

/**
 * Skladá koláž fotiek do formátu Instagram story (1080 × 1920).
 *
 * Renderuje sa na serveri, nie v telefóne: fotky sú na R2 (sťahovanie na VPS je
 * zadarmo), Intervention aj GD sú tu už kvôli spracovaniu uploadov, a výstup má
 * plné rozlíšenie nezávislé od obrazovky zariadenia.
 *
 * Každá šablóna je samostatná metóda `render*`. Spoločné je len vkladanie fotiek
 * a text — zvyšok si šablóna kreslí sama.
 */
class CollageBuilder
{
    public const W = 1080;
    public const H = 1920;

    /** Koľko fotiek ktorá šablóna využije. */
    public const TEMPLATES = [
        'polaroid' => 4,
        'grid' => 5,
        'tape' => 3,
        'heart' => 27,
        'heartfill' => 6,
        'player' => 1,
        'calendar' => 20,
        'scrapbook' => 4,
        'travel' => 5,
        'caption' => 3,
    ];

    /**
     * Kam sa fotka oreže, keď je vyššia než políčko: 38 % prebytku ide dole
     * z vrchu, zvyšok zospodu. Stred by ľuďom rezal hlavy — tie sú v hornej
     * polovici záberu takmer vždy.
     *
     * To isté číslo má appka v src/lib/photoFit.ts; keď sa mení, mení sa na
     * oboch stranách, inak sa koláž zo servera a z telefónu rozídu.
     */
    private const FOCUS_Y = 0.38;

    private const PAPER = '#fafaf7';
    private const GREEN = '#2d5a3d';
    private const INK = '#3a3a36';
    private const MUTED = '#6b6862';
    private const ACCENT = '#b85a1b';
    private const FRAME = '#ffffff';
    private const LINE = '#e8e4d9';

    private const TILTS = [-2.5, 2.0, -1.5, 2.8, -2.0, 1.6];

    /** Biely okraj polaroidu — dole širší, aby sa doň zmestil popisok. */
    private const POLAROID_PAD = 26;

    private const POLAROID_BOTTOM = 108;

    private const CAPTION_SIZE = 54;

    /**
     * @param  array<int, string|null>  $captions  Popisky pod jednotlivými fotkami
     *                                             (len šablóny, ktoré ich majú).
     */
    public static function make(
        array $photoPaths,
        string $title,
        ?string $subtitle = null,
        string $template = 'polaroid',
        array $captions = [],
    ): ?string {
        // Prázdne miesta zostávajú prázdne — index určuje políčko šablóny.
        if (! array_filter($photoPaths)) {
            return null;
        }

        $template = isset(self::TEMPLATES[$template]) ? $template : 'polaroid';
        $photoPaths = array_slice($photoPaths, 0, self::TEMPLATES[$template]);

        // Do kľúča patrí aj geometria šablóny — inak by sa po zmene rozloženia
        // vracala stará koláž z vyrovnávacej pamäte a vyzeralo by to, že oprava
        // nezabrala.
        $key = 'collages/'.substr(
            sha1(
                $template
                .'|'.md5(json_encode(self::slots($template)))
                .'|'.implode('|', array_map(fn ($p) => (string) $p, $photoPaths))
                .'|'.$title.'|'.$subtitle
                .'|'.implode('~', array_map(fn ($t) => (string) $t, $captions))
            ),
            0,
            24
        ).'.jpg';

        $disk = Storage::disk(config('filesystems.media'));
        if ($disk->exists($key)) {
            return $key;
        }

        $photos = [];
        foreach (array_values($photoPaths) as $i => $path) {
            $photos[$i] = $path ? rescue(fn () => $disk->get($path), null, false) : null;
        }

        if (! array_filter($photos)) {
            return null;
        }

        $manager = new ImageManager(new GdDriver());
        $canvas = self::paperCanvas($manager, $template);

        match ($template) {
            'grid' => self::renderGrid($manager, $canvas, $photos, $title, $subtitle),
            'heartfill' => self::renderHeartFill($manager, $canvas, $photos, $title, $subtitle),
            'tape' => self::renderTape($manager, $canvas, $photos, $title, $subtitle),
            'heart' => self::renderHeart($manager, $canvas, $photos, $title, $subtitle),
            'player' => self::renderPlayer($manager, $canvas, $photos, $title, $subtitle),
            'calendar' => self::renderCalendar($manager, $canvas, $photos, $title, $subtitle),
            'scrapbook' => self::renderScrapbook($manager, $canvas, $photos, $title, $subtitle),
            'travel' => self::renderTravel($manager, $canvas, $photos, $title, $subtitle),
            'caption' => self::renderCaption($manager, $canvas, $photos, $captions),
            default => self::renderPolaroid($manager, $canvas, $photos, $title, $subtitle),
        };

        $disk->put($key, (string) $canvas->encode(new JpegEncoder(quality: 88)));

        return $key;
    }

    /**
     * Políčka šablóny v absolútnych pixeloch: [x, y, šírka, výška, náklon].
     *
     * Jediný zdroj pravdy — z tohto kreslí aj vykresľovanie, aj z toho appka
     * skladá náhľad. Keby to bolo na dvoch miestach, náhľad by časom klamal.
     *
     * @return array<int, array{0:int,1:int,2:int,3:int,4:float}>
     */
    public static function slots(string $template): array
    {
        return match ($template) {
            'grid' => self::gridSlots(),
            'tape' => [
                [130, 340, 560, 660, -2.5],
                [400, 1090, 560, 620, 2.0],
                [80, 1160, 280, 340, -1.5],
            ],
            'heart' => self::heartSlots(),
            'heartfill' => self::heartFillSlots(),
            'player' => [[130, 340, 820, 820, 0.0]],
            'calendar' => self::calendarSlots(),
            'scrapbook' => [
                [110, 430, 520, 620, -3.0],
                [520, 900, 470, 560, 2.5],
                [90, 1130, 380, 460, 1.8],
                [560, 320, 420, 480, 3.5],
            ],
            'caption' => [
                [170, 285, 380, 555, -1.5],
                [560, 645, 385, 560, 1.2],
                [235, 1080, 385, 560, -1.0],
            ],
            'travel' => [
                [80, 520, 300, 300, -3.0],
                [420, 430, 280, 280, 2.0],
                [740, 560, 270, 270, -2.0],
                [190, 900, 290, 290, 2.6],
                [560, 960, 320, 320, -1.6],
            ],
            default => [
                [90, 300, 430, 560, -2.5],
                [560, 340, 430, 560, 2.0],
                [90, 960, 430, 560, -1.5],
                [560, 1000, 430, 560, 2.8],
            ],
        };
    }

    /**
     * Kde na koláži sedí nadpis a podtitul — aby sa v appke dal písať priamo na
     * miesto, kde naozaj bude, nie do samostatných políčok pod náhľadom.
     *
     * Vracia pomer 0–1 aj veľkosť písma a farbu.
     */
    public static function textSlots(string $template): array
    {
        // Šablóny s popiskami pod fotkami spoločný nadpis nemajú — text je
        // súčasťou jednotlivých polaroidov.
        if ($captions = self::captionSlots($template)) {
            return ['title' => null, 'subtitle' => null, 'panel' => null, 'captions' => $captions];
        }

        // [y nadpisu, veľkosť, farba, y podtitulu, veľkosť, farba]
        [$ty, $tsize, $tcolor, $sy, $ssize, $scolor] = match ($template) {
            'grid' => self::gridTextPosition(),
            'player' => [1250, 58, self::INK, 1310, 26, self::MUTED],
            'heartfill' => [300, 88, self::ACCENT, self::H - 240, 34, self::INK],
            'tape' => [180, 96, self::GREEN, self::H - 170, 34, self::INK],
            'heart' => [190, 96, self::GREEN, self::H - 170, 34, self::INK],
            'calendar' => [210, 96, self::GREEN, self::H - 170, 34, self::INK],
            default => [150, 96, self::GREEN, self::H - 170, 34, self::INK],
        };

        // Pri mriežke je text vycentrovaný v zelenom políčku, nie cez celú šírku
        $panel = $template === 'grid' ? self::gridTextPanel() : null;
        $box = $panel ? [$panel['x'], $panel['w']] : [0.08, 0.84];

        return [
            'title' => self::textBox($ty, $tsize, $tcolor, 'caveat', $box),
            'subtitle' => self::textBox($sy, $ssize, $scolor, 'inter', $box),
            // Podklad pod textom, ak naň text sadá (mriežka má zelené políčko).
            // Bez neho by bol v náhľade biely text na papieri neviditeľný.
            'panel' => $panel,
            'captions' => [],
        ];
    }

    /**
     * Popisky v bielom okraji pod fotkami — pomer 0–1, aby ich appka vedela
     * vykresliť presne tam, kde na koláži naozaj budú.
     *
     * Okrem textového políčka vracia aj obrys celej polaroidovej kartičky; bez
     * neho by bol popisok v náhľade tmavým textom na papieri, nie na rámiku.
     */
    public static function captionSlots(string $template): array
    {
        if ($template !== 'caption') {
            return [];
        }

        $pad = self::POLAROID_PAD;
        $bottom = self::POLAROID_BOTTOM;

        return array_map(fn (array $s) => [
            'x' => round(($s[0] - $pad) / self::W, 4),
            'y' => round(($s[1] + $s[3]) / self::H, 4),
            'w' => round(($s[2] + 2 * $pad) / self::W, 4),
            'h' => round($bottom / self::H, 4),
            'size' => round(self::CAPTION_SIZE / self::W, 4),
            'color' => self::INK,
            'font' => 'caveat',
            'tilt' => $s[4],
            'card' => [
                'x' => round(($s[0] - $pad) / self::W, 4),
                'y' => round(($s[1] - $pad) / self::H, 4),
                'w' => round(($s[2] + 2 * $pad) / self::W, 4),
                'h' => round(($s[3] + $pad + $bottom) / self::H, 4),
            ],
        ], self::slots($template));
    }

    /** V mriežke je text v zelenom políčku, nie nad koláží. */
    private static function gridTextPosition(): array
    {
        $pad = 40;
        $gap = 12;
        $cell = (int) ((self::W - 2 * $pad - $gap) / 2);
        $cy = 300 + ($cell + $gap) + $cell / 2;

        return [(int) ($cy - 10), 58, self::PAPER, (int) ($cy + 60), 22, self::PAPER];
    }

    private static function gridTextPanel(): array
    {
        $pad = 40;
        $gap = 12;
        $cell = (int) ((self::W - 2 * $pad - $gap) / 2);

        return [
            'x' => round(($pad + $cell + $gap) / self::W, 4),
            'y' => round((300 + $cell + $gap) / self::H, 4),
            'w' => round($cell / self::W, 4),
            'h' => round($cell / self::H, 4),
            'color' => self::GREEN,
        ];
    }

    private static function textBox(int $y, int $size, string $color, string $font, array $box): array
    {
        return [
            'x' => $box[0],
            'y' => round(($y - $size * 0.75) / self::H, 4),
            'w' => $box[1],
            'h' => round(($size * 1.5) / self::H, 4),
            'size' => round($size / self::W, 4),
            'color' => $color,
            'font' => $font,
        ];
    }

    /** Políčka ako pomer 0–1 — pre náhľad v appke, nezávisle od rozlíšenia. */
    public static function slotsNormalized(string $template): array
    {
        return array_map(fn (array $s) => [
            'x' => round($s[0] / self::W, 4),
            'y' => round($s[1] / self::H, 4),
            'w' => round($s[2] / self::W, 4),
            'h' => round($s[3] / self::H, 4),
            'tilt' => $s[4],
        ], self::slots($template));
    }

    private static function gridSlots(): array
    {
        $pad = 40;
        $gap = 12;
        $cell = (int) ((self::W - 2 * $pad - $gap) / 2);
        $top = 300;
        $slots = [];

        for ($r = 0; $r < 3; $r++) {
            for ($col = 0; $col < 2; $col++) {
                // Index 3 patrí textu, fotka tam nejde
                if ($r * 2 + $col === 3) {
                    continue;
                }
                $slots[] = [$pad + $col * ($cell + $gap), $top + $r * ($cell + $gap), $cell, $cell, 0.0];
            }
        }

        return $slots;
    }

    private static function heartSlots(): array
    {
        // Bunky mriežky, ktoré padnú dovnútra tvaru srdca: (x²+y²−1)³ − x²y³ ≤ 0.
        // Predtým som skladal prstence po krivke a sťahoval ich k počiatku — ten
        // ale nie je stredom srdca, takže sa vnútorné fotky zosypali na kopu.
        $cols = 7;
        $rows = 7;
        $cells = [];

        for ($r = 0; $r < $rows; $r++) {
            for ($c = 0; $c < $cols; $c++) {
                $x = -1.30 + ($c + 0.5) * (2.6 / $cols);
                $y = 1.30 - ($r + 0.5) * (2.65 / $rows);

                if (pow($x * $x + $y * $y - 1, 3) - $x * $x * pow($y, 3) <= 0) {
                    $cells[] = [$c, $r];
                }
            }
        }

        // Prázdne spodné riadky nechceme započítať do výšky
        $usedRows = max(array_column($cells, 1)) + 1;

        $areaX = 70;
        $areaY = 560;
        $areaW = self::W - 2 * $areaX;
        $size = (int) min($areaW / $cols, 1040 / $usedRows) - 6;
        $stepX = $areaW / $cols;
        $stepY = ($size + 6);

        $slots = [];
        foreach ($cells as [$c, $r]) {
            $slots[] = [
                (int) ($areaX + $c * $stepX + ($stepX - $size) / 2),
                (int) ($areaY + $r * $stepY),
                $size,
                $size,
                0.0,
            ];
        }

        return $slots;
    }

    /** Mozaika, ktorá sa oreže do tvaru srdca. Súradnice sú na plátne. */
    private static function heartFillSlots(): array
    {
        [$x, $y, $w, $h] = self::heartBox();

        $r1 = (int) ($h * 0.38);
        $r2 = (int) ($h * 0.32);
        $r3 = $h - $r1 - $r2;

        return [
            [$x, $y, (int) ($w * 0.55), $r1, 0.0],
            [$x + (int) ($w * 0.55), $y, $w - (int) ($w * 0.55), $r1, 0.0],
            [$x, $y + $r1, (int) ($w * 0.30), $r2, 0.0],
            [$x + (int) ($w * 0.30), $y + $r1, (int) ($w * 0.40), $r2, 0.0],
            [$x + (int) ($w * 0.70), $y + $r1, $w - (int) ($w * 0.70), $r2, 0.0],
            [$x, $y + $r1 + $r2, $w, $r3, 0.0],
        ];
    }

    /** Obdĺžnik, do ktorého sa srdce vpisuje: [x, y, šírka, výška]. */
    private static function heartBox(): array
    {
        $w = 1000;
        $h = 1160;

        return [(int) ((self::W - $w) / 2), 430, $w, $h];
    }

    private static function calendarSlots(): array
    {
        $pad = 50;
        $gap = 8;
        $cols = 5;
        $cell = (int) ((self::W - 2 * $pad - ($cols - 1) * $gap) / $cols);
        $top = 420;
        $slots = [];

        for ($r = 0; $r < 4; $r++) {
            for ($col = 0; $col < $cols; $col++) {
                $slots[] = [$pad + $col * ($cell + $gap), $top + $r * ($cell + $gap), $cell, $cell, 0.0];
            }
        }

        return $slots;
    }

    /**
     * Plátno s papierovou textúrou. Textúra sa vkladá slabo krycia — má dodať
     * zrno, nie prefarbiť koláž. Keď podklad chýba, ostane plochá farba.
     */
    private static function paperCanvas(ImageManager $m, string $template): ImageInterface
    {
        $canvas = $m->createImage(self::W, self::H)->fill(self::PAPER);

        $files = glob(resource_path('collage/paper/*.jpg')) ?: [];
        if (! $files) {
            return $canvas;
        }

        sort($files);
        // Podklad podľa šablóny, nie náhodne — inak by tá istá koláž vyzerala
        // pri každom generovaní inak a vyrovnávacia pamäť by strácala zmysel.
        $file = $files[abs(crc32($template)) % count($files)];

        $texture = rescue(fn () => $m->decodePath($file)->cover(self::W, self::H), null, false);
        if ($texture) {
            $canvas->insert($texture, 0, 0, 'top-left', 0.22);
        }

        return $canvas;
    }

    // ---------------------------------------------------------------- šablóny

    /** Rozsypané polaroidy na papieri. */
    private static function renderPolaroid(ImageManager $m, ImageInterface $c, array $photos, string $title, ?string $sub): void
    {
        foreach (self::slots('polaroid') as $i => [$x, $y, $w, $h, $tilt]) {
            if (empty($photos[$i])) {
                continue;
            }
            self::place($m, $c, $photos[$i], $x, $y, $w, $h, $tilt, 26);
        }

        self::title($c, $title, 150);
        self::footer($c, $sub);
    }

    /** Čistá mriežka — 2 stĺpce, jedno políčko patrí textu. */
    private static function renderGrid(ImageManager $m, ImageInterface $c, array $photos, string $title, ?string $sub): void
    {
        foreach (self::slots('grid') as $i => [$x, $y, $w, $h, $tilt]) {
            if (! empty($photos[$i])) {
                self::place($m, $c, $photos[$i], $x, $y, $w, $h, $tilt, 0);
            }
        }

        // Textové políčko je štvrté v mriežke 3×2 — medzi fotkami, nie nad nimi
        $pad = 40;
        $gap = 12;
        $cell = (int) ((self::W - 2 * $pad - $gap) / 2);
        $tx = $pad + ($cell + $gap);
        $ty = 300 + ($cell + $gap);

        $c->drawRectangle(function ($rect) use ($cell, $tx, $ty) {
            $rect->at($tx, $ty);
            $rect->size($cell, $cell);
            $rect->background(CollageBuilder::GREEN);
        });
        self::centeredText($c, $title, $tx + $cell / 2, $ty + $cell / 2 - 10, 58, self::PAPER, 'caveat');
        if ($sub) {
            self::centeredText($c, $sub, $tx + $cell / 2, $ty + $cell / 2 + 60, 22, self::PAPER, 'inter');
        }

        self::brand($c, self::H - 120);
    }

    /** Polaroidy prilepené páskou. */
    private static function renderTape(ImageManager $m, ImageInterface $c, array $photos, string $title, ?string $sub): void
    {
        foreach (self::slots('tape') as $i => [$x, $y, $w, $h, $tilt]) {
            if (empty($photos[$i])) {
                continue;
            }
            self::place($m, $c, $photos[$i], $x, $y, $w, $h, $tilt, 30);
            // Páska sedí na hornej hrane, mierne pootočená oproti fotke
            self::tape($m, $c, (int) ($x + $w / 2), $y - 8, (int) ($w * 0.42), $tilt * 4, $i);
        }

        self::title($c, $title, 180);
        self::footer($c, $sub);
    }

    /** Fotky rozsypané do tvaru srdca. */
    private static function renderHeart(ImageManager $m, ImageInterface $c, array $photos, string $title, ?string $sub): void
    {
        foreach (self::slots('heart') as $i => [$x, $y, $w, $h, $tilt]) {
            if (empty($photos[$i])) {
                continue;
            }
            self::place($m, $c, $photos[$i], $x, $y, $w, $h, $tilt, 18);
        }

        self::title($c, $title, 190);
        self::footer($c, $sub);
    }

    /** Jedna fotka v štýle hudobného prehrávača. */
    private static function renderPlayer(ImageManager $m, ImageInterface $c, array $photos, string $title, ?string $sub): void
    {
        $cardX = 90;
        $cardY = 300;
        $cardW = self::W - 2 * $cardX;
        $cardH = 1300;

        $c->drawRectangle(function ($r) use ($cardH, $cardW, $cardX, $cardY) {
                $r->at($cardX, $cardY);
            $r->size($cardW, $cardH);
            $r->background(CollageBuilder::FRAME);
            $r->border(CollageBuilder::LINE, 2);
        });

        [$px, $py, $pw, $ph] = self::slots('player')[0];
        self::place($m, $c, $photos[0], $px, $py, $pw, $ph, 0, 0);

        $textY = $cardY + 950;
        self::centeredText($c, $title, self::W / 2, $textY, 58, self::INK, 'caveat');
        if ($sub) {
            self::centeredText($c, $sub, self::W / 2, $textY + 60, 26, self::MUTED, 'inter');
        }

        // Prehrávacia lišta s pozíciou a tri tlačidlá
        $barY = $textY + 140;
        $barW = $cardW - 140;
        $c->drawRectangle(function ($r) use ($barW, $barY, $cardX) {
                $r->at($cardX + 70, $barY);
            $r->size($barW, 6);
            $r->background(CollageBuilder::LINE);
        });
        $c->drawRectangle(function ($r) use ($barW, $barY, $cardX) {
                $r->at($cardX + 70, $barY);
            $r->size((int) ($barW * 0.42), 6);
            $r->background(CollageBuilder::GREEN);
        });
        $c->drawCircle(function ($d) use ($barW, $barY, $cardX) {
                $d->at($cardX + 70 + (int) ($barW * 0.42), $barY + 3);
            $d->radius(14);
            $d->background(CollageBuilder::GREEN);
        });

        $btnY = $barY + 110;
        foreach ([-160, 0, 160] as $k => $dx) {
            $cx = (int) (self::W / 2 + $dx);
            $main = $k === 1;

            $c->drawCircle(function ($d) use ($btnY, $cx, $main) {
                $d->at($cx, $btnY);
                $d->radius($main ? 46 : 26);
                $d->background($main ? CollageBuilder::GREEN : CollageBuilder::LINE);
            });

            // Ikony kreslíme ako tvary — písma na serveri prehrávacie symboly nemajú
            if ($main) {
                self::triangle($c, $cx + 4, $btnY, 30, 1, self::PAPER);
            } else {
                $dir = $k === 0 ? -1 : 1;
                self::triangle($c, $cx + 3 * $dir, $btnY, 16, $dir, self::MUTED);
                // Zvislá čiarka na konci, ako majú tlačidlá pre predošlú/ďalšiu
                $c->drawRectangle(function ($r) use ($cx, $btnY, $dir) {
                    $r->at($cx + ($dir > 0 ? 11 : -14), $btnY - 8);
                    $r->size(3, 16);
                    $r->background(CollageBuilder::MUTED);
                });
            }
        }

        self::brand($c, self::H - 90);
    }

    /** Fotky rozmiestnené ako dni v mesiaci. */
    private static function renderCalendar(ImageManager $m, ImageInterface $c, array $photos, string $title, ?string $sub): void
    {
        foreach (self::slots('calendar') as $i => [$x, $y, $w, $h, $tilt]) {
            if (! empty($photos[$i])) {
                self::place($m, $c, $photos[$i], $x, $y, $w, $h, $tilt, 0);

                continue;
            }

            // Prázdny deň — tlmené políčko, nech je vidieť rytmus mesiaca
            $c->drawRectangle(function ($rect) use ($w, $h, $x, $y) {
                $rect->at($x, $y);
                $rect->size($w, $h);
                $rect->background('#eef2ee');
            });
        }

        self::title($c, $title, 210);
        self::centeredText($c, 'p o    u t    s t    š t    p i', self::W / 2, 350, 26, self::MUTED, 'inter');
        self::footer($c, $sub);
    }

    /**
     * Fotky poskladané do mozaiky a orezané do tvaru srdca.
     *
     * GD nemá alfa masku, tak to robíme po riadkoch: pre každý riadok nájdeme
     * úseky, ktoré padnú dovnútra tvaru, a skopírujeme len tie. Vďaka tomu
     * zvládne aj priehlbinu hore, kde sú v jednom riadku dva samostatné úseky.
     */
    private static function renderHeartFill(ImageManager $m, ImageInterface $c, array $photos, string $title, ?string $sub): void
    {
        [$hx, $hy, $hw, $hh] = self::heartBox();

        // Mozaika sa skladá zvlášť a až potom sa oreže
        $mosaic = $m->createImage($hw, $hh)->fill(self::PAPER);

        foreach (self::heartFillSlots() as $i => [$x, $y, $w, $h]) {
            if (empty($photos[$i])) {
                continue;
            }
            $photo = self::fit($m, $photos[$i], $w, $h);
            if ($photo) {
                $mosaic->insert($photo, $x - $hx, $y - $hy, 'top-left');
            }
        }

        $src = $mosaic->core()->native();
        $dst = $c->core()->native();

        for ($row = 0; $row < $hh; $row++) {
            $y = 1.30 - ($row / $hh) * 2.65;
            $start = null;

            for ($col = 0; $col <= $hw; $col++) {
                $x = ($col / $hw) * 2.6 - 1.3;
                $inside = $col < $hw && pow($x * $x + $y * $y - 1, 3) - $x * $x * pow($y, 3) <= 0;

                if ($inside && $start === null) {
                    $start = $col;
                } elseif (! $inside && $start !== null) {
                    imagecopy($dst, $src, $hx + $start, $hy + $row, $start, $row, $col - $start, 1);
                    $start = null;
                }
            }
        }

        self::centeredText($c, $title, self::W / 2, 300, 88, self::ACCENT, 'caveat');
        if ($sub) {
            self::centeredText($c, $sub, self::W / 2, self::H - 240, 34, self::INK, 'inter');
        }
        self::brand($c, self::H - 150);
    }

    /** Scrapbook — roztrhaný papier, páska, lisované kvety a spinka. */
    private static function renderScrapbook(ImageManager $m, ImageInterface $c, array $photos, string $title, ?string $sub): void
    {
        // Útržok papiera pod nadpisom
        self::decor($m, $c, 'torn/paper-01.png', 520, self::W / 2, 250, -1.5, 0.92);

        foreach (self::slots('scrapbook') as $i => [$x, $y, $w, $h, $tilt]) {
            if (empty($photos[$i])) {
                continue;
            }
            self::place($m, $c, $photos[$i], $x, $y, $w, $h, $tilt, 28);

            // Prvé dve fotky pripevníme páskou, tretiu spinkou
            if ($i < 2) {
                self::tape($m, $c, (int) ($x + $w / 2), $y - 6, (int) ($w * 0.4), $tilt * 4, $i);
            } elseif ($i === 2) {
                self::decor($m, $c, 'stickers/clip-01.png', 90, $x + $w - 40, $y - 10, 18, 1.0);
            }
        }

        // Kvety do rohov, hviezdička ako drobnosť
        self::decor($m, $c, 'flowers/flower-02.png', 260, 940, 640, 14, 1.0);
        self::decor($m, $c, 'flowers/flower-01.png', 200, 130, 1010, -22, 1.0);
        self::decor($m, $c, 'stickers/star-01.png', 110, 960, 1560, 8, 1.0);

        self::centeredText($c, $title, self::W / 2, 255, 92, self::GREEN, 'caveat');
        self::footer($c, $sub);
    }

    /** Cesty — fotky rozsypané nad mapou sveta. */
    private static function renderTravel(ImageManager $m, ImageInterface $c, array $photos, string $title, ?string $sub): void
    {
        // Mapa slabo krycia, aby fungovala ako podklad a nie ako hlavný motív
        self::decor($m, $c, 'map/world-01.png', 1060, self::W / 2, 900, 0, 0.34);

        foreach (self::slots('travel') as $i => [$x, $y, $w, $h, $tilt]) {
            if (empty($photos[$i])) {
                continue;
            }
            self::place($m, $c, $photos[$i], $x, $y, $w, $h, $tilt, 22);
        }

        self::decor($m, $c, 'flowers/flower-03.png', 150, 940, 1500, 12, 0.9);

        self::title($c, $title, 230);
        self::footer($c, $sub);
    }

    /**
     * Polaroidy nalepené cez seba, každý s vlastným popiskom v spodnom okraji.
     *
     * Poradie je zámerne odzadu: neskoršie fotky prekrývajú skoršie, takže
     * kartičky pôsobia naozaj naukladané, nie len rozložené vedľa seba.
     */
    private static function renderCaption(ImageManager $m, ImageInterface $c, array $photos, array $captions): void
    {
        // Páska sa lepí od ruky, nie presne do stredu — každá kartička inak
        $offsets = [-0.06, -0.18, -0.26];

        foreach (self::slots('caption') as $i => [$x, $y, $w, $h, $tilt]) {
            if (empty($photos[$i])) {
                continue;
            }

            self::polaroid($m, $c, $photos[$i], $x, $y, $w, $h, $tilt, $captions[$i] ?? null);
            self::tape(
                $m,
                $c,
                (int) ($x + $w * (0.5 + ($offsets[$i] ?? 0))),
                $y - self::POLAROID_PAD - 14,
                (int) ($w * 0.44),
                $tilt * 5 - 4,
                $i
            );
        }

        self::brand($c, self::H - 90);
    }

    /** Popisky do ukážky dizajnu, nech je vidieť, že sa dajú písať pod fotky. */
    public static function sampleCaptions(string $template): array
    {
        return self::captionSlots($template) ? ['spolu', 'navždy', 'my dvaja'] : [];
    }

    // -------------------------------------------------------------- pomocníci

    /**
     * Polaroidová kartička: biely okraj, dole širší, a v ňom popisok.
     *
     * Kartička sa skladá ako samostatný obrázok a otáča sa až celá — inak by
     * popisok zostal rovno, kým fotka nad ním by bola nakrivo.
     */
    private static function polaroid(
        ImageManager $m,
        ImageInterface $canvas,
        string $bytes,
        int $x,
        int $y,
        int $w,
        int $h,
        float $tilt,
        ?string $caption,
    ): void {
        $photo = self::fit($m, $bytes, $w, $h);
        if (! $photo) {
            return;
        }

        $pad = self::POLAROID_PAD;
        $bottom = self::POLAROID_BOTTOM;
        $cardW = $w + 2 * $pad;
        $cardH = $h + $pad + $bottom;

        $card = $m->createImage($cardW, $cardH)->fill(self::FRAME);
        $card->insert($photo, $pad, $pad, 'top-left');

        if ($caption) {
            self::centeredText(
                $card,
                $caption,
                $cardW / 2,
                $pad + $h + $bottom * 0.62,
                self::CAPTION_SIZE,
                self::INK,
                'caveat'
            );
        }

        if (abs($tilt) > 0.01) {
            $card = $card->rotate($tilt, 'rgba(0,0,0,0)');
        }

        $canvas->insert(
            $card,
            (int) ($x - $pad - ($card->width() - $cardW) / 2),
            (int) ($y - $pad - ($card->height() - $cardH) / 2),
            'top-left',
        );
    }

    /**
     * Fotka orezaná do políčka $w × $h. Ako `cover()`, len vodorovný rez
     * neberie zo stredu, ale s posunom nahor (viď FOCUS_Y).
     *
     * Chybnú fotku prehltne — koláž radšej vynechá políčko, než by spadla.
     */
    private static function fit(ImageManager $m, string $bytes, int $w, int $h): ?ImageInterface
    {
        return rescue(function () use ($m, $bytes, $w, $h) {
            $img = $m->decodeBinary($bytes);

            // Zmenšenie na pokrytie políčka: rozhoduje väčší z oboch pomerov,
            // inak by po oreze ostal prázdny pruh.
            $k = max($w / $img->width(), $h / $img->height());
            $img->resize((int) ceil($img->width() * $k), (int) ceil($img->height() * $k));

            $overX = max(0, $img->width() - $w);
            $overY = max(0, $img->height() - $h);

            return $img->crop(
                $w,
                $h,
                (int) round($overX / 2),
                (int) round($overY * self::FOCUS_Y),
            );
        }, null, false);
    }

    /**
     * Vloží ozdobu z resources/collage. $cx/$cy je stred, $width cieľová šírka.
     * Chýbajúci podklad koláž nezhodí — ozdoba sa len vynechá.
     */
    private static function decor(
        ImageManager $m,
        ImageInterface $canvas,
        string $relative,
        int $width,
        float $cx,
        float $cy,
        float $tilt = 0,
        float $opacity = 1.0,
    ): void {
        $file = resource_path('collage/'.$relative);
        if (! is_file($file)) {
            return;
        }

        $img = rescue(fn () => $m->decodePath($file), null, false);
        if (! $img) {
            return;
        }

        $img->scale(width: $width);

        if (abs($tilt) > 0.01) {
            $img = $img->rotate($tilt, 'rgba(0,0,0,0)');
        }

        $canvas->insert(
            $img,
            (int) ($cx - $img->width() / 2),
            (int) ($cy - $img->height() / 2),
            'top-left',
            $opacity,
        );
    }


    /** Trojuholník pre ikony prehrávača. $dir 1 = doprava, −1 = doľava. */
    private static function triangle(ImageInterface $c, int $cx, int $cy, int $size, int $dir, string $color): void
    {
        $half = (int) ($size / 2);

        $c->drawPolygon(function ($p) use ($cx, $cy, $half, $dir, $color) {
            $p->point($cx - $half * $dir, $cy - $half);
            $p->point($cx - $half * $dir, $cy + $half);
            $p->point($cx + $half * $dir, $cy);
            $p->background($color);
        });
    }

    /** Vloží fotku s voliteľným bielym rámikom a pootočením. */
    private static function place(
        ImageManager $m,
        ImageInterface $canvas,
        string $bytes,
        int $x,
        int $y,
        int $w,
        int $h,
        float $tilt = 0,
        int $frame = 0,
    ): void {
        // Poškodený alebo neobrázkový súbor nesmie zhodiť celú koláž — políčko
        // zostane prázdne a zvyšok sa vykreslí.
        $photo = self::fit($m, $bytes, $w, $h);
        if (! $photo) {
            return;
        }

        if ($frame > 0) {
            $photo->resizeCanvas($w + $frame, $h + $frame, self::FRAME, 'center');
        }

        if (abs($tilt) > 0.01) {
            $photo = $photo->rotate($tilt, self::PAPER);
        }

        $canvas->insert(
            $photo,
            (int) ($x - ($photo->width() - $w) / 2),
            (int) ($y - ($photo->height() - $h) / 2),
            'top-left',
        );
    }

    /**
     * Nalepí prúžok washi pásky. Používa skutočné PNG podklady z resources/collage
     * — kreslený obdĺžnik vyzeral lacno, páska má natrhnuté okraje aj priesvitnosť.
     * Keď podklady chýbajú, fotka sa nalepí bez pásky namiesto pádu.
     */
    private static function tape(ImageManager $m, ImageInterface $c, int $x, int $y, int $width, float $tilt, int $variant): void
    {
        $files = glob(resource_path('collage/tape/*.png')) ?: [];
        if (! $files) {
            return;
        }

        sort($files);
        $file = $files[$variant % count($files)];

        $tape = rescue(fn () => $m->decodePath($file), null, false);
        if (! $tape) {
            return;
        }

        $h = (int) ($tape->height() * ($width / $tape->width()));
        $tape->resize($width, max(1, $h));

        if (abs($tilt) > 0.01) {
            $tape = $tape->rotate($tilt, 'rgba(0,0,0,0)');
        }

        $c->insert($tape, (int) ($x - $tape->width() / 2), (int) ($y - $tape->height() / 2), 'top-left');
    }

    private static function title(ImageInterface $c, string $text, int $y): void
    {
        self::centeredText($c, $text, self::W / 2, $y, 96, self::GREEN, 'caveat');
    }

    private static function footer(ImageInterface $c, ?string $sub): void
    {
        if ($sub) {
            self::centeredText($c, $sub, self::W / 2, self::H - 170, 34, self::INK, 'inter');
        }
        self::brand($c, self::H - 90);
    }

    private static function brand(ImageInterface $c, int $y): void
    {
        self::centeredText($c, 'S+M', self::W / 2, $y, 44, self::GREEN, 'caveat');
    }

    private static function centeredText(
        ImageInterface $c,
        string $text,
        float $x,
        float $y,
        int $size,
        string $color,
        string $font,
    ): void {
        $file = resource_path($font === 'caveat' ? 'fonts/Caveat_700Bold.ttf' : 'fonts/Inter_500Medium.ttf');

        $c->text($text, (int) $x, (int) $y, function ($f) use ($color, $file, $size) {
            $f->filename($file);
            $f->size($size);
            $f->color($color);
            $f->align('center');
        });
    }
}
