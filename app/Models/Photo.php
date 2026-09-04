<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Facades\Storage;

class Photo extends Model
{
    protected $fillable = [
        'photoable_type', 'photoable_id', 'kind', 'path', 'thumb_path', 'cover_path', 'cover_thumb_path',
        'duration', 'poster_path', 'poster_thumb_path',
        'width', 'height',
        'is_pinned', 'is_cover', 'taken_at', 'sort_order',
    ];

    protected $casts = [
        'is_pinned' => 'boolean',
        'is_cover'  => 'boolean',
        'taken_at'  => 'date',
        'duration'  => 'integer',
        'width'     => 'integer',
        'height'    => 'integer',
    ];

    protected $appends = ['url', 'thumb_url', 'cover_url', 'cover_thumb_url', 'is_video', 'poster_url'];

    public function getIsVideoAttribute(): bool
    {
        return $this->kind === 'video';
    }

    /** Snímka z videa — pri fotkách null. */
    public function getPosterUrlAttribute(): ?string
    {
        return $this->poster_path
            ? Storage::disk(config('filesystems.media'))->url($this->poster_path)
            : null;
    }

    /** Rozhovor pod fotkou — v poradí, v akom vznikal. */
    public function comments(): HasMany
    {
        return $this->hasMany(PhotoComment::class)->orderBy('id');
    }

    public function photoable(): MorphTo
    {
        return $this->morphTo();
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk(config('filesystems.media'))->url($this->path);
    }

    public function getThumbUrlAttribute(): string
    {
        // Pri videu vraciame snímku z videa — mriežky tak fungujú bez zmeny.
        $path = $this->is_video
            ? ($this->poster_thumb_path ?: $this->poster_path)
            : ($this->thumb_path ?: $this->path);

        return Storage::disk(config('filesystems.media'))->url($path ?: $this->path);
    }

    /** Výrez titulnej fotky (null = bez výrezu, použije sa originál) */
    public function getCoverUrlAttribute(): ?string
    {
        return $this->cover_path ? Storage::disk(config('filesystems.media'))->url($this->cover_path) : null;
    }

    public function getCoverThumbUrlAttribute(): ?string
    {
        $path = $this->cover_thumb_path ?: $this->cover_path;

        return $path ? Storage::disk(config('filesystems.media'))->url($path) : null;
    }

    protected static function booted(): void
    {
        // s DB záznamom odídu z disku aj súbory
        static::deleting(function (Photo $photo) {
            \App\Support\Images::delete(
                $photo->path, $photo->thumb_path,
                $photo->cover_path, $photo->cover_thumb_path,
                $photo->poster_path, $photo->poster_thumb_path,
            );
        });
    }
}
