// Galéria — časová os s míľnikmi / po mieste (podľa design/hifi-gallery.jsx)
import { cloneElement, useState } from 'react';
import { useStore } from '../store';
import { AppHeader, Icons, Photo, coverSrc } from '../components/shell';
import { MONTHS_SHORT_SK, daysBetween, formatDateSk, parseDate, today } from '../lib/dates';
import { momentPlaces } from '../lib/places';

const momentWord = (n) => n === 1 ? 'moment' : n < 5 ? 'momenty' : 'momentov';
const noteWord = (n) => n === 1 ? 'chvíľka' : n < 5 ? 'chvíľky' : 'chvíľok';

export default function Gallery({ navigate }) {
    const { moments, notes, events, settings } = useStore();
    const [view, setView] = useState('timeline');

    // Časová os: momenty + míľniky (výročia a míľniky dní, ktoré už nastali), zoradené od najnovších
    const pastMilestones = events
        .filter(e => ['anniv', 'milestone'].includes(e.kind) && parseDate(e.date) <= today())
        .map(e => ({
            type: 'milestone',
            date: parseDate(e.date),
            dateLabel: `${MONTHS_SHORT_SK[parseDate(e.date).getMonth()]} ${parseDate(e.date).getFullYear()}`,
            title: e.kind === 'anniv' ? `${e.title} ♡` : e.title,
            sub: e.kind === 'anniv' && settings.together_since
                ? `${daysBetween(settings.together_since, e.date)} dní spolu`
                : e.note || null,
        }));

    const items = [
        ...moments.map(m => ({ type: 'moment', date: parseDate(m.date_start), mom: m })),
        ...notes.map(n => ({ type: 'note', date: parseDate(n.date), note: n })),
        ...pastMilestones,
    ].sort((a, b) => b.date - a.date);

    // Po mieste — momenty aj chvíľky s miestom
    const placeMap = {};
    // Moment cez viac miest patrí pod každé z nich.
    moments.forEach(m => momentPlaces(m).forEach(p => {
        (placeMap[p.short] = placeMap[p.short] || { place: p.label, moms: [], notes: [] }).moms.push(m);
    }));
    notes.filter(n => n.place).forEach(n => {
        const k = n.place_short || n.place;
        (placeMap[k] = placeMap[k] || { place: n.place, moms: [], notes: [] }).notes.push(n);
    });
    const places = Object.entries(placeMap)
        .map(([k, v]) => ({ key: k, place: v.place, moms: v.moms, notes: v.notes }))
        .sort((a, b) => (b.moms.length + b.notes.length) - (a.moms.length + a.notes.length));

    const tabs = [
        { id: 'timeline', label: 'Časová os' },
        { id: 'places', label: 'Po mieste' },
    ];

    const sinceYear = settings.together_since ? parseDate(settings.together_since).getFullYear() : '';

    return (
        <>
            <AppHeader
                eyebrow={`${sinceYear} → dnes`}
                title="naše momenty"
                right={
                    <>
                        <button className="icon-btn" onClick={() => navigate('moment-search')}>{Icons.search}</button>
                        <button className="icon-btn green" onClick={() => navigate('moment-add')}>{Icons.plus}</button>
                    </>
                }
            >
                <div className="row gap-6" style={{ marginTop: 10 }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setView(t.id)}
                            className={'chip' + (view === t.id ? ' green' : '')}
                            style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}>{t.label}</button>
                    ))}
                </div>
            </AppHeader>

            <div className="scroll" key={view}>
                {/* ---- Časová os ---- */}
                {view === 'timeline' && (
                    <div style={{ position: 'relative', paddingLeft: 28 }}>
                        <div style={{
                            position: 'absolute', left: 7, top: 12, bottom: 12, width: 1.5,
                            background: 'linear-gradient(var(--green-line), var(--line) 90%)',
                        }} />
                        <div className="col gap-20">
                            {items.map((it, i) => (
                                <div key={i} style={{ position: 'relative' }}>
                                    <div style={{
                                        position: 'absolute', left: it.type === 'note' ? -27 : -28, top: it.type === 'note' ? 11 : 10,
                                        width: it.type === 'note' ? 15 : 17, height: it.type === 'note' ? 15 : 17, borderRadius: '50%',
                                        background: it.type === 'milestone' ? 'var(--green)' : it.type === 'note' ? 'var(--green-soft)' : 'var(--surface)',
                                        border: '1.5px solid var(--green)',
                                        boxShadow: '0 0 0 4px var(--paper)',
                                        display: 'grid', placeItems: 'center',
                                        color: it.type === 'note' ? 'var(--green)' : 'var(--paper)',
                                        fontSize: it.type === 'note' ? 8 : 9,
                                    }}>
                                        {it.type === 'milestone' && '♥'}
                                        {it.type === 'note' && '✎'}
                                    </div>

                                    {it.type === 'note' ? (
                                        <button onClick={() => navigate('momentka:' + it.note.id)} style={{
                                            display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
                                            cursor: 'pointer', border: 'none',
                                            background: 'var(--green-soft)', borderRadius: 14, padding: 11,
                                        }}>
                                            {it.note.photo_thumb_url && (
                                                <Photo url={it.note.photo_thumb_url} style={{ width: 76, height: 76, borderRadius: 10, flexShrink: 0 }} />
                                            )}
                                            <div className="col" style={{ gap: 6, minWidth: 0 }}>
                                                <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)' }}>{it.note.text}</div>
                                                <div className="eyebrow" style={{ color: 'var(--green)' }}>
                                                    {it.note.date_short} · {it.note.who}{it.note.place ? ` · 📍 ${it.note.place_short || it.note.place}` : ''} · chvíľka
                                                </div>
                                            </div>
                                        </button>
                                    ) : it.type === 'milestone' ? (
                                        <div className="card tint" style={{ padding: 14 }}>
                                            <div className="eyebrow" style={{ color: 'var(--green)' }}>{it.dateLabel} · míľnik</div>
                                            <div className="serif" style={{ fontSize: 24, fontWeight: 600, color: 'var(--green-deep)', marginTop: 2 }}>
                                                {it.title}
                                            </div>
                                            {it.sub && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>{it.sub}</div>}
                                        </div>
                                    ) : (
                                        <button className="card flush" style={{
                                            width: '100%', padding: 0, textAlign: 'left',
                                            border: '0.5px solid var(--line)', cursor: 'pointer',
                                            background: 'var(--surface)', font: 'inherit', color: 'inherit',
                                        }} onClick={() => navigate('moment:' + it.mom.slug)}>
                                            <Photo seed={it.mom.seed} url={coverSrc(it.mom)} style={{ height: 170, borderRadius: 0 }} />
                                            <div className="col gap-6" style={{ padding: 14 }}>
                                                <div className="row between">
                                                    <div className="eyebrow">{it.mom.date_short} · 📍 {it.mom.place_short}</div>
                                                    <div className="row gap-6" style={{ color: 'var(--muted)' }}>
                                                        <span style={{ fontSize: 11 }}>{it.mom.photos?.length || it.mom.photos_count} fotiek</span>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 16, fontWeight: 500 }}>{it.mom.title}</div>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            ))}

                            {/* Začiatok */}
                            {settings.together_since && (
                                <div style={{ position: 'relative' }}>
                                    <div style={{
                                        position: 'absolute', left: -28, top: 6,
                                        width: 17, height: 17, borderRadius: '50%',
                                        background: 'var(--green)', border: '1.5px solid var(--green)',
                                        boxShadow: '0 0 0 4px var(--paper)',
                                        color: 'var(--paper)', fontSize: 10, display: 'grid', placeItems: 'center',
                                    }}>♥</div>
                                    <div className="col gap-2" style={{ padding: '4px 0' }}>
                                        <div className="eyebrow" style={{ color: 'var(--green)' }}>{formatDateSk(settings.together_since)}</div>
                                        <div className="handwritten" style={{ fontSize: 22, color: 'var(--green-deep)' }}>
                                            začiatok všetkého ♡
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ---- Po mieste ---- */}
                {view === 'places' && (
                    <div className="col" style={{ gap: 26 }}>
                        <button className="card tint" onClick={() => navigate('map')} style={{
                            width: '100%', padding: 14, cursor: 'pointer', textAlign: 'left',
                            border: 'none', font: 'inherit', color: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 12,
                        }}>
                            <span style={{
                                width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                                background: 'var(--green)', color: 'var(--paper)',
                                display: 'grid', placeItems: 'center',
                            }}>{cloneElement(Icons.map, { style: { width: 20, height: 20 } })}</span>
                            <div className="col grow">
                                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--green-deep)' }}>Zobraziť na mape</div>
                                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{places.length} miest · celá cesta</div>
                            </div>
                            <span style={{ color: 'var(--green)' }}>{cloneElement(Icons.arrow, { style: { width: 18, height: 18 } })}</span>
                        </button>

                        {places.map(p => (
                            <div key={p.key} className="col" style={{ gap: 10 }}>
                                <div className="row gap-6" style={{ alignItems: 'center' }}>
                                    <span style={{ color: 'var(--green)' }}>
                                        {cloneElement(Icons.pin, { style: { width: 16, height: 16 } })}
                                    </span>
                                    <div style={{ fontSize: 14.5, fontWeight: 500 }}>{p.place}</div>
                                    <div className="grow" />
                                    <span className="eyebrow">
                                        {[
                                            p.moms.length > 0 && `${p.moms.length} ${momentWord(p.moms.length)}`,
                                            p.notes.length > 0 && `${p.notes.length} ${noteWord(p.notes.length)}`,
                                        ].filter(Boolean).join(' · ')}
                                    </span>
                                </div>
                                <div style={{ margin: '0 -20px', overflowX: 'auto', paddingLeft: 20 }}>
                                    <div className="row gap-8" style={{ width: 'max-content', paddingRight: 20, alignItems: 'stretch' }}>
                                        {p.moms.map(m => (
                                            <button key={m.id} className="card flush" onClick={() => navigate('moment:' + m.slug)}
                                                style={{
                                                    padding: 0, cursor: 'pointer', overflow: 'hidden', width: 150,
                                                    border: '0.5px solid var(--line)', background: 'var(--surface)',
                                                    font: 'inherit', color: 'inherit', textAlign: 'left', flexShrink: 0,
                                                    display: 'flex', flexDirection: 'column',
                                                }}>
                                                <Photo seed={m.seed} url={coverSrc(m)} style={{ width: 150, height: 100, borderRadius: 0, flexShrink: 0 }} />
                                                {/* rovnaká výška kariet: názov max 2 riadky, dátum pripnutý dole */}
                                                <div className="col" style={{ gap: 4, padding: '8px 10px 10px', flex: 1, justifyContent: 'space-between' }}>
                                                    <div style={{
                                                        fontSize: 12.5, fontWeight: 500, lineHeight: 1.25,
                                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                                    }}>{m.title}</div>
                                                    <div className="eyebrow" style={{ textTransform: 'none', letterSpacing: 0 }}>
                                                        {m.date_short} · {m.photos?.length || m.photos_count} fotiek
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                        {/* Chvíľky z tohto miesta */}
                                        {p.notes.map(n => (
                                            <button key={'n' + n.id} onClick={() => navigate('momentka:' + n.id)}
                                                style={{
                                                    width: 150, flexShrink: 0, cursor: 'pointer', overflow: 'hidden',
                                                    borderRadius: 'var(--r-md)', background: 'var(--green-soft)',
                                                    border: 'none', font: 'inherit', color: 'inherit', textAlign: 'left',
                                                    display: 'flex', flexDirection: 'column', padding: 0,
                                                }}>
                                                {n.photo_thumb_url && (
                                                    <Photo url={n.photo_thumb_url} style={{ width: 150, height: 100, borderRadius: 0, flexShrink: 0 }} />
                                                )}
                                                <div className="col" style={{ gap: 4, padding: '8px 10px 10px', flex: 1, justifyContent: 'space-between' }}>
                                                    <div style={{
                                                        fontSize: 12.5, lineHeight: 1.35,
                                                        display: '-webkit-box', WebkitLineClamp: n.photo_thumb_url ? 2 : 4,
                                                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                                    }}>{n.text}</div>
                                                    <div className="eyebrow" style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--green)' }}>
                                                        {n.date_short} · ✎ chvíľka
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
