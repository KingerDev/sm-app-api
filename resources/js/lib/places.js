// Miesta momentu — zrkadlo src/lib/places.ts z natívnej appky.
//
// Novšie momenty majú zoznam `places` (dovolenka cez viac miest), staršie len
// jedno `place`. `place`/`place_short` na momente sú od servera už len zhrnutie.

/** "Viedeň · Rakúsko" → mesto + krajina (pre prepojenie s mapou). */
export function parsePlace(label) {
    const parts = (label || '').split(' · ').map(s => s.trim());
    return parts.length === 2 ? { city: parts[0], country: parts[1] } : { city: '', country: '' };
}

export function momentPlaces(m) {
    if (Array.isArray(m?.places) && m.places.length) {
        return m.places.map(p => ({
            label: p.label,
            short: p.short || p.label,
            city: p.city || undefined,
            country: p.country || undefined,
        }));
    }

    const label = (m?.place || m?.place_short || '').trim();
    if (!label) return [];
    const { city, country } = parsePlace(label);
    return [{ label, short: (m.place_short || label).trim(), city: city || undefined, country: country || undefined }];
}
