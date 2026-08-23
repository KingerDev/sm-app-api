<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Viacdňové udalosti (dovolenka, festival, návšteva) — `date` ostáva začiatkom,
 * `date_end` je nepovinný koniec. Jednodňová udalosť má `date_end` null.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->date('date_end')->nullable()->after('date');
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('date_end');
        });
    }
};
