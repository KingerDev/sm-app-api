<?php

namespace Tests\Feature;

use App\Models\Capsule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ApiTest extends TestCase
{
    use RefreshDatabase;

    private function actingUser(): User
    {
        return User::factory()->create(['name' => 'M', 'email' => 'm@sm.app']);
    }

    public function test_api_requires_auth(): void
    {
        $this->getJson('/api/v1/stats')->assertUnauthorized();
        $this->getJson('/api/v1/moments')->assertUnauthorized();
    }

    public function test_login_and_stats(): void
    {
        $user = User::factory()->create(['password' => 'tajneheslo']);

        $this->postJson('/api/v1/auth/login', [
            'email'    => $user->email,
            'password' => 'tajneheslo',
        ])->assertOk();

        $this->getJson('/api/v1/stats')->assertOk()->assertJsonStructure([
            'days_together', 'photos', 'countries', 'cities', 'bucket_done', 'bucket_total',
        ]);
    }

    public function test_note_can_hold_a_video_with_poster(): void
    {
        Storage::fake('public');
        $this->actingAs($this->actingUser());

        $note = $this->postJson('/api/v1/notes', [
            'text'   => 'Hráme UNO',
            'video'  => UploadedFile::fake()->create('klip.mp4', 800, 'video/mp4'),
            'poster' => UploadedFile::fake()->image('poster.jpg', 800, 600),
        ])->assertCreated()->json();

        $this->assertTrue($note['is_video']);
        $this->assertNotNull($note['photo_url']);      // samotné video
        $this->assertNotNull($note['photo_thumb_url']); // poster

        // Fotka po videu prepne druh späť
        $this->postJson("/api/v1/notes/{$note['id']}", [
            'text' => 'Hráme UNO',
            'file' => UploadedFile::fake()->image('foto.jpg', 800, 600),
        ])->assertOk()->assertJsonFragment(['is_video' => false]);
    }

    public function test_bucket_category_can_be_renamed_and_reiconed(): void
    {
        $this->actingAs($this->actingUser());

        $cat = $this->postJson('/api/v1/bucket/categories', ['name' => 'Cestovanie', 'icon' => '✈'])
            ->assertCreated()
            ->json();

        $this->patchJson("/api/v1/bucket/categories/{$cat['id']}", ['name' => 'Výlety', 'icon' => '🏔'])
            ->assertOk()
            ->assertJsonFragment(['name' => 'Výlety', 'icon' => '🏔']);

        // Slug ostáva rovnaký, inak by sa stratila väzba na položky.
        $this->getJson('/api/v1/bucket')->assertJsonFragment(['id' => $cat['id'], 'name' => 'Výlety']);
    }

    public function test_deleted_note_can_be_restored_with_its_photo(): void
    {
        $this->actingAs($this->actingUser());

        $created = $this->postJson('/api/v1/notes', ['text' => 'Zmokli sme', 'who' => 'M'])
            ->assertCreated()
            ->json();

        $id = $created['id'];

        $this->deleteJson("/api/v1/notes/{$id}")->assertNoContent();
        $this->getJson('/api/v1/notes')->assertJsonMissing(['text' => 'Zmokli sme']);

        $this->postJson("/api/v1/notes/{$id}/restore")->assertOk();
        $this->getJson('/api/v1/notes')->assertJsonFragment(['text' => 'Zmokli sme']);
    }

    public function test_client_errors_are_logged_and_require_auth(): void
    {
        // Bez prihlásenia sa hlásenie neprijme — endpoint nesmie byť otvorený svetu.
        $this->postJson('/api/v1/client-errors', ['message' => 'x'])->assertUnauthorized();

        Log::shouldReceive('channel')->with('client')->once()->andReturnSelf();
        Log::shouldReceive('error')->once();

        $this->actingAs($this->actingUser());

        $this->postJson('/api/v1/client-errors', [
            'message'  => 'Cannot read property of undefined',
            'stack'    => 'at Wrapped (app/wrapped.tsx:1)',
            'fatal'    => true,
            'platform' => 'android',
        ])->assertNoContent();
    }

    public function test_moment_crud_generates_slug_and_slovak_dates(): void
    {
        $this->actingAs($this->actingUser());

        $res = $this->postJson('/api/v1/moments', [
            'title'      => 'Víkend vo Viedni',
            'place'      => 'Viedeň · Rakúsko',
            'date_start' => '2026-04-12',
            'date_end'   => '2026-04-14',
            'who'        => 'S',
        ])->assertCreated();

        $slug = $res->json('slug');
        $this->assertSame('vikend-vo-viedni', $slug);
        $this->assertSame('12. – 14. apríl 2026', $res->json('date_display'));
        $this->assertSame('apr 2026', $res->json('date_short'));

        $this->patchJson("/api/v1/moments/{$slug}", ['title' => 'Viedeň inak'])
            ->assertOk()
            ->assertJsonPath('title', 'Viedeň inak');

        $this->deleteJson("/api/v1/moments/{$slug}")->assertNoContent();
        $this->getJson("/api/v1/moments/{$slug}")->assertNotFound();
    }

    public function test_photo_upload_is_optimized_to_webp_with_thumbnail(): void
    {
        \Storage::fake('public');
        $this->actingAs($this->actingUser());

        $moment = \App\Models\Moment::create([
            'slug' => 'foto-test', 'title' => 'Foto test', 'place' => 'doma',
            'place_short' => 'doma', 'date_start' => '2026-07-01',
            'date_display' => '1. júl 2026', 'date_short' => 'júl 2026', 'seed' => 'home',
        ]);

        $file = \Illuminate\Http\Testing\File::image('velka.jpg', 5000, 3750);

        $res = $this->post('/api/v1/photos', [
            'type' => 'moment', 'id' => $moment->id, 'files' => [$file],
        ], ['Accept' => 'application/json'])->assertCreated();

        $photo = \App\Models\Photo::first();
        $this->assertStringEndsWith('.webp', $photo->path);
        $this->assertStringEndsWith('-thumb.webp', $photo->thumb_path);
        \Storage::disk('public')->assertExists($photo->path);
        \Storage::disk('public')->assertExists($photo->thumb_path);

        // hlavná fotka zmenšená na max 4096 px
        [$w, $h] = getimagesizefromstring(\Storage::disk('public')->get($photo->path));
        $this->assertLessThanOrEqual(4096, max($w, $h));

        // miniatúra max 480 px
        [$tw, $th] = getimagesizefromstring(\Storage::disk('public')->get($photo->thumb_path));
        $this->assertLessThanOrEqual(480, max($tw, $th));

        $this->assertArrayHasKey('thumb_url', $res->json()[0]);
    }

    public function test_cover_photo_moves_to_front(): void
    {
        \Storage::fake('public');
        $this->actingAs($this->actingUser());

        $moment = \App\Models\Moment::create([
            'slug' => 'cover-test', 'title' => 'Cover test', 'place' => 'doma',
            'place_short' => 'doma', 'date_start' => '2026-07-01',
            'date_display' => '1. júl 2026', 'date_short' => 'júl 2026', 'seed' => 'home',
        ]);

        $this->post('/api/v1/photos', [
            'type' => 'moment', 'id' => $moment->id,
            'files' => [
                \Illuminate\Http\Testing\File::image('prva.jpg', 800, 600),
                \Illuminate\Http\Testing\File::image('druha.jpg', 800, 600),
            ],
        ], ['Accept' => 'application/json'])->assertCreated();

        [$first, $second] = \App\Models\Photo::orderBy('id')->get();

        $this->patchJson("/api/v1/photos/{$second->id}/cover")->assertOk();

        $photos = $this->getJson('/api/v1/moments/cover-test')->json('photos');
        $this->assertSame($second->id, $photos[0]['id']);
        $this->assertTrue($photos[0]['is_cover']);

        // prepnutie na prvú zruší cover druhej
        $this->patchJson("/api/v1/photos/{$first->id}/cover")->assertOk();
        $photos = $this->getJson('/api/v1/moments/cover-test')->json('photos');
        $this->assertSame($first->id, $photos[0]['id']);
        $this->assertFalse($photos[1]['is_cover']);
    }

    public function test_locked_capsule_hides_content(): void
    {
        $this->actingAs($this->actingUser());

        Capsule::create([
            'slug' => 'tajna', 'title' => 'Tajná kapsula', 'by' => 'M',
            'created_date' => now()->subDay(), 'unlock_date' => now()->addYear(),
            'has_letter' => true, 'letter' => 'Tajný list, ktorý nesmie uniknúť.',
            'seed' => 'home',
        ]);

        $this->getJson('/api/v1/capsules/tajna')
            ->assertOk()
            ->assertJsonPath('is_unlocked', false)
            ->assertJsonPath('letter', null);

        Capsule::where('slug', 'tajna')->update(['unlock_date' => now()->subDay()]);

        $this->getJson('/api/v1/capsules/tajna')
            ->assertOk()
            ->assertJsonPath('is_unlocked', true)
            ->assertJsonPath('letter', 'Tajný list, ktorý nesmie uniknúť.');
    }

    public function test_events_include_derived_anniversaries_and_custom(): void
    {
        $this->actingAs($this->actingUser());

        \DB::table('settings')->insert([
            'key' => 'together_since', 'value' => now()->subYears(2)->toDateString(),
        ]);

        $this->postJson('/api/v1/events', [
            'title' => 'Výlet do Ríma', 'date' => now()->addMonth()->toDateString(), 'kind' => 'plan',
        ])->assertCreated();

        $events = $this->getJson('/api/v1/events')->assertOk()->json();

        $kinds = array_unique(array_column($events, 'kind'));
        $this->assertContains('anniv', $kinds);
        $this->assertContains('milestone', $kinds);
        $this->assertContains('plan', $kinds);
    }

    public function test_monthly_collage_is_generated_from_moment_photos(): void
    {
        \Storage::fake('public');
        $this->actingAs($this->actingUser());

        $moment = \App\Models\Moment::create([
            'slug' => 'kolaz-test', 'title' => 'Koláž test', 'place' => 'Praha',
            'place_short' => 'Praha', 'date_start' => '2026-03-14', 'date_display' => '14. marec 2026',
            'date_short' => 'mar 2026', 'seed' => 'default',
        ]);

        // Dve skutočné fotky na disku — koláž ich musí vedieť načítať a poskladať.
        foreach ([1, 2] as $i) {
            $img = imagecreatetruecolor(600, 400);
            imagefill($img, 0, 0, imagecolorallocate($img, 40 * $i, 90, 60));
            ob_start();
            imagejpeg($img);
            $bytes = ob_get_clean();

            $path = "photos/moments/kolaz-{$i}.jpg";
            \Storage::disk('public')->put($path, $bytes);
            $moment->photos()->create(['path' => $path, 'kind' => 'image', 'sort_order' => $i]);
        }

        $res = $this->getJson('/api/v1/wrapped/2026-03/collage')->assertOk();
        $this->assertSame(2, $res->json('photos'));
        $this->assertNotNull($res->json('url'), 'koláž sa nevygenerovala');

        // Súbor musí naozaj vzniknúť a mať rozmery story
        $files = \Storage::disk('public')->files('collages');
        $this->assertCount(1, $files);
        [$w, $h] = getimagesizefromstring(\Storage::disk('public')->get($files[0]));
        $this->assertSame([1080, 1920], [$w, $h]);
    }

    public function test_collage_for_unknown_month_is_not_found(): void
    {
        $this->actingAs($this->actingUser());
        $this->getJson('/api/v1/wrapped/1999-01/collage')->assertNotFound();
    }

    public function test_collage_image_from_the_app_is_stored_listed_and_deleted(): void
    {
        \Storage::fake('public');
        $this->actingAs($this->actingUser());

        $res = $this->postJson('/api/v1/collages', [
            'image' => \Illuminate\Http\UploadedFile::fake()->image('kolaz.jpg', 1080, 1080),
            'title' => 'Praha 2026',
            'subtitle' => 'prvý spoločný výlet',
            'layout' => 'grid',
            'format' => 'square',
            'photos_count' => 4,
            'config' => json_encode(['layout' => 'grid', 'bg' => 'sand', 'stickers' => []]),
            'source_type' => 'photos',
        ])->assertCreated();

        $path = $res->json('path');
        $this->assertStringContainsString('collages/', $path);
        $this->assertTrue(\Storage::disk('public')->exists($path), 'obrázok koláže sa neuložil');

        // Nastavenie sa musí vrátiť ako pole, nie ako reťazec — appka z neho
        // vie koláž znova otvoriť na úpravu
        $this->assertSame('sand', $res->json('config.bg'));

        $this->getJson('/api/v1/collages')->assertOk()->assertJsonCount(1);

        $this->deleteJson('/api/v1/collages/'.$res->json('id'))->assertNoContent();
        $this->assertFalse(\Storage::disk('public')->exists($path), 'súbor koláže zostal na disku');
    }

    public function test_collage_can_be_edited_and_the_old_image_is_removed(): void
    {
        \Storage::fake('public');
        $this->actingAs($this->actingUser());

        $first = $this->postJson('/api/v1/collages', [
            'image' => \Illuminate\Http\UploadedFile::fake()->image('a.jpg', 1080, 1080),
            'title' => 'Prvá verzia',
            'layout' => 'grid',
            'format' => 'square',
            'photos_count' => 4,
            'config' => json_encode(['cfg' => ['bg' => 'sand'], 'photos' => [['id' => 1]]]),
            'source_type' => 'photos',
        ])->assertCreated();

        $oldPath = $first->json('path');

        $second = $this->post('/api/v1/collages/'.$first->json('id'), [
            'image' => \Illuminate\Http\UploadedFile::fake()->image('b.jpg', 1080, 1350),
            'title' => 'Upravená',
            'layout' => 'stack',
            'format' => 'portrait',
            'photos_count' => 5,
            'config' => json_encode(['cfg' => ['bg' => 'ink'], 'photos' => [['id' => 2]]]),
            'source_type' => 'photos',
        ], ['Accept' => 'application/json'])->assertOk();

        // Ostáva to tá istá koláž, nevzniká druhá
        $this->assertSame($first->json('id'), $second->json('id'));
        $this->getJson('/api/v1/collages')->assertOk()->assertJsonCount(1);

        $this->assertSame('Upravená', $second->json('title'));
        $this->assertSame('ink', $second->json('config.cfg.bg'));
        $this->assertNotSame($oldPath, $second->json('path'));

        // Starý obrázok už na nič neodkazuje
        $this->assertFalse(\Storage::disk('public')->exists($oldPath), 'starý obrázok zostal na disku');
        $this->assertTrue(\Storage::disk('public')->exists($second->json('path')));
    }

    public function test_collage_without_an_image_is_rejected(): void
    {
        \Storage::fake('public');
        $this->actingAs($this->actingUser());

        $this->postJson('/api/v1/collages', [
            'title' => 'Bez obrázka',
            'layout' => 'grid',
            'format' => 'square',
            'photos_count' => 3,
            'source_type' => 'photos',
        ])->assertStatus(422);
    }

    public function test_gift_goes_to_the_other_user_and_records_being_opened(): void
    {
        \Storage::fake('public');

        $sender = User::factory()->create(['name' => 'S', 'email' => 's@sm.app']);
        $recipient = $this->actingUser();

        $collage = \App\Models\Collage::create([
            'template' => 'grid', 'format' => 'square', 'title' => 'Viedeň',
            'path' => 'collages/x.jpg', 'photos_count' => 3, 'source_type' => 'photos',
        ]);

        $this->actingAs($sender);
        $gift = $this->postJson('/api/v1/gifts', [
            'collage_id' => $collage->id,
            'note' => 'aby si si spomenula',
        ])->assertCreated();

        // Odosielateľ vidí, že darček čaká
        $this->assertTrue($gift->json('sent'));
        $this->assertFalse($gift->json('opened'));
        $this->assertSame('M', $gift->json('to'));

        // Príjemcovi príde ako darček, nie ako odoslaný
        $this->actingAs($recipient);
        $mine = $this->getJson('/api/v1/gifts')->assertOk()->assertJsonCount(1);
        $this->assertFalse($mine->json('0.sent'));
        $this->assertSame('S', $mine->json('0.from'));

        $this->patchJson('/api/v1/gifts/'.$gift->json('id').'/open')
            ->assertOk()
            ->assertJson(['opened' => true]);

        // A odosielateľ to hneď vidí
        $this->actingAs($sender);
        $this->assertTrue($this->getJson('/api/v1/gifts')->json('0.opened'));
    }

    public function test_gift_cannot_be_opened_by_the_sender(): void
    {
        $sender = User::factory()->create(['name' => 'S', 'email' => 's@sm.app']);
        $this->actingUser();

        $collage = \App\Models\Collage::create([
            'template' => 'grid', 'format' => 'square', 'title' => 'Viedeň',
            'path' => 'collages/y.jpg', 'photos_count' => 3, 'source_type' => 'photos',
        ]);

        $this->actingAs($sender);
        $gift = $this->postJson('/api/v1/gifts', ['collage_id' => $collage->id])->assertCreated();

        // Inak by si odosielateľ vlastný darček „otvoril" a druhý by to už nevidel
        $this->patchJson('/api/v1/gifts/'.$gift->json('id').'/open')->assertNotFound();
    }
}
