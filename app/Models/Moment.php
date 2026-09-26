<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Moment extends Model
{
    protected $fillable = [
        'slug', 'title', 'place', 'place_short', 'places',
        'date_start', 'date_end', 'date_display', 'date_short',
        'photos_count', 'pinned_count', 'who', 'seed', 'description', 'sort_order',
    ];

    protected $casts = [
        'is_done'  => 'boolean',
        'date_start' => 'date',
        'date_end'   => 'date',
        'places'     => 'array',
    ];

    public function photos(): MorphMany
    {
        // titulná fotka (is_cover) vždy prvá — všade sa používa photos[0] ako cover
        return $this->morphMany(Photo::class, 'photoable')
            ->orderByDesc('is_cover')
            ->orderByDesc('is_pinned')
            ->orderBy('sort_order');
    }

    protected static function booted(): void
    {
        // so zmazaným momentom odídu aj jeho fotky (súbory + záznamy)
        static::deleting(function (Moment $moment) {
            $moment->photos->each->delete();
        });
    }
}
