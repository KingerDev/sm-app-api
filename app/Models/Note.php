<?php

namespace App\Models;

use App\Support\SkDate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

/** Momentka („chvíľka") — mikro-poznámka z bežného dňa, voliteľne s fotkou. */
class Note extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'text', 'who', 'place', 'place_short', 'date', 'photo_path', 'photo_thumb_path', 'kind',
    ];

    protected $casts = [
        'date' => 'date',
    ];

    protected $appends = ['date_short', 'photo_url', 'photo_thumb_url', 'is_video'];

    /** "13. máj" (rok len ak nie je aktuálny) */
    public function getDateShortAttribute(): string
    {
        $d = $this->date;
        $label = $d->day.'. '.SkDate::MONTHS_SHORT[$d->month];

        return $d->year === now()->year ? $label : $label.' '.$d->year;
    }

    public function getPhotoUrlAttribute(): ?string
    {
        return $this->photo_path ? Storage::disk(config('filesystems.media'))->url($this->photo_path) : null;
    }

    public function getPhotoThumbUrlAttribute(): ?string
    {
        $path = $this->photo_thumb_path ?: $this->photo_path;

        return $path ? Storage::disk(config('filesystems.media'))->url($path) : null;
    }

    /** Pri videu je v photo_path samotné video a v thumbe poster. */
    public function getIsVideoAttribute(): bool
    {
        return $this->kind === 'video';
    }

    protected static function booted(): void
    {
        static::deleting(function (Note $note) {
            // Pri mäkkom mazaní fotku nechávame — inak by sa chvíľka dala vrátiť
            // len ako text a obrázok by bol nenávratne preč.
            if ($note->isForceDeleting()) {
                \App\Support\Images::delete($note->photo_path, $note->photo_thumb_path);
            }
        });
    }
}
