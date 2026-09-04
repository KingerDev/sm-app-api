// Lightbox — fullscreen prehliadač fotiek s listovaním (šípky, swipe, klávesnica)
import { cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from './shell';

/**
 * Koľko sa zmestí do jednej správy. Rovnaké číslo má server vo validácii aj
 * natívna appka.
 */
export const COMMENT_MAX = 500;

/** Farba mena autora — vlastné správy sú zelené celé a meno pri nich netreba. */
const whoColor = (who) => (who === 'S' ? '#e8b4c8' : who === 'M' ? '#9fd6a8' : '#d8d2c2');

export default function Lightbox({
    items, index, onClose, onTogglePin, onDelete, onSetCover,
    me, onAddComment, onDeleteComment, thread: threadAtStart, onOpenThread,
}) {
    const [i, setI] = useState(index ?? 0);
    const [thread, setThread] = useState(!!threadAtStart);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [failed, setFailed] = useState(false);
    const touchX = useRef(null);
    const threadRef = useRef(null);

    const prev = useCallback(() => setI(v => (v - 1 + items.length) % items.length), [items.length]);
    const next = useCallback(() => setI(v => (v + 1) % items.length), [items.length]);

    useEffect(() => {
        const onKey = (e) => {
            // Počas rozhovoru patria šípky aj Escape textovému poľu
            if (thread) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose, prev, next, thread]);

    // Keď sa zmaže posledná fotka, zavri; inak drž index v rozsahu
    useEffect(() => {
        if (!items.length) onClose();
        else if (i > items.length - 1) setI(items.length - 1);
    }, [items.length, i, onClose]);

    const photo = items[Math.min(i, items.length - 1)];
    if (!photo) return null;

    const comments = photo.comments ?? [];
    const last = comments[comments.length - 1];

    // Text sa po zlyhaní nesmie stratiť — panel ostáva otvorený aj s ním.
    const send = async () => {
        const text = draft.trim();
        if (!text || !onAddComment) return;
        setSending(true);
        setFailed(false);
        try {
            await onAddComment(photo, text);
            setDraft('');
            setTimeout(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }), 60);
        } catch {
            setFailed(true);
        } finally {
            setSending(false);
        }
    };

    const removeComment = (c) => {
        if (!onDeleteComment || c.who !== me) return;
        if (!confirm(`Vymazať správu „${c.text}"?`)) return;
        onDeleteComment(photo, c.id);
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
                if (touchX.current === null || thread) return;
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
                    {photo.real && onAddComment && (
                        <button className="icon-btn" style={{ ...lbBtn, ...(comments.length ? { background: 'var(--green)' } : null) }}
                            title={comments.length ? `rozhovor (${comments.length})` : 'napísať k fotke'}
                            onClick={() => { setFailed(false); setThread(true); onOpenThread?.(photo); }}>
                            {cloneElement(Icons.chat, { style: { width: 17, height: 17 } })}
                            {comments.length > 0 && (
                                <span className="mono" style={{ fontSize: 10, marginLeft: 3 }}>{comments.length}</span>
                            )}
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

            {/* Posledná správa */}
            {!thread && last && (
                <button onClick={() => { setThread(true); onOpenThread?.(photo); }} style={{
                    padding: '0 24px 6px', textAlign: 'center', border: 'none', cursor: 'pointer',
                    background: 'none', font: 'inherit', fontSize: 14, lineHeight: 1.5, color: 'var(--paper)',
                }}>
                    <span style={{ fontWeight: 600, color: whoColor(last.who) }}>{last.who}: </span>
                    {last.text}
                    {comments.length > 1 && (
                        <span className="mono" style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                            celý rozhovor ({comments.length})
                        </span>
                    )}
                </button>
            )}

            {/* Rozhovor */}
            {thread && (
                <div style={{
                    padding: '12px 18px 18px', display: 'grid', gap: 10,
                    borderTop: '0.5px solid rgba(250,250,247,0.16)',
                    background: 'rgba(12,16,13,0.97)',
                }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                            {comments.length ? `ROZHOVOR · ${comments.length}` : 'ROZHOVOR'}
                        </span>
                        <button className="icon-btn" style={lbBtn} onClick={() => setThread(false)}>{Icons.close}</button>
                    </div>

                    {comments.length ? (
                        <div ref={threadRef} style={{ display: 'grid', gap: 8, maxHeight: '28vh', overflowY: 'auto' }}>
                            {comments.map((c) => {
                                const mine = c.who === me;

                                return (
                                    <div key={c.id} onDoubleClick={() => removeComment(c)} style={{
                                        justifySelf: mine ? 'end' : 'start', maxWidth: '86%',
                                        background: mine ? 'var(--green)' : 'rgba(250,250,247,0.10)',
                                        borderRadius: 16,
                                        borderBottomRightRadius: mine ? 4 : 16,
                                        borderBottomLeftRadius: mine ? 16 : 4,
                                        padding: '9px 13px', display: 'grid', gap: 3,
                                        cursor: mine ? 'pointer' : 'default',
                                    }} title={mine ? 'dvojklik správu vymaže' : undefined}>
                                        {!mine && (
                                            <span style={{ fontWeight: 600, fontSize: 11.5, color: whoColor(c.who) }}>{c.who}</span>
                                        )}
                                        <span style={{ fontSize: 14.5, lineHeight: 1.4, color: 'var(--paper)' }}>{c.text}</span>
                                        {c.when && (
                                            <span className="mono" style={{ fontSize: 10, color: 'rgba(250,250,247,0.5)' }}>{c.when}</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ fontSize: 13, color: 'rgba(250,250,247,0.5)' }}>Zatiaľ tu nikto nič nenapísal.</div>
                    )}

                    {failed && <div style={{ fontSize: 12.5, color: 'var(--accent)' }}>Správu sa nepodarilo odoslať.</div>}

                    <div className="row gap-8" style={{ alignItems: 'flex-end' }}>
                        <textarea
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                // Enter odošle, Shift+Enter je nový riadok — ako v chate
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                            }}
                            maxLength={COMMENT_MAX}
                            rows={1}
                            autoFocus={!comments.length}
                            placeholder="napíš niečo k tejto fotke…"
                            style={{
                                flex: 1, font: 'inherit', fontSize: 15, lineHeight: 1.4, resize: 'none',
                                color: 'var(--paper)', background: 'rgba(250,250,247,0.08)',
                                border: '0.5px solid rgba(250,250,247,0.18)', borderRadius: 20,
                                padding: '10px 14px', minHeight: 42, maxHeight: 110,
                            }}
                        />
                        <button onClick={send} disabled={sending || !draft.trim()} style={{
                            width: 42, height: 42, borderRadius: '50%', border: 'none',
                            background: 'var(--green)', color: 'var(--paper)', cursor: 'pointer',
                            display: 'grid', placeItems: 'center',
                            opacity: sending || !draft.trim() ? 0.45 : 1,
                        }}>{cloneElement(Icons.send, { style: { width: 18, height: 18 } })}</button>
                    </div>
                </div>
            )}

            {/* Bodky */}
            {!thread && items.length > 1 && items.length <= 12 && (
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
