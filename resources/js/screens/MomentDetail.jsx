// Detail momentu — hero, pripnuté, mriežka fotiek, menu (podľa design/hifi-moment.jsx)
import { cloneElement, useRef, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { Icons, Photo, Sheet, coverSrc, photoUrl } from '../components/shell';
import Lightbox from '../components/Lightbox';
import PhotoEditor from '../components/PhotoEditor';
import CoverPicker from '../components/CoverPicker';

export default function MomentDetail({ slug, onBack, navigate }) {
    const { moments, refresh } = useStore();
    const [sheet, setSheet] = useState(null); // 'menu' | 'all'
    const [lightbox, setLightbox] = useState(null); // index otvorenej fotky
    const [progress, setProgress] = useState(null); // { done, total } počas nahrávania
    const uploading = progress !== null;
    const [pending, setPending] = useState([]); // { file, url } — vybrané, ešte nenahraté
    const [editIndex, setEditIndex] = useState(null);
    const [coverEdit, setCoverEdit] = useState(null); // { photo, file } — výber výrezu titulnej
    const [error, setError] = useState(null);
    const fileRef = useRef(null);

    const m = moments.find(mm => mm.slug === slug);
    if (!m) return null;

    // Fotky: reálne z API, inak placeholdre podľa seed (nedajú sa pripnúť/mazať)
    const real = (m.photos || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const hasReal = real.length > 0;
    const items = hasReal
        ? real.map(p => ({ id: p.id, url: p.url, thumb: p.thumb_url || p.url, pinned: !!p.is_pinned, cover: !!p.is_cover, real: true, isVideo: !!p.is_video, caption: p.caption ?? null }))
        : Array.from({ length: Math.min(m.photos_count || 0, 12) }).map((_, i) => ({
            id: `ph-${i}`, url: photoUrl({ seed: m.seed, index: i }), pinned: false, real: false,
        }));
    const pinnedItems = hasReal ? items.filter(p => p.pinned) : [];
    const pinnedCount = hasReal ? pinnedItems.length : (m.pinned_count || 0);
    const photosCount = hasReal ? items.length : (m.photos_count || 0);
    // photos[0] z API je vždy cover (radené is_cover prvé) — real je preradené podľa sort_order
    const cover = hasReal ? coverSrc(m, { full: true }) : null;

    const wrap = (fn) => async (...args) => {
        setError(null);
        try { await fn(...args); } catch (e) { setError(e.message || 'Akcia zlyhala.'); }
    };

    const togglePin = wrap(async (photo) => {
        if (!photo.real) return;
        await api.patch(`/photos/${photo.id}/pin`);
        await refresh('moments', 'stats');
    });

    // Titulná fotka: najskôr otvor editor na výber výrezu (v kartách je obrázok menší),
    // až po potvrdení sa výrez nahrá a fotka nastaví ako cover
    const setCover = wrap(async (photo) => {
        if (!photo.real) return;
        const blob = await (await fetch(photo.url)).blob();
        const file = new File([blob], `titulna-${photo.id}.jpg`, { type: blob.type || 'image/jpeg' });
        setLightbox(null);
        setCoverEdit({ photo, file });
    });

    const saveCover = wrap(async (photo, edited) => {
        const fd = new FormData();
        fd.append('file', edited);
        await api.post(`/photos/${photo.id}/cover`, fd);
        await refresh('moments');
    });

    // Popisok fotky. Chyba sa nechytá do `wrap` — Lightbox ju potrebuje vidieť,
    // aby vedel, že text neuložil a nesmie panel zavrieť.
    const setCaption = async (photo, caption) => {
        if (!photo.real) return;
        await api.patch(`/photos/${photo.id}`, { caption });
        await refresh('moments');
    };

    const deletePhoto = wrap(async (photo) => {
        if (!photo.real) return;
        if (!confirm('Naozaj vymazať túto fotku?')) return;
        await api.delete(`/photos/${photo.id}`);
        await refresh('moments', 'stats');
    });

    const confirmUpload = async () => {
        const files = pending.map(p => p.file);
        pending.forEach(p => URL.revokeObjectURL(p.url));
        setPending([]);
        await upload(files);
    };

    const upload = async (files) => {
        if (!files.length) return;
        setError(null);
        setProgress({ done: 0, total: files.length });
        let failed = 0;
        // po jednej — vidno priebeh a nenarazíme na PHP limity pri desiatkach fotiek
        for (let i = 0; i < files.length; i++) {
            try {
                const fd = new FormData();
                fd.append('type', 'moment');
                fd.append('id', m.id);
                fd.append('files[]', files[i]);
                await api.post('/photos', fd);
            } catch {
                failed++;
            }
            setProgress({ done: i + 1, total: files.length });
        }
        if (failed) setError(`${failed} ${failed === 1 ? 'fotka sa nenahrala' : 'fotky sa nenahrali'} — skús znova.`);
        await refresh('moments', 'stats');
        setProgress(null);
    };

    const share = async () => {
        const text = `${m.title} — ${m.place} (${m.date_display})`;
        try {
            if (navigator.share) await navigator.share({ title: m.title, text });
            else await navigator.clipboard.writeText(text);
        } catch { /* zrušené používateľom */ }
        setSheet(null);
    };

    const deleteMoment = async () => {
        if (!confirm('Naozaj vymazať tento moment aj so všetkými fotkami?')) return;
        setError(null);
        try {
            await api.delete(`/moments/${slug}`);
            await refresh('moments', 'stats');
            onBack();
        } catch (e) {
            setSheet(null);
            setError(e.message || 'Vymazanie zlyhalo.');
        }
    };

    return (
        <>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={(e) => {
                    const picked = Array.from(e.target.files || []).map(f => ({ file: f, url: URL.createObjectURL(f) }));
                    if (picked.length) setPending(prev => [...prev, ...picked]);
                    e.target.value = '';
                }} />

            {/* Plávajúca hlavička nad hero fotkou */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0,
                padding: '12px 16px 8px',
                display: 'flex', justifyContent: 'space-between',
                zIndex: 10,
                pointerEvents: 'none',
            }}>
                <button className="icon-btn" style={{
                    pointerEvents: 'auto',
                    background: 'rgba(250, 250, 247, 0.9)',
                    backdropFilter: 'blur(8px)',
                }} onClick={onBack}>{Icons.back}</button>
                <div className="row gap-8" style={{ pointerEvents: 'auto' }}>
                    <button className="icon-btn" style={{
                        background: 'rgba(250, 250, 247, 0.9)', backdropFilter: 'blur(8px)',
                    }} onClick={() => setSheet('menu')}>{Icons.more}</button>
                </div>
            </div>

            <div className="scroll no-pad-top" style={{ paddingTop: 0 }}>
                {/* Hero fotka */}
                <div style={{ margin: '0 -20px 0', position: 'relative' }}>
                    <Photo seed={m.seed} url={cover} style={{ height: 320, borderRadius: 0, cursor: hasReal ? 'pointer' : 'default' }}
                        onClick={() => hasReal && setLightbox(0)} />
                    <div style={{
                        position: 'absolute', inset: 'auto 0 0 0',
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.45))',
                        padding: '60px 20px 16px',
                    }}>
                        <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            {m.date_display} · 📍 {m.place}
                        </div>
                        <div className="serif" style={{
                            color: 'var(--paper)', fontSize: 36, fontWeight: 600, marginTop: 4,
                            lineHeight: 1,
                        }}>{m.title}</div>
                    </div>
                </div>

                <div style={{ padding: '18px 0' }}>
                    <div className="row gap-6 wrap" style={{ marginTop: 4 }}>
                        <span className="chip">pridal/a {m.who}</span>
                    </div>

                    {/* Popis */}
                    {m.description && (
                        <div style={{
                            marginTop: 16,
                            paddingLeft: 14,
                            borderLeft: '2px solid var(--green)',
                        }}>
                            <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--ink-soft)' }}>
                                {m.description}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--accent)', textAlign: 'center' }}>{error}</div>
                    )}

                    {/* Pripnuté obľúbené */}
                    {pinnedCount > 0 && (
                        <>
                            <div className="row between" style={{ margin: '24px 0 10px' }}>
                                <div className="handwritten" style={{ fontSize: 22 }}>
                                    ♡ pripnuté ({pinnedCount})
                                </div>
                                <span className="eyebrow">obľúbené</span>
                            </div>
                            <div style={{ margin: '0 -20px', overflowX: 'auto', paddingLeft: 20 }}>
                                <div className="row gap-8" style={{ width: 'max-content', paddingRight: 20 }}>
                                    {hasReal
                                        ? pinnedItems.map(p => (
                                            <Photo key={p.id} url={p.thumb || p.url}
                                                onClick={() => setLightbox(items.findIndex(it => it.id === p.id))}
                                                style={{ width: 180, height: 230, borderRadius: 14, flexShrink: 0, cursor: 'pointer' }}>
                                                <PhotoHeart pinned onClick={(e) => { e.stopPropagation(); togglePin(p); }} />
                                            </Photo>
                                        ))
                                        : Array.from({ length: pinnedCount }).map((_, i) => (
                                            <Photo key={i} seed={`${m.seed}-pin-${i}`}
                                                style={{ width: 180, height: 230, borderRadius: 14, flexShrink: 0 }} />
                                        ))}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Mriežka všetkých fotiek */}
                    <div className="row between" style={{ margin: '24px 0 10px' }}>
                        <div className="handwritten" style={{ fontSize: 22 }}>
                            všetky fotky · {photosCount}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                        {items.slice(0, 9).map((p, i) => (
                            <Photo key={p.id} url={p.thumb || p.url}
                                onClick={() => setLightbox(i)}
                                style={{ aspectRatio: '1', borderRadius: 4, cursor: 'pointer' }}>
                                {p.real && <PhotoHeart pinned={p.pinned} onClick={(e) => { e.stopPropagation(); togglePin(p); }} />}
                                {p.caption && <PhotoNote />}
                            </Photo>
                        ))}
                    </div>
                    {photosCount > 0 && (
                        <button className="btn ghost" onClick={() => setSheet('all')} style={{
                            width: '100%', marginTop: 10, justifyContent: 'center',
                            color: 'var(--green)', borderColor: 'var(--green-line)',
                            background: 'var(--green-soft)',
                        }}>
                            zobraziť všetkých {photosCount} fotiek
                        </button>
                    )}

                    {/* Pridať fotku CTA */}
                    <div className="card tint" style={{ marginTop: 16, padding: 14 }}>
                        <div className="row between">
                            <div className="col gap-2 grow">
                                <div className="eyebrow" style={{ color: 'var(--green)' }}>k tomuto momentu</div>
                                <div style={{ fontSize: 14, fontWeight: 500 }}>
                                    {uploading ? `nahrávam ${progress.done} / ${progress.total}` : 'Pridať ďalšiu fotku'}
                                </div>
                                {uploading && (
                                    <div style={{ height: 5, borderRadius: 3, background: 'var(--green-line)', overflow: 'hidden', marginTop: 6 }}>
                                        <div style={{
                                            width: `${Math.round(progress.done / progress.total * 100)}%`,
                                            height: '100%', background: 'var(--green)',
                                            transition: 'width 300ms ease',
                                        }} />
                                    </div>
                                )}
                            </div>
                            <button className="icon-btn green" disabled={uploading}
                                style={{ opacity: uploading ? 0.45 : 1 }}
                                onClick={() => fileRef.current?.click()}>{Icons.plus}</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ---- Náhľad pred nahratím (s editorom) ---- */}
            {pending.length > 0 && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 40, background: 'var(--paper)',
                    display: 'flex', flexDirection: 'column', animation: 'slideUp 260ms ease both',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '16px 16px 12px', borderBottom: '0.5px solid var(--line)',
                    }}>
                        <button className="icon-btn" onClick={() => {
                            pending.forEach(p => URL.revokeObjectURL(p.url));
                            setPending([]);
                        }} style={{ flexShrink: 0 }}>{Icons.close}</button>
                        <div className="col grow" style={{ minWidth: 0 }}>
                            <div className="eyebrow">pred nahratím</div>
                            <div style={{ fontSize: 16, fontWeight: 500 }}>
                                {pending.length} {pending.length === 1 ? 'fotka' : pending.length < 5 ? 'fotky' : 'fotiek'}
                            </div>
                        </div>
                        <button className="icon-btn" onClick={() => fileRef.current?.click()} style={{ flexShrink: 0 }}>
                            {Icons.plus}
                        </button>
                    </div>
                    <div className="scroll" style={{ flex: 1, padding: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                            {pending.map((p, i) => (
                                <div key={p.url} style={{ position: 'relative' }}>
                                    <Photo url={p.url} onClick={() => setEditIndex(i)}
                                        style={{ aspectRatio: '1', borderRadius: 10, cursor: 'pointer' }} />
                                    <button onClick={() => {
                                        URL.revokeObjectURL(p.url);
                                        setPending(pending.filter((_, j) => j !== i));
                                    }} style={{
                                        position: 'absolute', top: 6, right: 6, width: 24, height: 24,
                                        borderRadius: '50%', border: 'none', cursor: 'pointer',
                                        background: 'rgba(20,30,22,0.55)', color: 'var(--paper)',
                                        display: 'grid', placeItems: 'center', padding: 0,
                                    }}>{cloneElement(Icons.close, { style: { width: 12, height: 12 } })}</button>
                                    <button onClick={() => setEditIndex(i)} style={{
                                        position: 'absolute', bottom: 6, right: 6, width: 24, height: 24,
                                        borderRadius: '50%', border: 'none', cursor: 'pointer',
                                        background: 'rgba(20,30,22,0.55)', color: 'var(--paper)',
                                        display: 'grid', placeItems: 'center', padding: 0,
                                    }}>{cloneElement(Icons.edit, { style: { width: 12, height: 12 } })}</button>
                                </div>
                            ))}
                        </div>
                        <div className="handwritten" style={{ textAlign: 'center', marginTop: 14, fontSize: 16, color: 'var(--muted)' }}>
                            ťukni fotku pre orez a otočenie ✂
                        </div>
                    </div>
                    <div style={{
                        padding: '14px 16px calc(14px + var(--safe-bottom))',
                        borderTop: '0.5px solid var(--line)', background: 'var(--paper)',
                    }}>
                        <button className="btn primary" onClick={confirmUpload}
                            style={{ width: '100%', padding: 15, fontSize: 15 }}>
                            nahrať {pending.length === 1 ? 'fotku' : pending.length < 5 ? `${pending.length} fotky` : `${pending.length} fotiek`}
                        </button>
                    </div>

                    {editIndex !== null && pending[editIndex] && (
                        <PhotoEditor
                            file={pending[editIndex].file}
                            onCancel={() => setEditIndex(null)}
                            onSave={(edited) => {
                                URL.revokeObjectURL(pending[editIndex].url);
                                setPending(pending.map((p, j) => j === editIndex
                                    ? { file: edited, url: URL.createObjectURL(edited) }
                                    : p));
                                setEditIndex(null);
                            }}
                        />
                    )}
                </div>
            )}

            {/* ---- Výber výrezu titulnej fotky — živý náhľad karty ---- */}
            {coverEdit && (
                <CoverPicker
                    file={coverEdit.file}
                    eyebrow={`${m.date_short} · ${m.place_short}`}
                    title={m.title}
                    onCancel={() => setCoverEdit(null)}
                    onSave={(edited) => {
                        const { photo } = coverEdit;
                        setCoverEdit(null);
                        saveCover(photo, edited);
                    }}
                />
            )}

            {/* ---- Lightbox ---- */}
            {lightbox !== null && (
                <Lightbox
                    items={items}
                    index={lightbox}
                    onClose={() => setLightbox(null)}
                    onTogglePin={togglePin}
                    onDelete={deletePhoto}
                    onSetCover={setCover}
                    onSetCaption={setCaption}
                />
            )}

            {/* ---- Menu (tri bodky) ---- */}
            {sheet === 'menu' && (
                <MomentMenu m={m} cover={cover} photosCount={photosCount}
                    onClose={() => setSheet(null)}
                    onShare={share}
                    onEdit={() => { setSheet(null); navigate('moment-edit:' + slug); }}
                    onDelete={deleteMoment} />
            )}

            {/* ---- Všetky fotky (fullscreen) ---- */}
            {sheet === 'all' && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 30, background: 'var(--paper)',
                    display: 'flex', flexDirection: 'column', animation: 'slideUp 300ms ease both',
                }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '16px 16px 12px', borderBottom: '0.5px solid var(--line)',
                    }}>
                        <button className="icon-btn" onClick={() => setSheet(null)} style={{ flexShrink: 0 }}>{Icons.back}</button>
                        <div className="col grow" style={{ minWidth: 0 }}>
                            <div className="eyebrow">{m.title}</div>
                            <div style={{ fontSize: 16, fontWeight: 500 }}>
                                {uploading ? `nahrávam ${progress.done} / ${progress.total}` : `všetky fotky · ${photosCount}`}
                            </div>
                            {uploading && (
                                <div style={{ height: 4, borderRadius: 2, background: 'var(--green-line)', overflow: 'hidden', marginTop: 5 }}>
                                    <div style={{
                                        width: `${Math.round(progress.done / progress.total * 100)}%`,
                                        height: '100%', background: 'var(--green)',
                                        transition: 'width 300ms ease',
                                    }} />
                                </div>
                            )}
                        </div>
                        <button className="icon-btn green" disabled={uploading} style={{ flexShrink: 0, opacity: uploading ? 0.45 : 1 }}
                            onClick={() => fileRef.current?.click()}>{Icons.plus}</button>
                    </div>
                    <div className="scroll" style={{ flex: 1, padding: 3 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                            {items.map((p, i) => (
                                <Photo key={p.id} url={p.thumb || p.url} seed={`${m.seed}`} index={i}
                                    onClick={() => setLightbox(i)}
                                    style={{ aspectRatio: '1', borderRadius: 3, cursor: 'pointer' }}>
                                    {p.real ? (
                                        <>
                                            <PhotoHeart pinned={p.pinned} onClick={(e) => { e.stopPropagation(); togglePin(p); }} />
                                            <button onClick={(e) => { e.stopPropagation(); deletePhoto(p); }} style={{
                                                position: 'absolute', top: 5, left: 5,
                                                background: 'rgba(20,30,22,0.35)', border: 'none', cursor: 'pointer',
                                                borderRadius: '50%', width: 26, height: 26,
                                                display: 'grid', placeItems: 'center', color: 'var(--paper)',
                                            }}>{cloneElement(Icons.trash, { style: { width: 14, height: 14 } })}</button>
                                            {p.caption && <PhotoNote />}
                                        </>
                                    ) : (
                                        i < pinnedCount && (
                                            <div style={{
                                                position: 'absolute', top: 5, right: 5, color: 'var(--paper)',
                                                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
                                            }}>{cloneElement(Icons.heartFill, { style: { width: 15, height: 15 } })}</div>
                                        )
                                    )}
                                </Photo>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/*
 * Značka, že fotka má svoj popisok. Bez nej by sa o popiskoch nedalo dozvedieť
 * inak než otvorením každej fotky zvlášť.
 */
const PhotoNote = () => (
    <div style={{
        position: 'absolute', bottom: 5, left: 5,
        background: 'rgba(20,30,22,0.45)', borderRadius: '50%',
        width: 20, height: 20, display: 'grid', placeItems: 'center',
        color: 'var(--paper)',
    }}>
        {cloneElement(Icons.edit, { style: { width: 11, height: 11 } })}
    </div>
);

/* Srdiečko na fotke — prepnutie pripnutia */
const PhotoHeart = ({ pinned, onClick }) => (
    <button onClick={onClick} style={{
        position: 'absolute', top: 5, right: 5,
        background: 'rgba(20,30,22,0.35)', border: 'none', cursor: 'pointer',
        borderRadius: '50%', width: 26, height: 26,
        display: 'grid', placeItems: 'center',
        color: 'var(--paper)',
    }}>
        {cloneElement(pinned ? Icons.heartFill : Icons.heart, { style: { width: 15, height: 15 } })}
    </button>
);

/* ---- Menu momentu (bottom sheet) ---- */
const MomentMenu = ({ m, cover, photosCount, onClose, onShare, onEdit, onDelete }) => {
    const rowStyle = {
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 4px', width: '100%', textAlign: 'left',
        background: 'none', border: 'none', font: 'inherit', cursor: 'pointer',
        color: 'var(--ink)', fontSize: 15,
    };
    const ic = (icon, color) => (
        <span style={{ color: color || 'var(--muted)', display: 'grid', placeItems: 'center', width: 22 }}>
            {cloneElement(icon, { style: { width: 20, height: 20 } })}
        </span>
    );
    return (
        <Sheet onClose={onClose}>
            <div className="row gap-10" style={{ alignItems: 'center', paddingBottom: 12 }}>
                <Photo seed={m.seed} url={cover} style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0 }} />
                <div className="col" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{m.title}</div>
                    <div className="eyebrow" style={{ textTransform: 'none', letterSpacing: 0 }}>
                        {m.date_short} · {photosCount} fotiek
                    </div>
                </div>
            </div>
            <div className="divider" />
            <button style={rowStyle} onClick={onShare}>{ic(Icons.share)}Zdieľať moment</button>
            <button style={rowStyle} onClick={onEdit}>{ic(Icons.edit)}Upraviť detaily</button>
            <div className="divider" />
            <button style={{ ...rowStyle, color: '#b0402a' }} onClick={onDelete}>
                {ic(Icons.trash, '#b0402a')}Vymazať moment
            </button>
        </Sheet>
    );
};
