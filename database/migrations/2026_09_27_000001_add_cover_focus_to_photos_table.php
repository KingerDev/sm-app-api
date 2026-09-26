<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Karty ukazujú z titulky len vodorovný pás. `cover_focus` (0 = hore, 1 = dole)
// hovorí, ktorý — bez neho by to bol vždy stred výrezu, a keď je dôležité hore
// (hlavy), nedá sa k nemu dostať bez toho, aby sa pokazila hlavička momentu.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->float('cover_focus')->nullable()->after('cover_thumb_path');
        });
    }

    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->dropColumn('cover_focus');
        });
    }
};
