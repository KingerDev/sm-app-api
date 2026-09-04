<?php

namespace App\Models;

use App\Support\SkDate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Jedna správa v rozhovore pod fotkou. Autor je 'S' / 'M' rovnako ako pri
 * chvíľkach — dvaja ľudia, žiadne účty navyše.
 */
class PhotoComment extends Model
{
    protected $fillable = ['photo_id', 'who', 'text'];

    protected $appends = ['when'];

    /** „dnes" / „včera" / „13. máj" — appka to inak počíta z časovej značky sama. */
    public function getWhenAttribute(): string
    {
        $at = $this->created_at;

        if (! $at) {
            return '';
        }

        if ($at->isToday()) {
            return 'dnes';
        }

        if ($at->isYesterday()) {
            return 'včera';
        }

        // rovnaký tvar ako pri chvíľkach: „13. máj", rok len keď nie je tento
        $label = $at->day.'. '.SkDate::MONTHS_SHORT[$at->month];

        return $at->year === now()->year ? $label : $label.' '.$at->year;
    }

    public function photo(): BelongsTo
    {
        return $this->belongsTo(Photo::class);
    }
}
