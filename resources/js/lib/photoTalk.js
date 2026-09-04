// Nové správy v rozhovoroch pod fotkami — zrkadlo src/lib/photoTalk.ts
// a src/lib/talkSeen.ts z natívnej appky.
//
// Značka „prečítané" je v prehliadači, nie na serveri: je to informácia
// o tomto zariadení. Keby bola na serveri, otvorenie fotky na mobile by
// označilo správu za prečítanú aj tu.

const KEY = 'sm_photo_talk_seen';

export function loadSeen() {
    try {
        return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
        // Poškodený záznam znamená len to, že sa všetko ukáže ako neprečítané
        return {};
    }
}

export function markSeen(photoId, commentId) {
    const seen = loadSeen();
    if ((seen[String(photoId)] ?? 0) >= commentId) return seen;

    const next = { ...seen, [String(photoId)]: commentId };
    try {
        localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
        // Neuložená značka je drobnosť — správa sa len ukáže ako nová znova
    }

    return next;
}

/** Id poslednej správy pri fotke. */
export const lastCommentId = (photo) =>
    (photo?.comments ?? []).reduce((max, c) => Math.max(max, c.id), 0);

/**
 * Neprečítané správy od toho druhého, po fotkách a od najnovšej.
 * Bez `me` sa nevracia nič, aby appka neukázala ako nové aj vlastné správy.
 */
export function unreadTalk(moments, me, seen = {}) {
    if (!me) return [];

    const out = [];

    for (const moment of moments ?? []) {
        for (const photo of moment.photos ?? []) {
            const fresh = (photo.comments ?? []).filter(
                c => c.who !== me && c.id > (seen[String(photo.id)] ?? 0)
            );
            if (!fresh.length) continue;

            out.push({
                momentSlug: moment.slug,
                momentTitle: moment.title,
                photoId: photo.id,
                thumb: photo.thumb_url || photo.url,
                comment: fresh[fresh.length - 1],
                count: fresh.length,
            });
        }
    }

    return out.sort((a, b) => b.comment.id - a.comment.id);
}

export const spravySk = n => (n === 1 ? 'nová správa' : n < 5 ? 'nové správy' : 'nových správ');
export const dalsieSk = n => (n === 1 ? 'ďalšia' : n < 5 ? 'ďalšie' : 'ďalších');
