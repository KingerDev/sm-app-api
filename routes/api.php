<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BucketController;
use App\Http\Controllers\Api\CapsuleController;
use App\Http\Controllers\Api\CountryController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\GiftController;
use App\Http\Controllers\Api\MomentController;
use App\Http\Controllers\Api\NoteController;
use App\Http\Controllers\Api\PhotoCommentController;
use App\Http\Controllers\Api\PhotoController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\WishlistController;
use App\Http\Controllers\Api\CollageController;
use App\Http\Controllers\Api\WrappedController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('/auth/login', [AuthController::class, 'login']);
    // Token login pre React Native appku (Sanctum personal access token)
    Route::post('/auth/token', [AuthController::class, 'token']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::post('/auth/token-logout', [AuthController::class, 'tokenLogout']);
        Route::get('/auth/user', [AuthController::class, 'user']);

        Route::get('/stats', [StatsController::class, 'index']);

        // Pády natívnej appky
        Route::post('/client-errors', [\App\Http\Controllers\Api\ClientErrorController::class, 'store']);

        Route::get('/settings', [SettingsController::class, 'index']);
        Route::patch('/settings', [SettingsController::class, 'update']);

        Route::get('/moments', [MomentController::class, 'index']);
        Route::post('/moments', [MomentController::class, 'store']);
        Route::get('/moments/{slug}', [MomentController::class, 'show']);
        Route::patch('/moments/{slug}', [MomentController::class, 'update']);
        Route::delete('/moments/{slug}', [MomentController::class, 'destroy']);

        Route::get('/notes', [NoteController::class, 'index']);
        Route::post('/notes', [NoteController::class, 'store']);
        // POST kvôli multipart uploadu fotky (PHP nespracuje súbory v PATCH)
        Route::match(['patch', 'post'], '/notes/{id}', [NoteController::class, 'update'])->whereNumber('id');
        Route::delete('/notes/{id}', [NoteController::class, 'destroy']);
        Route::post('/notes/{id}/restore', [NoteController::class, 'restore']);

        Route::post('/photos', [PhotoController::class, 'store']);
        Route::post('/photos/video', [PhotoController::class, 'storeVideo']);
        Route::patch('/photos/{id}/pin', [PhotoController::class, 'togglePin']);
        Route::post('/photos/{id}/comments', [PhotoCommentController::class, 'store']);
        Route::delete('/photo-comments/{id}', [PhotoCommentController::class, 'destroy']);
        // POST kvôli multipart uploadu výrezu (PHP nespracuje súbory v PATCH)
        Route::match(['patch', 'post'], '/photos/{id}/cover', [PhotoController::class, 'setCover']);
        Route::delete('/photos/{id}', [PhotoController::class, 'destroy']);

        Route::get('/bucket', [BucketController::class, 'index']);
        Route::post('/bucket/categories', [BucketController::class, 'storeCategory']);
        Route::patch('/bucket/categories/{slug}', [BucketController::class, 'updateCategory']);
        Route::delete('/bucket/categories/{slug}', [BucketController::class, 'destroyCategory']);
        Route::post('/bucket/{categorySlug}/items', [BucketController::class, 'storeItem']);
        Route::patch('/bucket/items/{id}/toggle', [BucketController::class, 'toggleItem']);
        Route::delete('/bucket/items/{id}', [BucketController::class, 'destroyItem']);

        Route::get('/countries', [CountryController::class, 'index']);
        Route::post('/countries', [CountryController::class, 'store']);
        Route::delete('/countries/{id}', [CountryController::class, 'destroy']);
        Route::post('/countries/{id}/cities', [CountryController::class, 'storeCity']);
        Route::delete('/countries/{id}/cities', [CountryController::class, 'destroyCity']);

        Route::get('/wishlist', [WishlistController::class, 'index']);
        Route::post('/wishlist', [WishlistController::class, 'store']);
        Route::delete('/wishlist/{id}', [WishlistController::class, 'destroy']);

        Route::get('/events', [EventController::class, 'index']);
        Route::post('/events', [EventController::class, 'store']);
        Route::delete('/events/{id}', [EventController::class, 'destroy']);

        Route::get('/capsules', [CapsuleController::class, 'index']);
        Route::post('/capsules', [CapsuleController::class, 'store']);
        Route::get('/capsules/{slug}', [CapsuleController::class, 'show']);
        Route::delete('/capsules/{slug}', [CapsuleController::class, 'destroy']);

        Route::get('/collages', [CollageController::class, 'index']);
        Route::post('/collages', [CollageController::class, 'store']);
        // POST kvôli multipart uploadu obrázka (PHP nespracuje súbory v PATCH)
        Route::match(['patch', 'post'], '/collages/{id}', [CollageController::class, 'update'])->whereNumber('id');
        Route::delete('/collages/{id}', [CollageController::class, 'destroy']);

        Route::get('/gifts', [GiftController::class, 'index']);
        Route::post('/gifts', [GiftController::class, 'store']);
        Route::patch('/gifts/{id}/open', [GiftController::class, 'open']);
        Route::delete('/gifts/{id}', [GiftController::class, 'destroy']);

        Route::get('/wrapped', [WrappedController::class, 'index']);
        // Ročná koláž musí byť pred {wrappedId}, inak by ju pohltil ten parameter.
        Route::get('/wrapped/year/{year}/collage', [WrappedController::class, 'yearCollage'])->whereNumber('year');
        Route::get('/wrapped/{wrappedId}/collage', [WrappedController::class, 'collage']);
        Route::get('/wrapped/{wrappedId}', [WrappedController::class, 'show']);
    });
});
