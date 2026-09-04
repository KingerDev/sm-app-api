<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Capsule;
use App\Models\Moment;
use App\Models\Photo;
use App\Support\Images;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PhotoController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'     => 'required|in:moment,capsule',
            'id'       => 'required|integer',
            'files'    => 'required|array|min:1',
            'files.*'  => 'file|image|max:40960',
            'taken_at' => 'nullable|date',
            'full'     => 'nullable|boolean',
        ]);

        // Web posiela originály — na zariadení cez ne nič nešlo, tak ich
        // neprekódovávame. Natívna appka fotku zmenší už pred odoslaním.
        $full = $request->boolean('full');

        $parent = $data['type'] === 'moment'
            ? Moment::findOrFail($data['id'])
            : Capsule::findOrFail($data['id']);

        $maxSort = $parent->photos()->max('sort_order') ?? 0;

        $photos = collect($request->file('files'))->values()->map(function ($file, $i) use ($parent, $data, $maxSort, $full) {
            // Optimalizácia: WebP max 4096 px + miniatúra (z ~25 MB ostane ~1 MB)
            $stored = Images::store($file, $data['type'] === 'moment' ? 'photos/moments' : 'photos/capsules', $full);

            return $parent->photos()->create([
                ...$stored,
                'kind'       => 'image',
                'taken_at'   => $data['taken_at'] ?? null,
                'sort_order' => $maxSort + $i + 1,
            ]);
        });

        $this->syncCounts($parent);

        return response()->json($photos->values(), 201);
    }

    /**
     * Nahranie videa. Súbor prichádza už zmenšený zo zariadenia (720p, obmedzená
     * dĺžka) spolu s poster snímkou — server ho ďalej neprekódováva, lebo by to
     * vyžadovalo ffmpeg a zbytočne zaťažovalo malý stroj.
     */
    public function storeVideo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'     => 'required|in:moment,capsule',
            'id'       => 'required|integer',
            'video'    => 'required|file|mimetypes:video/mp4,video/quicktime,video/x-m4v|max:204800',
            'poster'   => 'nullable|file|image|max:20480',
            'duration' => 'nullable|integer|min:0',
            'taken_at' => 'nullable|date',
        ]);

        $parent = $data['type'] === 'moment'
            ? Moment::findOrFail($data['id'])
            : Capsule::findOrFail($data['id']);

        $stored = Images::storeVideo(
            $request->file('video'),
            $request->file('poster'),
            $data['type'] === 'moment' ? 'photos/moments' : 'photos/capsules',
        );

        $photo = $parent->photos()->create([
            ...$stored,
            'kind'       => 'video',
            'duration'   => $data['duration'] ?? null,
            'taken_at'   => $data['taken_at'] ?? null,
            'sort_order' => ($parent->photos()->max('sort_order') ?? 0) + 1,
        ]);

        $this->syncCounts($parent);

        return response()->json($photo, 201);
    }

    /**
     * Popisok fotky. Prázdny text ho zmaže — inak by sa nedal vziať späť
     * bez toho, aby sa fotka zmazala celá.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'caption' => 'nullable|string|max:160',
        ]);

        $photo = Photo::findOrFail($id);
        $caption = trim($data['caption'] ?? '');

        $photo->update(['caption' => $caption !== '' ? $caption : null]);

        return response()->json($photo);
    }

    public function togglePin(int $id): JsonResponse
    {
        $photo = Photo::findOrFail($id);
        $photo->update(['is_pinned' => ! $photo->is_pinned]);

        $this->syncCounts($photo->photoable);

        return response()->json($photo);
    }

    /**
     * Nastaví fotku ako titulnú (cover) — ostatným fotkám momentu/kapsuly sa zruší.
     * Voliteľný `file` je orezaný výrez z editora — uloží sa samostatne,
     * originál fotky zostáva nedotknutý.
     */
    public function setCover(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'file' => 'nullable|file|image|max:40960',
            'full' => 'nullable|boolean',
        ]);

        $photo = Photo::findOrFail($id);

        // ostatné fotky prídu o cover aj o uložený výrez
        Photo::where('photoable_type', $photo->photoable_type)
            ->where('photoable_id', $photo->photoable_id)
            ->where('id', '!=', $photo->id)
            ->where(fn ($q) => $q->where('is_cover', true)->orWhereNotNull('cover_path'))
            ->get()
            ->each(function (Photo $other) {
                Images::delete($other->cover_path, $other->cover_thumb_path);
                $other->update(['is_cover' => false, 'cover_path' => null, 'cover_thumb_path' => null]);
            });

        $data = ['is_cover' => true];

        if ($file = $request->file('file')) {
            Images::delete($photo->cover_path, $photo->cover_thumb_path);
            $stored = Images::store($file, 'photos/covers', $request->boolean('full'));
            $data['cover_path'] = $stored['path'];
            $data['cover_thumb_path'] = $stored['thumb_path'];
        }

        $photo->update($data);

        return response()->json($photo);
    }

    public function destroy(int $id): JsonResponse
    {
        $photo = Photo::findOrFail($id);
        $parent = $photo->photoable;

        $photo->delete(); // súbory zmaže model event

        $this->syncCounts($parent);

        return response()->json(null, 204);
    }

    private function syncCounts(Moment|Capsule $parent): void
    {
        $parent->update([
            'photos_count' => $parent->photos()->count(),
            ...($parent instanceof Moment
                ? ['pinned_count' => $parent->photos()->where('is_pinned', true)->count()]
                : []),
        ]);
    }
}
