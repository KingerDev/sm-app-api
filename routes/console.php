<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Denná záloha databázy na R2. Beží len ak je na serveri zapnutý plánovač:
//   * * * * * cd /cesta/k/appke && php artisan schedule:run >> /dev/null 2>&1
Schedule::command('db:backup')->dailyAt('03:30')->onOneServer();
