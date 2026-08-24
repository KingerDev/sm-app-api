<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Záloha databázy do súboru .sql na zvolený disk (štandardne tam, kde sú médiá,
 * teda R2). Zámerne nepoužíva `mysqldump` — ten na serveri v kontajneri byť
 * nemusí a príkaz by tichšie zlyhal práve vtedy, keď ho treba.
 *
 * Príklady:
 *   php artisan db:backup
 *   php artisan db:backup --disk=local --keep=30
 */
class BackupDatabase extends Command
{
    protected $signature = 'db:backup
        {--disk= : Cieľový disk (štandardne MEDIA_DISK, teda R2)}
        {--path=backups : Priečinok na disku}
        {--keep=14 : Koľko posledných záloh nechať}';

    protected $description = 'Zazálohuje databázu ako .sql na disk (R2)';

    public function handle(): int
    {
        $disk = $this->option('disk') ?: config('filesystems.default');
        $dir = trim((string) $this->option('path'), '/');
        $keep = max(1, (int) $this->option('keep'));

        $name = 'sm-app-'.now()->format('Y-m-d_His').'.sql';
        $target = "{$dir}/{$name}";

        // Dump je písaný pre MySQL (SHOW TABLES / SHOW CREATE TABLE).
        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->error('db:backup vie zatiaľ len MySQL, nie '.DB::connection()->getDriverName().'.');

            return self::FAILURE;
        }

        $this->info("Zálohujem do {$disk}:{$target}");

        $sql = $this->dump();
        Storage::disk($disk)->put($target, $sql);

        $size = number_format(strlen($sql) / 1024, 1, ',', ' ');
        $this->info("Hotovo · {$size} kB");

        $this->prune($disk, $dir, $keep);

        return self::SUCCESS;
    }

    /** Vyskladá SQL so štruktúrou aj dátami všetkých tabuliek. */
    private function dump(): string
    {
        $database = DB::connection()->getDatabaseName();
        $out = "-- S+M · záloha {$database} · ".now()->toDateTimeString()."\n";
        $out .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

        foreach ($this->tables() as $table) {
            $create = (array) DB::selectOne("SHOW CREATE TABLE `{$table}`");
            $out .= "DROP TABLE IF EXISTS `{$table}`;\n".end($create).";\n\n";

            // Po dávkach, nech sa veľká tabuľka nezmestí celá do pamäte naraz.
            DB::table($table)->orderBy(DB::raw('1'))->chunk(500, function ($rows) use (&$out, $table) {
                foreach ($rows as $row) {
                    $values = collect((array) $row)
                        ->map(fn ($v) => $v === null ? 'NULL' : DB::connection()->getPdo()->quote((string) $v))
                        ->implode(', ');

                    $out .= "INSERT INTO `{$table}` VALUES ({$values});\n";
                }
            });

            $out .= "\n";
        }

        return $out."SET FOREIGN_KEY_CHECKS=1;\n";
    }

    /** @return string[] */
    private function tables(): array
    {
        return collect(DB::select('SHOW TABLES'))
            ->map(fn ($row) => array_values((array) $row)[0])
            ->all();
    }

    /** Nechá len posledných `keep` záloh, staršie zmaže. */
    private function prune(string $disk, string $dir, int $keep): void
    {
        $files = collect(Storage::disk($disk)->files($dir))
            ->filter(fn ($f) => str_ends_with($f, '.sql'))
            ->sortDesc()
            ->values();

        $old = $files->slice($keep);

        foreach ($old as $file) {
            Storage::disk($disk)->delete($file);
        }

        if ($old->isNotEmpty()) {
            $this->line("Zmazané staré zálohy: {$old->count()}");
        }
    }
}
