<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Note;
use App\Support\Images;
use App\Support\Places;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Momentky („chvíľky") — mikro-poznámky z bežných dní. */
class NoteController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Note::orderByDesc('date')->orderByDesc('id')->get()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'text'        => 'required|string|max:2000',
            'who'         => 'nullable|in:S,M,spolu',
            'place'       => 'nullable|string|max:120',
            'place_short' => 'nullable|string|max:60',
            'city'        => 'nullable|string|max:80',
            'country'     => 'nullable|string|max:80',
            'date'        => 'nullable|date',
            'file'        => 'nullable|file|image|max:40960',
            'video'       => 'nullable|file|mimetypes:video/mp4,video/quicktime,video/x-m4v|max:204800',
            'poster'      => 'nullable|file|image|max:40960',
        ]);

        // Prepojenie na mapu — založí krajinu/mesto ako pri momentoch
        $this->ensurePlace($data);

        $note = new Note([
            'text'        => $data['text'],
            'who'         => $data['who'] ?? 'spolu',
            'place'       => $data['place'] ?? null,
            'place_short' => $data['place_short'] ?? null,
            'date'        => $data['date'] ?? now()->toDateString(),
        ]);

        if ($video = $request->file('video')) {
            // Video sa neprekódováva — prichádza už zmenšené zo zariadenia,
            // rovnako ako pri momentoch. Poster je snímka z videa.
            $stored = Images::storeVideo($video, $request->file('poster'), 'photos/notes');
            $note->photo_path = $stored['path'];
            $note->photo_thumb_path = $stored['poster_thumb_path'];
            $note->kind = 'video';
        } elseif ($file = $request->file('file')) {
            $stored = Images::store($file, 'photos/notes');
            $note->photo_path = $stored['path'];
            $note->photo_thumb_path = $stored['thumb_path'];
            $note->kind = 'photo';
        }

        $note->save();

        return response()->json($note, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'text'        => 'required|string|max:2000',
            'who'         => 'nullable|in:S,M,spolu',
            'place'       => 'nullable|string|max:120',
            'place_short' => 'nullable|string|max:60',
            'city'        => 'nullable|string|max:80',
            'country'     => 'nullable|string|max:80',
            'date'        => 'nullable|date',
            'file'        => 'nullable|file|image|max:40960',
            'video'       => 'nullable|file|mimetypes:video/mp4,video/quicktime,video/x-m4v|max:204800',
            'poster'      => 'nullable|file|image|max:40960',
            'remove_photo' => 'nullable|boolean',
        ]);

        $this->ensurePlace($data);

        $note = Note::findOrFail($id);
        $note->fill([
            'text'        => $data['text'],
            'who'         => $data['who'] ?? $note->who,
            'place'       => $data['place'] ?? null,
            'place_short' => $data['place_short'] ?? null,
            'date'        => $data['date'] ?? $note->date,
        ]);

        if ($video = $request->file('video')) {
            Images::delete($note->photo_path, $note->photo_thumb_path);
            $stored = Images::storeVideo($video, $request->file('poster'), 'photos/notes');
            $note->photo_path = $stored['path'];
            $note->photo_thumb_path = $stored['poster_thumb_path'];
            $note->kind = 'video';
        } elseif ($file = $request->file('file')) {
            Images::delete($note->photo_path, $note->photo_thumb_path);
            $stored = Images::store($file, 'photos/notes');
            $note->photo_path = $stored['path'];
            $note->photo_thumb_path = $stored['thumb_path'];
            $note->kind = 'photo';
        } elseif ($request->boolean('remove_photo')) {
            Images::delete($note->photo_path, $note->photo_thumb_path);
            $note->photo_path = null;
            $note->photo_thumb_path = null;
            $note->kind = 'photo';
        }

        $note->save();

        return response()->json($note);
    }

    public function destroy(int $id): JsonResponse
    {
        // Mäkké mazanie — appka hneď po ňom ponúka „vrátiť". Fotka ostáva na disku,
        // kým sa chvíľka nezmaže natvrdo (`forceDelete`).
        Note::findOrFail($id)->delete();

        return response()->json(null, 204);
    }

    /** Vráti zmazanú chvíľku (tlačidlo „vrátiť" hneď po zmazaní). */
    public function restore(int $id): JsonResponse
    {
        $note = Note::withTrashed()->findOrFail($id);
        $note->restore();

        return response()->json($note->fresh());
    }

    /** Založí krajinu/mesto na mape, ak chvíľka prišla s novým miestom. */
    private function ensurePlace(array $data): void
    {
        if (filled($data['city'] ?? null) && filled($data['country'] ?? null)) {
            Places::ensureCity(Places::ensureCountry($data['country']), $data['city']);
        }
    }
}
