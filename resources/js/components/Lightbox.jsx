// Lightbox — fullscreen prehliadač fotiek s listovaním (šípky, swipe, klávesnica)
import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from './shell';

/**
 * Koľko sa zmestí do popisku fotky. Nie je to šetrenie miestom — popisok sa
 * kreslí do koláží, ktoré majú na text pevné okienko, tak sa dĺžka stráži na
 * vstupe. Rovnaké číslo má server vo validácii aj natívna appka.
 */
export const CAPTION_MAX = 160;

export default function Lightbox({ items, index, onClose, onTogglePin, onDelete, onSetCover, onSetCaption }) {
    const [i, setI] = useState(index ?? 0);
    const [draft, setDraft] = useState(null);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const touchX = useRef(null);
    const editing = draft !== null;

    const prev = useCallback(() => setI(v => (v - 1 + items.length) % items.length), [items.length]);
    const next = useCallback(() => setI(v => (v + 1) % items.length), [items.length]);

    useEffect(() => {
        const onKey = (e) => {
            // Počas písania popisku patria šípky aj Escape textovému poľu
            if (editing) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, prev, next, editing]);

    // Keď sa zmaže posledná fotka, zavri; inak drž index v rozsahu
    useEffect(() => {
        if (!items.length) onClose();
        else if (i > items.length - 1) setI(items.length - 1);
    }, [items.length, i, onClose]);

    const photo = items[Math.min(i, items.length - 1)];
    if (!photo) return null;

    const saveCaption = async () => {
        if (draft === null || !onSetCaption) return;
        setSaving(true);
        setFailed(false);
        try {
            await onSetCaption(photo, draft.trim());
            setDraft(null);
        } catch {
            setFailed(true);
        } finally {
            setSaving(false);
        }
    };

    const navBtn = (side, onClick, icon) => (
        <button onClick={onClick} style={{
            position: 'absolute', [side]: 8, top: '50%', transform: 'translateY(-50%)',
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(250,250,247,0.12)', border: 'none', cursor: 'pointer',
            display: 'grid', placeItems: 'center', color: 'var(--paper)',
            backdropFilter: 'blur(6px)', zIndex: 2,
        }}>{cloneElement(icon, { style: { width: 20, height: 20 } })}</button>
    );

    return (
        <div
            style={{
                position: 'absolute', inset: 0, zIndex: 60,
                background: 'rgba(12, 16, 13, 0.96)',
                display: 'flex', flexDirection: 'column',
                animation: 'fadeIn 180ms ease both',
            }}
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
                if (touchX.current === null || editing) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                touchX.current = null;
                if (Math.abs(dx) > 40) (dx > 0 ? prev() : next());
            }}
        >
            {/* Horná lišta */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', zIndex: 2,
            }}>
                <span className="mono" style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                    {i + 1} / {items.length}
                </span>
                <div className="row gap-8">
                    {photo.real && onSetCaption && !photo.isVideo && (
                        <button className="icon-btn" style={{ ...lbBtn, ...(photo.caption ? { background: 'var(--green)' } : null) }}
                            title={photo.caption ? 'upraviť popisok' : 'pridať popisok'}
                            onClick={() => { setFailed(false); setDraft(photo.caption ?? ''); }}>
                            {cloneElement(Icons.edit, { style: { width: 17, height: 17 } })}
                        </button>
                    )}
                    {photo.real && onSetCover && (
                        photo.cover ? (
                            <button onClick={() => onSetCover(photo)} title="upraviť výrez titulnej" style={{
                                border: 'none', cursor: 'pointer', font: 'inherit',
                                alignSelf: 'center', fontSize: 10.5, letterSpacing: 1,
                                textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)',
                                background: 'rgba(250,250,247,0.14)', padding: '6px 10px',
                                borderRadius: 999, backdropFilter: 'blur(6px)',
                            }}>titulná ✓ · výrez</button>
                        ) : (
                            <button onClick={() => onSetCover(photo)} style={{
                                border: 'none', cursor: 'pointer', font: 'inherit',
                                fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase',
                                color: 'var(--paper)', background: 'rgba(250,250,247,0.14)',
                                padding: '6px 10px', borderRadius: 999, backdropFilter: 'blur(6px)',
                            }}>nastaviť ako titulnú</button>
                        )
                    )}
                    {photo.real && onTogglePin && (
                        <button className="icon-btn" style={lbBtn} onClick={() => onTogglePin(photo)}>
                            {cloneElement(photo.pinned ? Icons.heartFill : Icons.heart, { style: { width: 18, height: 18 } })}
                        </button>
                    )}
                    {photo.real && onDelete && (
                        <button className="icon-btn" style={lbBtn} onClick={() => onDelete(photo)}>
                            {cloneElement(Icons.trash, { style: { width: 18, height: 18 } })}
                        </button>
                    )}
                    <button className="icon-btn" style={lbBtn} onClick={onClose}>{Icons.close}</button>
                </div>
            </div>

            {/* Fotka */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'grid', placeItems: 'center' }}
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <img src={photo.url} alt=""
                    style={{
                        maxWidth: '100%', maxHeight: '100%',
                        objectFit: 'contain', userSelect: 'none',
                        animation: 'fadeIn 160ms ease both',
                    }}
                    key={photo.id}
                    draggable={false} />
                {items.length > 1 && navBtn('left', prev, Icons.back)}
                {items.length > 1 && navBtn('right', next, Icons.arrow)}
            </div>

            {/* Popisok fotky */}
            {!editing && photo.caption && (
                <div style={{
                    padding: '0 24px 4px', textAlign: 'center',
                    fontSize: 14, lineHeight: 1.5, color: 'var(--paper)',
                }}>{photo.caption}</div>
            )}

            {/* Písanie popisku */}
            {editing && (
                <div style={{
                    padding: '12px 18px 18px', display: 'grid', gap: 8,
                    borderTop: '0.5px solid rgba(250,250,247,0.16)',
                    background: 'rgba(12,16,13,0.97)',
                }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>POPISOK FOTKY</span>
                        <span className="mono" style={{
                            fontSize: 11,
                            color: draft.length > CAPTION_MAX - 20 ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                        }}>{draft.length} / {CAPTION_MAX}</span>
                    </div>

                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        maxLength={CAPTION_MAX}
                        rows={2}
                        autoFocus
                        placeholder="čo sa tu stalo?"
                        style={{
                            font: 'inherit', fontSize: 15, lineHeight: 1.4, resize: 'none',
                            color: 'var(--paper)', background: 'rgba(250,250,247,0.08)',
                            border: '0.5px solid rgba(250,250,247,0.18)', borderRadius: 12,
                            padding: '10px 12px',
                        }}
                    />

                    {failed && (
                        <div style={{ fontSize: 12.5, color: 'var(--accent)' }}>Popisok sa nepodarilo uložiť.</div>
                    )}

                    <div className="row gap-8">
                        <button onClick={() => setDraft(null)} style={{
                            flex: 1, padding: '10px 0', borderRadius: 999, cursor: 'pointer',
                            font: 'inherit', fontSize: 14, color: 'var(--paper)',
                            background: 'transparent', border: '0.5px solid rgba(250,250,247,0.22)',
                        }}>zrušiť</button>
                        <button onClick={saveCaption} disabled={saving} style={{
                            flex: 1, padding: '10px 0', borderRadius: 999, cursor: 'pointer',
                            font: 'inherit', fontSize: 14, color: 'var(--paper)',
                            background: 'var(--green)', border: 'none', opacity: saving ? 0.6 : 1,
                        }}>{saving ? 'ukladám…' : 'uložiť'}</button>
                    </div>
                </div>
            )}

            {/* Bodky */}
            {!editing && items.length > 1 && items.length <= 12 && (
                <div className="row" style={{ justifyContent: 'center', gap: 6, padding: '12px 0 18px' }}>
                    {items.map((p, j) => (
                        <button key={p.id} onClick={() => setI(j)} style={{
                            width: j === i ? 18 : 6, height: 6, borderRadius: 3,
                            background: j === i ? 'var(--paper)' : 'rgba(255,255,255,0.35)',
                            border: 'none', cursor: 'pointer', padding: 0,
                            transition: 'width 200ms ease',
                        }} />
                    ))}
                </div>
            )}
        </div>
    );
}

const lbBtn = {
    background: 'rgba(250,250,247,0.12)',
    border: 'none',
    color: 'var(--paper)',
    backdropFilter: 'blur(6px)',
};
