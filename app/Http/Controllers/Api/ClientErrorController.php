<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Pády natívnej appky. Bez toho sa o chybe, ktorá sa stala tomu druhému,
 * nedozvieme vôbec — appku používajú dvaja ľudia a nikto nehlási bug reporty.
 *
 * Zapisuje sa do samostatného logu (`storage/logs/client.log`), nech sa
 * nemieša so serverovými chybami.
 */
class ClientErrorController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message'  => 'required|string|max:500',
            'stack'    => 'nullable|string|max:4000',
            'fatal'    => 'boolean',
            'where'    => 'nullable|string|max:200',
            'platform' => 'nullable|string|max:20',
            'version'  => 'nullable|string|max:20',
        ]);

        Log::channel('client')->error($data['message'], [
            'user'     => $request->user()?->name,
            'fatal'    => $data['fatal'] ?? false,
            'where'    => $data['where'] ?? null,
            'platform' => $data['platform'] ?? null,
            'version'  => $data['version'] ?? null,
            'stack'    => $data['stack'] ?? null,
        ]);

        return response()->json(null, 204);
    }
}
