<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Rozhovor pod fotkou. Nahrádza jednoriadkový `photos.caption` — pod fotkou
 * nemá byť titulok, ale to, čo si k nej dvaja ľudia povedia. Popisok sa navyše
 * nedal nikomu pripísať, správa áno.
 *
 * Popisky, ktoré už vznikli, sa nezahadzujú — stanú sa prvou správou vlákna.
 * Autora pri nich nevieme, tak sa berie ten, kto pridal moment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('photo_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('photo_id')->constrained()->cascadeOnDelete();
            $table->string('who', 10);
            $table->text('text');
            $table->timestamps();

            // vlákno sa vždy číta celé a v poradí, v akom vzniklo
            $table->index(['photo_id', 'id']);
        });

        if (Schema::hasColumn('photos', 'caption')) {
            $this->moveCaptionsIntoThreads();

            Schema::table('photos', function (Blueprint $table) {
                $table->dropColumn('caption');
            });
        }
    }

    public function down(): void
    {
        Schema::table('photos', function (Blueprint $table) {
            $table->string('caption', 160)->nullable()->after('height');
        });

        // späť do popisku ide prvá správa vlákna — na viac tam miesto nie je
        foreach (DB::table('photo_comments')->orderBy('id')->get() as $comment) {
            DB::table('photos')
                ->where('id', $comment->photo_id)
                ->whereNull('caption')
                ->update(['caption' => mb_substr($comment->text, 0, 160)]);
        }

        Schema::dropIfExists('photo_comments');
    }

    private function moveCaptionsIntoThreads(): void
    {
        $photos = DB::table('photos')->whereNotNull('caption')->get();

        foreach ($photos as $photo) {
            $who = $photo->photoable_type === \App\Models\Moment::class
                ? DB::table('moments')->where('id', $photo->photoable_id)->value('who')
                : null;

            DB::table('photo_comments')->insert([
                'photo_id'   => $photo->id,
                'who'        => in_array($who, ['S', 'M'], true) ? $who : 'spolu',
                'text'       => $photo->caption,
                'created_at' => $photo->updated_at,
                'updated_at' => $photo->updated_at,
            ]);
        }
    }
};
