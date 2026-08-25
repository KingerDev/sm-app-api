<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Chvíľka môže mať aj video, nielen fotku. Súbor ostáva v `photo_path`
 * (pri videu je to samotné video) a `photo_thumb_path` drží poster —
 * `kind` hovorí, čo z toho je.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->string('kind', 10)->default('photo')->after('photo_thumb_path');
        });
    }

    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->dropColumn('kind');
        });
    }
};
