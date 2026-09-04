<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Moment;
use App\Support\Places;
use App\Support\SkDate;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MomentController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Moment::with('photos.comments')->orderByDesc('date_start')->get()
        );
    }

    public function show(string $slug): JsonResponse
    {
        return response()->json(
            Moment::with('photos.comments')->where('slug', $slug)->firstOrFail()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'        => 'required|string|max:120',
            'place'        => 'required|string|max:120',
            'place_short'  => 'nullable|string|max:60',
            'date_start'   => 'required|date',
            'date_end'     => 'nullable|date|after_or_equal:date_start',
            'who'          => 'nullable|in:S,M,spolu',
            'seed'         => 'nullable|string|max:50',
            'description'  => 'nullable|string|max:2000',
            'country'      => 'nullable|string|max:80',
            'city'         => 'nullable|string|max:80',
        ]);

        $country = $data['country'] ?? null;
        $city = $data['city'] ?? null;
        unset($data['country'], $data['city']);

        $moment = Moment::create($this->prepare($data));

        // Prepojenie na mapu: založí krajinu/mesto ak treba a naviaže moment
        if (filled($country) && filled($city)) {
            Places::ensureCity(Places::ensureCountry($country), $city, $moment->slug);
        }

        return response()->json($moment->load('photos.comments'), 201);
    }

    public function update(Request $request, string $slug): JsonResponse
    {
        $moment = Moment::where('slug', $slug)->firstOrFail();

        $data = $request->validate([
            'title'        => 'string|max:120',
            'place'        => 'string|max:120',
            'place_short'  => 'nullable|string|max:60',
            'date_start'   => 'date',
            'date_end'     => 'nullable|date|after_or_equal:date_start',
            'who'          => 'in:S,M,spolu',
            'seed'         => 'string|max:50',
            'description'  => 'nullable|string|max:2000',
            'country'      => 'nullable|string|max:80',
            'city'         => 'nullable|string|max:80',
        ]);

        $country = $data['country'] ?? null;
        $city = $data['city'] ?? null;
        unset($data['country'], $data['city']);

        if (filled($country) && filled($city)) {
            Places::unlinkMoment($moment->slug);
            Places::ensureCity(Places::ensureCountry($country), $city, $moment->slug);
        }

        if (isset($data['date_start']) || array_key_exists('date_end', $data)) {
            $start = Carbon::parse($data['date_start'] ?? $moment->date_start);
            $end = array_key_exists('date_end', $data)
                ? (filled($data['date_end']) ? Carbon::parse($data['date_end']) : null)
                : $moment->date_end;
            $data['date_display'] = SkDate::display($start, $end);
            $data['date_short']   = SkDate::short($start);
        }

        $moment->update($data);

        return response()->json($moment->load('photos.comments'));
    }

    public function destroy(string $slug): JsonResponse
    {
        Moment::where('slug', $slug)->firstOrFail()->delete();
        Places::unlinkMoment($slug);

        return response()->json(null, 204);
    }

    private function prepare(array $data): array
    {
        $start = Carbon::parse($data['date_start']);
        $end = filled($data['date_end'] ?? null) ? Carbon::parse($data['date_end']) : null;

        $slug = Str::slug($data['title']) ?: 'moment';
        $base = $slug;
        $i = 2;
        while (Moment::where('slug', $slug)->exists()) {
            $slug = $base . '-' . $i++;
        }

        return [
            ...$data,
            'slug'         => $slug,
            'place_short'  => $data['place_short'] ?? Str::limit($data['place'], 30, ''),
            'date_display' => SkDate::display($start, $end),
            'date_short'   => SkDate::short($start),
            'who'          => $data['who'] ?? 'spolu',
            'seed'         => $data['seed'] ?? 'default',
            'sort_order'   => 0,
        ];
    }
}
