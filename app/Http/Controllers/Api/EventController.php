<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Capsule;
use App\Models\Event;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EventController extends Controller
{
    private const DAY_MILESTONES = [500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000];

    /** Typy vlastných udalostí — appka ich ponúka v rovnakom poradí. */
    public const KINDS = ['anniv', 'milestone', 'plan', 'trip', 'date', 'birthday', 'concert', 'visit', 'reminder'];

    /**
     * Vlastné udalosti z DB + odvodené (výročia, míľniky dní, odomknutia kapsúl),
     * v rozsahu -1 rok až +2 roky od dneška.
     */
    public function index(): JsonResponse
    {
        $events = Event::orderBy('date')->get()->map(fn (Event $e) => [
            'id'       => $e->id,
            'title'    => $e->title,
            'date'     => $e->date->toDateString(),
            'date_end' => $e->date_end?->toDateString(),
            'kind'     => $e->kind,
            'icon'     => $e->icon,
            'note'     => $e->note,
            'is_custom' => true,
        ]);

        $derived = collect();
        $today = Carbon::today();
        $from = $today->copy()->subYear();
        $to   = $today->copy()->addYears(2);

        $togetherSince = DB::table('settings')->where('key', 'together_since')->value('value');

        if ($togetherSince) {
            $start = Carbon::parse($togetherSince);

            for ($y = $from->year; $y <= $to->year; $y++) {
                $anniv = $start->copy()->year($y);
                $n = $y - $start->year;
                if ($n >= 1 && $anniv->between($from, $to)) {
                    $derived->push([
                        'id'       => null,
                        'title'    => "{$n}. výročie",
                        'date'     => $anniv->toDateString(),
                        'date_end' => null,
                        'kind'     => 'anniv',
                        'icon'     => '♥',
                        'note'     => null,
                        'is_custom' => false,
                    ]);
                }
            }

            foreach (self::DAY_MILESTONES as $days) {
                $date = $start->copy()->addDays($days);
                if ($date->between($from, $to)) {
                    $derived->push([
                        'id'       => null,
                        'title'    => number_format($days, 0, ',', ' ').' dní spolu',
                        'date'     => $date->toDateString(),
                        'date_end' => null,
                        'kind'     => 'milestone',
                        'icon'     => '✦',
                        'note'     => null,
                        'is_custom' => false,
                    ]);
                }
            }
        }

        Capsule::whereBetween('unlock_date', [$from, $to])->get()->each(function (Capsule $c) use ($derived) {
            $derived->push([
                'id'       => null,
                'title'    => $c->title,
                'date'     => $c->unlock_date->toDateString(),
                'date_end' => null,
                'kind'     => 'capsule',
                'icon'     => '🔒',
                'note'     => null,
                'is_custom' => false,
            ]);
        });

        return response()->json(
            $events->concat($derived)->sortBy('date')->values()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'    => 'required|string|max:255',
            'date'     => 'required|date',
            'date_end' => 'nullable|date|after_or_equal:date',
            'kind'     => 'required|in:'.implode(',', self::KINDS),
            'icon'     => 'nullable|string|max:10',
            'note'     => 'nullable|string',
        ]);

        $event = Event::create($data);

        return response()->json($event, 201);
    }

    public function destroy(int $id): JsonResponse
    {
        Event::findOrFail($id)->delete();

        return response()->json(null, 204);
    }
}
