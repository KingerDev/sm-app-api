<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BucketCategory;
use App\Models\BucketItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BucketController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = BucketCategory::with('items')
            ->orderBy('sort_order')
            ->get()
            ->map(fn($cat) => [
                'id'    => $cat->slug,
                'icon'  => $cat->icon,
                'name'  => $cat->name,
                'done'  => $cat->items->where('is_done', true)->count(),
                'total' => $cat->items->count(),
                'items' => $cat->items->map(fn($item) => [
                    'id'  => $item->id,
                    'done' => $item->is_done,
                    // Kedy sa odškrtlo — vlastný stĺpec neexistuje, takže rovnako
                    // ako WrappedBuilder berieme updated_at. Wrapped z toho ráta,
                    // čo ste splnili v danom roku.
                    'done_at' => $item->is_done ? $item->updated_at?->toDateString() : null,
                    'txt'  => $item->text,
                    'sub'  => $item->sub_text,
                ]),
            ]);

        return response()->json($categories);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:60',
            'icon' => 'required|string|max:10',
        ]);

        $slug = Str::slug($data['name']);
        $base = $slug;
        $i = 2;
        while (BucketCategory::where('slug', $slug)->exists()) {
            $slug = $base . '-' . $i++;
        }

        $sort = (BucketCategory::max('sort_order') ?? 0) + 1;

        $cat = BucketCategory::create([
            'slug'       => $slug,
            'name'       => $data['name'],
            'icon'       => $data['icon'],
            'sort_order' => $sort,
        ]);

        return response()->json([
            'id'    => $cat->slug,
            'icon'  => $cat->icon,
            'name'  => $cat->name,
            'done'  => 0,
            'total' => 0,
            'items' => [],
        ], 201);
    }

    public function destroyCategory(string $slug): JsonResponse
    {
        BucketCategory::where('slug', $slug)->firstOrFail()->delete();
        return response()->json(null, 204);
    }

    public function toggleItem(int $id): JsonResponse
    {
        $item = BucketItem::findOrFail($id);
        $item->update(['is_done' => !$item->is_done]);

        return response()->json(['id' => $item->id, 'done' => $item->is_done]);
    }

    public function storeItem(Request $request, string $categorySlug): JsonResponse
    {
        $category = BucketCategory::where('slug', $categorySlug)->firstOrFail();

        $data = $request->validate([
            'text'     => 'required|string|max:200',
            'sub_text' => 'nullable|string|max:100',
            'is_done'  => 'boolean',
        ]);

        $data['sort_order'] = ($category->items()->max('sort_order') ?? 0) + 1;
        $item = $category->items()->create($data);
        $item->refresh();

        return response()->json([
            'id'   => $item->id,
            'done' => (bool) $item->is_done,
            'txt'  => $item->text,
            'sub'  => $item->sub_text,
        ], 201);
    }

    public function destroyItem(int $id): JsonResponse
    {
        BucketItem::findOrFail($id)->delete();
        return response()->json(null, 204);
    }
}
