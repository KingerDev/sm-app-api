<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mäkké mazanie chvíľok — appka po zmazaní ponúkne „vrátiť". Bez toho je
 * omylom zmazaná spomienka nenávratne preč.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::table('notes', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
