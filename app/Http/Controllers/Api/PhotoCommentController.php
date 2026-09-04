<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Photo;
use App\Models\PhotoComment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Rozhovor pod fotkou.
 *
 * Autora neberieme z požiadavky ako pri chvíľkach — tam sa dá napísať aj za
 * oboch („spolu"), tu je to rozhovor a píše sa vždy sám za seba.
 */
class PhotoCommentController extends Controller
{
    public function store(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            // Dosť na odsek, málo na esej. Prvá správa vlákna slúži aj ako
            // popisok fotky v koláži, kde sa aj tak oreže na jeden riadok.
            'text' => 'required|string|max:500',
        ]);

        $photo = Photo::findOrFail($id);

        $comment = $photo->comments()->create([
            'who'  => $request->user()->name,
            'text' => trim($data['text']),
        ]);

        return response()->json($comment, 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $comment = PhotoComment::findOrFail($id);

        // Mazať sa dá len to svoje — cudziu správu z rozhovoru vziať nemožno.
        if ($comment->who !== $request->user()->name) {
            return response()->json(['message' => 'Toto nie je tvoja správa.'], 403);
        }

        $comment->delete();

        return response()->json(null, 204);
    }
}
