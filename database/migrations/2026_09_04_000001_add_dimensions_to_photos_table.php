<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Rozmery uloženej fotky. Bez nich appka nevie, či je fotka na výšku alebo na
 * šírku, a do políčok koláže ich sype naslepo — fotka na výšku sa v širokom
 * políčku oreže cez stred a ľuďom to odstrihne hlavy.
 *
 * Staré fotky ostávajú s null; dopočíta ich `php artisan photos:dimensions`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->unsignedInteger('width')->nullable()->after('poster_thumb_path');
            $table->unsignedInteger('height')->nullable()->after('width');
        });
    }

    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->dropColumn(['width', 'height']);
        });
    }
};
