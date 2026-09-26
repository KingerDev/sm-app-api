<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Moment môže mať viac miest (dovolenka cez niekoľko miest). `place` a
// `place_short` ostávajú ako zhrnutie pre všetky miesta, kde sa zobrazujú —
// starším momentom `places` chýba a platí len `place`.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('moments', function (Blueprint $table) {
            $table->json('places')->nullable()->after('place_short');
        });
    }

    public function down(): void
    {
        Schema::table('moments', function (Blueprint $table) {
            $table->dropColumn('places');
        });
    }
};
