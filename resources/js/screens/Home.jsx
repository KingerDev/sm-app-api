// Domov — „spolu už" + veľký počet dní + skratky + najnovší moment (podľa design/hifi-home.jsx)
import { cloneElement, useRef, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { Icons, Photo, ProgressBar, coverSrc, iconBg } from '../components/shell';
import Mascot from '../components/Mascot';
import CoverPicker from '../components/CoverPicker';
import { PlacePicker } from './MomentForm';
import { daysUntil, durationSk, formatDateSk, formatDateShortSk, parseDate, today } from '../lib/dates';
import { dalsieSk, loadSeen, spravySk, unreadTalk } from '../lib/photoTalk';

export default function Home({ navigate }) {
    const { stats, settings, moments, capsules, events, notes, user } = useStore();

    // Nové správy pri fotkách — web ani appka nemajú push, takže toto je jediné
    // miesto, kde sa o nich ten druhý dozvie.
    const talk = unreadTalk(moments, user?.name, loadSeen());

    const m = moments[0]; // najnovší
    const nextCapsule = capsules
        .filter(c => !c.is_unlocked)
        .map(c => ({ ...c, daysLeft: daysUntil(c.unlock_date) }))
        .sort((a, b) => a.daysLeft - b.daysLeft)[0];

    const nextEvent = events
        .filter(e => parseDate(e.date) >= today())
        .sort((a, b) => parseDate(a.date) - parseDate(b.date))[0];
    const eventDaysLeft = nextEvent ? daysUntil(nextEvent.date) : 0;

    const eventIcon = { anniv: '♥', milestone: '✦', capsule: '🔒', plan: '📌', date: '♡' };

    return (
        <>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 20px 8px',
                gap: 10,
            }}>
                <div className="row gap-10" style={{ alignItems: 'center', minWidth: 0 }}>
                    <Mascot variant={settings.mascot_variant || 'pebbles'} size={44} />
                    <div className="col" style={{ gap: 1, minWidth: 0 }}>
                        <div className="eyebrow" style={{ whiteSpace: 'nowrap' }}>náš priestor</div>
                        <div className="serif" style={{ fontSize: 30, color: 'var(--green)', fontWeight: 600, lineHeight: 1 }}>
                            S+M
                        </div>
                    </div>
                </div>
                <div className="row gap-8" style={{ flexShrink: 0 }}>
                    <button className="icon-btn" onClick={() => navigate('moment-add')}>{Icons.plus}</button>
                    <button className="icon-btn" onClick={() => navigate('calendar')}>{Icons.cal}</button>
                </div>
            </div>
            <div className="scroll">
                {/* Hero — veľké počítadlo dní */}
                <div className="col gap-4" style={{ alignItems: 'center', padding: '8px 0 16px' }}>
                    <div className="eyebrow">spolu už</div>
                    <div className="num" style={{ fontSize: 132, color: 'var(--green)', lineHeight: 0.9 }}>
                        {(stats?.days_together ?? 0).toLocaleString('sk-SK')}
                    </div>
                    <div className="row gap-6" style={{ marginTop: 2 }}>
                        <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>
                            dní · {settings.together_since ? durationSk(settings.together_since) : ''}
                        </span>
                    </div>
                    {settings.together_since && (
                        <div className="handwritten" style={{ fontSize: 18, marginTop: 8 }}>
                            ♡ od {formatDateShortSk(settings.together_since)}
                        </div>
                    )}
                </div>

                <div className="divider" style={{ margin: '4px 0 20px' }} />

                {/* Momentka — rýchle zachytenie chvíľky z bežného dňa */}
                <QuickNote recent={notes.slice(0, 2)} navigate={navigate} />

                {/* Napísal ti niekto k fotke */}
                {talk.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                        <div className="row between" style={{ alignItems: 'baseline', marginBottom: 10 }}>
                            <div className="handwritten" style={{ fontSize: 22 }}>
                                {talk[0].comment.who} ti napísal{talk[0].comment.who === 'S' ? 'a' : ''}
                            </div>
                            <div className="eyebrow" style={{ color: 'var(--green)' }}>
                                {talk.reduce((n, t) => n + t.count, 0)} {spravySk(talk.reduce((n, t) => n + t.count, 0))}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gap: 8 }}>
                            {talk.slice(0, 3).map(t => (
                                <button key={t.photoId} className="card" onClick={() => navigate(`moment:${t.momentSlug}?photo=${t.photoId}`)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12, padding: 10,
                                        textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit',
                                    }}>
                                    <img src={t.thumb} alt="" style={{
                                        width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0,
                                    }} />
                                    <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                                        <div className="mono" style={{ fontSize: 10, color: 'var(--muted)' }}>{t.momentTitle}</div>
                                        <div style={{ fontSize: 14, lineHeight: 1.4 }}>{t.comment.text}</div>
                                        {t.count > 1 && (
                                            <div style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 500 }}>
                                                a ešte {t.count - 1} {dalsieSk(t.count - 1)}
                                            </div>
                                        )}
                                    </div>
                                    <span style={{ color: 'var(--green)', flexShrink: 0 }}>
                                        {cloneElement(Icons.chat, { style: { width: 17, height: 17 } })}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Na dnes — najbližšia udalosť */}
                {nextEvent && (
                    <button className="card tint" style={{
                        width: '100%', marginBottom: 18, padding: 14, textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
                        border: 'none', font: 'inherit', color: 'inherit',
                    }} onClick={() => navigate('calendar')}>
                        <div style={{
                            width: 54, height: 54, borderRadius: 14, flexShrink: 0,
                            background: 'var(--green)', color: 'var(--paper)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                        }}>
                            <span className="num" style={{ fontSize: 22, color: 'var(--paper)' }}>{eventDaysLeft}</span>
                            <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.6, opacity: 0.85 }}>dní</span>
                        </div>
                        <div className="col grow" style={{ gap: 2, minWidth: 0 }}>
                            <div className="eyebrow" style={{ color: 'var(--green)' }}>na dnes · {formatDateSk(today())}</div>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>
                                {nextEvent.icon || eventIcon[nextEvent.kind] || '✦'} {nextEvent.title}
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                                {eventDaysLeft === 0 ? 'dnes je ten deň!' : eventDaysLeft === 1 ? 'už zajtra' : `o ${eventDaysLeft} dní`} · {formatDateSk(nextEvent.date)}
                            </div>
                        </div>
                        <span style={{ color: 'var(--green)', flexShrink: 0 }}>{Icons.arrow}</span>
                    </button>
                )}

                {/* Skratky (2x2) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button className="card" style={shortcutCard} onClick={() => navigate('bucket')}>
                        <div className="row between">
                            <div style={iconBg}>{Icons.bucket}</div>
                            <span className="eyebrow" style={{ fontSize: 9.5 }}>{stats?.bucket_done}/{stats?.bucket_total}</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>Bucket list</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{stats?.bucket_done} splnených</div>
                        </div>
                        <ProgressBar value={stats?.bucket_total ? stats.bucket_done / stats.bucket_total : 0} />
                    </button>

                    <button className="card" style={shortcutCard} onClick={() => navigate('map')}>
                        <div className="row between">
                            <div style={iconBg}>{Icons.pin}</div>
                            <span className="eyebrow" style={{ fontSize: 9.5 }}>{stats?.countries} krajín</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>Mapa sveta</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{stats?.cities} miest navštívených</div>
                        </div>
                        <MiniMapStrip />
                    </button>

                    <button className="card" style={shortcutCard} onClick={() => navigate('gallery')}>
                        <div className="row between">
                            <div style={iconBg}>{Icons.img}</div>
                            <span className="eyebrow" style={{ fontSize: 9.5 }}>{(stats?.photos ?? 0).toLocaleString('sk-SK')}</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 500 }}>Galéria</div>
                            <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{moments.length} momentov</div>
                        </div>
                        <div className="row gap-4">
                            {moments.slice(0, 4).map(mm => (
                                <Photo key={mm.id} seed={mm.seed} url={coverSrc(mm)}
                                    style={{ width: 30, height: 30, borderRadius: 6 }} />
                            ))}
                        </div>
                    </button>

                    <button className="card hero" style={{ ...shortcutCard, padding: 14 }}
                        onClick={() => navigate('wrapped')}>
                        <div className="row between">
                            <div style={{ ...iconBg, background: 'rgba(255,255,255,0.15)', color: 'var(--paper)' }}>
                                {Icons.sparkle}
                            </div>
                            <span style={{ fontSize: 9.5, opacity: 0.85, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                                {new Date().getFullYear()}
                            </span>
                        </div>
                        <div>
                            <div className="serif" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}>Wrapped</div>
                            <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>náš rok v 6 slidoch</div>
                        </div>
                        <div className="row gap-6" style={{ marginTop: 2 }}>
                            <span style={{ fontSize: 11, opacity: 0.85 }}>spustiť →</span>
                        </div>
                    </button>
                </div>

                {/* Najnovší moment */}
                {m && (
                    <>
                        <div className="row between" style={{ margin: '24px 0 10px' }}>
                            <div className="handwritten" style={{ fontSize: 22 }}>Najnovší moment</div>
                            <button className="btn ghost" style={{ padding: '4px 8px', fontSize: 12, color: 'var(--muted)' }}
                                onClick={() => navigate('gallery')}>
                                všetky →
                            </button>
                        </div>

                        <button className="card flush" style={{ width: '100%', padding: 0, border: '0.5px solid var(--line)', cursor: 'pointer', background: 'var(--surface)' }}
                            onClick={() => navigate('moment:' + m.slug)}>
                            <Photo seed={m.seed} url={coverSrc(m)} style={{ height: 200, borderRadius: 0 }} />
                            <div className="col gap-6" style={{ padding: 14, textAlign: 'left' }}>
                                <div className="row between">
                                    <div className="eyebrow">{m.date_short} · {m.place_short}</div>
                                </div>
                                <div style={{ fontSize: 17, fontWeight: 500 }}>{m.title}</div>
                            </div>
                        </button>
                    </>
                )}

                {/* Časová kapsula */}
                {nextCapsule && (
                    <button className="card flush" style={{
                        width: '100%', marginTop: 16, padding: 0, textAlign: 'left',
                        cursor: 'pointer', border: '0.5px solid var(--line)',
                        background: 'var(--surface)', font: 'inherit', color: 'inherit',
                        overflow: 'hidden', position: 'relative',
                    }}
                        onClick={() => navigate('capsule')}>
                        <div style={{
                            padding: 16, display: 'flex', gap: 14, alignItems: 'center',
                            background: 'linear-gradient(115deg, #1f3f2b 0%, #2d5a3d 70%, #3a6a4a 100%)',
                            color: 'var(--paper)',
                        }}>
                            <div style={{
                                width: 60, height: 60, borderRadius: '50%',
                                background: 'radial-gradient(circle at 35% 35%, #d97240 0%, #b85a1b 60%, #8a3f0e 100%)',
                                display: 'grid', placeItems: 'center',
                                color: 'var(--paper)',
                                fontFamily: 'Caveat', fontSize: 24, fontWeight: 700,
                                boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.2)',
                                position: 'relative',
                                flexShrink: 0,
                            }}>
                                <span style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.3))' }}>S+M</span>
                            </div>
                            <div className="col grow" style={{ gap: 4, minWidth: 0 }}>
                                <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.75)' }}>časová kapsula</div>
                                <div style={{ fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {nextCapsule.title}
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
                                    odomkne sa za <span className="serif" style={{ fontSize: 18, color: 'var(--paper)', fontWeight: 600 }}>
                                        {nextCapsule.daysLeft}
                                    </span> dní
                                </div>
                            </div>
                        </div>
                    </button>
                )}
            </div>
        </>
    );
}

/* Rýchla chvíľka — text + voliteľná fotka (s výrezom) a miesto, uloží sa hneď z Domova */
const QuickNote = ({ recent, navigate }) => {
    const { user, moments, countries, refresh } = useStore();
    const [text, setText] = useState('');
    const [file, setFile] = useState(null); // { file, url } — už orezaná
    const [crop, setCrop] = useState(null); // File — čaká na výber výrezu
    const [place, setPlace] = useState(null); // { label, short, city, country } z PlacePickera
    const [placeSheet, setPlaceSheet] = useState(false);
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);

    const defaultWho = user?.name === 'S' || user?.name === 'M' ? user.name : 'spolu';

    const applyCrop = (cropped) => {
        if (file) URL.revokeObjectURL(file.url);
        setFile({ file: cropped, url: URL.createObjectURL(cropped) });
        setCrop(null);
    };
    const clearFile = () => {
        if (file) URL.revokeObjectURL(file.url);
        setFile(null);
    };
    // Úprava výrezu — ťuknutím na náhľad
    const recrop = async () => {
        if (!file) return;
        const blob = await (await fetch(file.url)).blob();
        setCrop(new File([blob], 'chvilka.jpg', { type: blob.type || 'image/jpeg' }));
    };

    const submit = async () => {
        const v = text.trim();
        if (!v || busy) return;
        setBusy(true);
        try {
            const fd = new FormData();
            fd.append('text', v);
            fd.append('who', defaultWho);
            if (place) {
                fd.append('place', place.label);
                fd.append('place_short', place.short);
                // Prepojenie na mapu — založí krajinu/mesto ak treba
                if (place.city && place.country) {
                    fd.append('city', place.city);
                    fd.append('country', place.country);
                }
            }
            if (file) fd.append('file', file.file);
            await api.post('/notes', fd);
            await refresh('notes', 'countries', 'stats');
            clearFile();
            setText('');
            setPlace(null);
        } catch {
            alert('Chvíľka sa neuložila — skús znova.');
        }
        setBusy(false);
    };

    return (
        <div style={{ marginBottom: 18 }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files?.[0]) setCrop(e.target.files[0]); e.target.value = ''; }} />

            <div className="row between" style={{ marginBottom: 10, alignItems: 'baseline' }}>
                <div className="handwritten" style={{ fontSize: 22 }}>Dnešná chvíľka</div>
                <button className="btn ghost" onClick={() => navigate('momentka-add')}
                    style={{ padding: '2px 4px', fontSize: 12, color: 'var(--muted)' }}>podrobnejšie →</button>
            </div>
            {file && (
                <div style={{ position: 'relative', marginBottom: 8, width: 'fit-content' }}>
                    <Photo url={file.url} onClick={recrop} title="upraviť výrez"
                        style={{ width: 74, height: 74, borderRadius: 12, cursor: 'pointer' }} />
                    <button onClick={clearFile} style={{
                        position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: '50%',
                        background: 'var(--ink)', color: 'var(--paper)', border: '2px solid var(--paper)',
                        display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0,
                    }}>{cloneElement(Icons.close, { style: { width: 12, height: 12 } })}</button>
                </div>
            )}
            {place && (
                <button onClick={() => setPlaceSheet(true)} className="chip green" style={{
                    marginBottom: 8, cursor: 'pointer', border: 'none', font: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                    {cloneElement(Icons.pin, { style: { width: 12, height: 12 } })}
                    {place.label}
                    <span role="button" onClick={(e) => { e.stopPropagation(); setPlace(null); }}
                        style={{ display: 'grid', placeItems: 'center', marginLeft: 2 }}>
                        {cloneElement(Icons.close, { style: { width: 11, height: 11 } })}
                    </span>
                </button>
            )}
            <div className="row gap-8" style={{ alignItems: 'stretch' }}>
                <button className="icon-btn" onClick={() => fileRef.current?.click()} title="pridať fotku"
                    style={{ flexShrink: 0, color: file ? 'var(--green)' : 'var(--muted)' }}>
                    {cloneElement(Icons.img, { style: { width: 19, height: 19 } })}
                </button>
                <button className="icon-btn" onClick={() => setPlaceSheet(true)} title="pridať miesto"
                    style={{ flexShrink: 0, color: place ? 'var(--green)' : 'var(--muted)' }}>
                    {cloneElement(Icons.pin, { style: { width: 19, height: 19 } })}
                </button>
                <input value={text} onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                    placeholder="čo sa dnes stalo? napr. zmokli sme…"
                    style={{
                        flex: 1, font: 'inherit', fontSize: 14, color: 'var(--ink)',
                        background: 'var(--surface)', border: '0.5px solid var(--line)',
                        borderRadius: 12, padding: '12px 14px', outline: 'none', minWidth: 0,
                    }} />
                <button className="btn primary" onClick={submit} disabled={!text.trim() || busy}
                    style={{ flexShrink: 0, padding: '0 16px', opacity: text.trim() && !busy ? 1 : 0.4, cursor: text.trim() && !busy ? 'pointer' : 'default' }}>
                    {cloneElement(Icons.send, { style: { width: 18, height: 18 } })}
                </button>
            </div>
            {recent.length > 0 && (
                <div className="col gap-6" style={{ marginTop: 12 }}>
                    {recent.map(n => (
                        <button key={n.id} onClick={() => navigate('momentka:' + n.id)} className="row gap-10" style={{
                            alignItems: 'flex-start', padding: '10px 13px', textAlign: 'left', width: '100%',
                            background: 'var(--green-soft)', borderRadius: 12, border: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer',
                        }}>
                            {n.photo_thumb_url
                                ? <Photo url={n.photo_thumb_url} style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0 }} />
                                : <span style={{ color: 'var(--green)', fontSize: 14, lineHeight: '19px', flexShrink: 0 }}>✎</span>}
                            <div className="col" style={{ gap: 3, minWidth: 0 }}>
                                <div style={{ fontSize: 13, lineHeight: 1.45 }}>{n.text}</div>
                                <div className="eyebrow" style={{ color: 'var(--green)' }}>
                                    {n.date_short} · {n.who}{n.place ? ` · 📍 ${n.place_short || n.place}` : ''}
                                </div>
                            </div>
                        </button>
                    ))}
                    <button className="btn ghost" onClick={() => navigate('gallery')}
                        style={{ alignSelf: 'flex-start', padding: '2px 4px', fontSize: 12, color: 'var(--muted)' }}>
                        všetky chvíľky v galérii →
                    </button>
                </div>
            )}

            {/* Výber výrezu fotky — štvorec ako v galérii */}
            {crop && (
                <CoverPicker
                    file={crop}
                    aspect="1 / 1"
                    maxWidth={300}
                    eyebrow={`dnes · ${defaultWho}${place ? ` · 📍 ${place.short}` : ''} · chvíľka`}
                    title={text.trim() || 'dnešná chvíľka'}
                    saveLabel="použiť fotku"
                    onCancel={() => setCrop(null)}
                    onSave={applyCrop}
                />
            )}

            {placeSheet && (
                <PlacePicker
                    current={place?.label}
                    countries={countries}
                    moments={moments}
                    onClose={() => setPlaceSheet(false)}
                    onPick={(p) => { setPlace(p); setPlaceSheet(false); }}
                />
            )}
        </div>
    );
};

const shortcutCard = {
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    textAlign: 'left',
    cursor: 'pointer',
    border: '0.5px solid var(--line)',
    background: 'var(--surface)',
    borderRadius: 'var(--r-md)',
    minHeight: 130,
    justifyContent: 'space-between',
    font: 'inherit',
    color: 'inherit',
};

const MiniMapStrip = () => (
    <svg viewBox="0 0 100 14" style={{ width: '100%', height: 14 }}>
        <g fill="var(--green)">
            <circle cx="15" cy="7" r="2" />
            <circle cx="30" cy="5" r="2" />
            <circle cx="42" cy="8" r="2" />
            <circle cx="55" cy="6" r="2" />
            <circle cx="70" cy="9" r="2" />
            <circle cx="85" cy="7" r="2" />
            <circle cx="92" cy="5" r="2" />
        </g>
        <line x1="6" y1="7" x2="96" y2="7" stroke="var(--green-line)" strokeWidth="0.6" strokeDasharray="1.5 2" />
    </svg>
);
