<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Popisok konkrétnej fotky — to, čo sa k momentu ako celku napísať nedá.
 *
 * Dĺžka je obmedzená zámerne: popisok sa kreslí do rozložení, ktoré majú na
 * text pevné miesto. Strážiť sa musí na vstupe, nie až pri kreslení.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->string('caption', 160)->nullable()->after('height');
        });
    }

    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->dropColumn('caption');
        });
    }
};
