// Nový / upraviť moment + hľadanie momentov (podľa design/hifi-moment-io.jsx)
import { cloneElement, useRef, useState } from 'react';
import { api, ApiError } from '../api';
import { useStore } from '../store';
import { Icons, Photo, Sheet, coverSrc } from '../components/shell';
import PhotoEditor from '../components/PhotoEditor';
import { toInputDate } from '../lib/dates';
import { momentPlaces } from '../lib/places';

const mInputBase = {
    width: '100%', font: 'inherit', fontSize: 15, color: 'var(--ink)',
    background: 'var(--surface)', border: '0.5px solid var(--line)',
    borderRadius: 12, padding: '13px 14px', outline: 'none',
};

// Rovnaký strop drží server.
const MAX_PLACES = 10;

const fotkaWord = (n) => n === 1 ? 'fotka' : n < 5 ? 'fotky' : 'fotiek';

/* ---------- Nový / upraviť moment ---------- */
export function MomentForm({ slug, onBack, navigate }) {
    const { user, moments, countries, refresh } = useStore();
    const moment = slug ? moments.find(m => m.slug === slug) : null;
    const edit = !!moment;

    const defaultWho = user?.name === 'S' || user?.name === 'M' ? user.name : 'spolu';

    const [title, setTitle] = useState(edit ? moment.title : '');
    // Dovolenka býva cez viac miest — každé sa na mape naviaže zvlášť.
    const [places, setPlaces] = useState(edit ? momentPlaces(moment) : []);
    const [dateStart, setDateStart] = useState(edit ? toInputDate(moment.date_start) : '');
    const [dateEnd, setDateEnd] = useState(edit && moment.date_end ? toInputDate(moment.date_end) : '');
    const [multiDay, setMultiDay] = useState(edit && !!moment.date_end);
    const [who, setWho] = useState(edit ? moment.who : defaultWho);
    const [placeSheet, setPlaceSheet] = useState(false);
    const [note, setNote] = useState(edit ? (moment.description || '') : '');
    const [files, setFiles] = useState([]); // { file, url }
    const [editIndex, setEditIndex] = useState(null); // index fotky v editore
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState(null); // { done, total } počas nahrávania fotiek
    const [error, setError] = useState(null);
    const fileRef = useRef(null);

    if (slug && !moment) return null;

    const pickFiles = (list) => {
        const picked = Array.from(list || []).map(f => ({ file: f, url: URL.createObjectURL(f) }));
        if (picked.length) setFiles([...files, ...picked]);
    };
    const removeFile = (i) => {
        URL.revokeObjectURL(files[i].url);
        setFiles(files.filter((_, j) => j !== i));
    };

    const canSave = title.trim().length > 0 && places.length > 0 && !!dateStart && !busy;

    const save = async () => {
        if (!canSave) return;
        setBusy(true);
        setError(null);
        try {
            const payload = {
                title: title.trim(),
                // Zhrnutie do place/place_short a prepojenie s mapou si urobí server.
                places: places.map(p => ({
                    label: p.label, short: p.short || null, city: p.city || null, country: p.country || null,
                })),
                date_start: dateStart,
                date_end: multiDay && dateEnd ? dateEnd : null,
                who,
                description: note.trim() || null,
            };

            const saved = edit
                ? await api.patch(`/moments/${slug}`, payload)
                : await api.post('/moments', payload);

            if (files.length) {
                setProgress({ done: 0, total: files.length });
                let failed = 0;
                for (let i = 0; i < files.length; i++) {
                    try {
                        const fd = new FormData();
                        fd.append('type', 'moment');
                        fd.append('id', saved.id);
                        fd.append('files[]', files[i].file);
                        await api.post('/photos', fd);
                    } catch {
                        failed++;
                    }
                    setProgress({ done: i + 1, total: files.length });
                }
                setProgress(null);
                if (failed) alert(`${failed} ${failed === 1 ? 'fotka sa nenahrala' : 'fotky sa nenahrali'} — vieš ich doplniť v detaile momentu.`);
            }

            await refresh('moments', 'stats', 'countries');
            files.forEach(f => URL.revokeObjectURL(f.url));
            navigate('moment:' + saved.slug);
        } catch (e) {
            const first = e instanceof ApiError && Object.values(e.errors)[0]?.[0];
            setError(first || e.message || 'Uloženie zlyhalo.');
            setBusy(false);
        }
    };

    const fieldWrap = { position: 'relative' };
    const fieldIcon = {
        position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
        color: 'var(--muted-2)', display: 'grid', placeItems: 'center', pointerEvents: 'none',
    };

    return (
        <div className="col" style={{ height: '100%', background: 'var(--paper)' }}>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />

            <div className="app-header" style={{ paddingBottom: 12 }}>
                <div className="col" style={{ minWidth: 0 }}>
                    <div className="eyebrow">{edit ? 'uprav spomienku' : 'zachyť spomienku'}</div>
                    <h1>{edit ? 'upraviť moment' : 'nový moment'}</h1>
                </div>
                <div className="actions">
                    <button className="icon-btn" onClick={onBack}>{Icons.close}</button>
                </div>
            </div>

            <div className="scroll" style={{ flex: 1 }}>
                {/* Fotky */}
                {edit ? (
                    <div style={{ position: 'relative', marginBottom: files.length ? 10 : 20 }}>
                        <Photo seed={moment.seed} url={coverSrc(moment, { full: true })} style={{ height: 150, borderRadius: 16 }} />
                        <div style={{
                            position: 'absolute', inset: 0, borderRadius: 16,
                            background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.4))',
                        }} />
                        <button className="btn" onClick={() => fileRef.current?.click()} style={{
                            position: 'absolute', bottom: 12, right: 12, padding: '8px 14px',
                            gap: 6, fontSize: 12.5, background: 'rgba(250,250,247,0.94)',
                            backdropFilter: 'blur(8px)', border: 'none', color: 'var(--ink)',
                        }}>
                            {cloneElement(Icons.img, { style: { width: 15, height: 15 } })} pridať fotky
                        </button>
                    </div>
                ) : (
                    <div onClick={() => fileRef.current?.click()} style={{
                        border: '1.5px dashed var(--green-line)', borderRadius: 16,
                        background: 'var(--green-soft)', padding: '26px 16px',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        cursor: 'pointer', marginBottom: files.length ? 10 : 20,
                    }}>
                        <div style={{
                            width: 46, height: 46, borderRadius: '50%', background: 'var(--green)',
                            display: 'grid', placeItems: 'center', color: 'var(--paper)',
                        }}>{cloneElement(Icons.img, { style: { width: 22, height: 22 } })}</div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--green-deep)' }}>Pridaj fotky</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>ťukni alebo potiahni sem</div>
                    </div>
                )}

                {/* Náhľady vybraných fotiek */}
                {files.length > 0 && (
                    <div style={{ margin: '0 -20px 20px', overflowX: 'auto', paddingLeft: 20 }}>
                        <div className="row gap-8" style={{ width: 'max-content', paddingRight: 20 }}>
                            {files.map((f, i) => (
                                <div key={f.url} style={{ position: 'relative', flexShrink: 0 }}>
                                    <Photo url={f.url} onClick={() => setEditIndex(i)}
                                        style={{ width: 72, height: 72, borderRadius: 12, cursor: 'pointer' }} />
                                    <button onClick={() => removeFile(i)} style={{
                                        position: 'absolute', top: 4, right: 4, width: 20, height: 20,
                                        borderRadius: '50%', border: 'none', cursor: 'pointer',
                                        background: 'rgba(20,30,22,0.55)', color: 'var(--paper)',
                                        display: 'grid', placeItems: 'center', padding: 0,
                                    }}>{cloneElement(Icons.close, { style: { width: 11, height: 11 } })}</button>
                                    <button onClick={() => setEditIndex(i)} style={{
                                        position: 'absolute', bottom: 4, right: 4, width: 20, height: 20,
                                        borderRadius: '50%', border: 'none', cursor: 'pointer',
                                        background: 'rgba(20,30,22,0.55)', color: 'var(--paper)',
                                        display: 'grid', placeItems: 'center', padding: 0,
                                    }}>{cloneElement(Icons.edit, { style: { width: 11, height: 11 } })}</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Názov */}
                <div className="eyebrow" style={{ marginBottom: 10 }}>názov</div>
                <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="napr. Víkend vo Viedni"
                    style={{ ...mInputBase, marginBottom: 18 }} />

                {/* Dátum + miesto */}
                <div className="row between" style={{ marginBottom: 10, alignItems: 'baseline' }}>
                    <div className="eyebrow">dátum</div>
                    <button onClick={() => setMultiDay(!multiDay)}
                        className={'chip' + (multiDay ? ' green' : '')}
                        style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}>viac dní</button>
                </div>
                <div style={fieldWrap}>
                    <span style={fieldIcon}>{cloneElement(Icons.cal, { style: { width: 18, height: 18 } })}</span>
                    <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
                        style={{ ...mInputBase, paddingLeft: 42, marginBottom: 10, WebkitAppearance: 'none', appearance: 'none' }} />
                </div>
                {multiDay && (
                    <div style={fieldWrap}>
                        <span style={fieldIcon}>{cloneElement(Icons.arrow, { style: { width: 18, height: 18 } })}</span>
                        <input type="date" value={dateEnd} min={dateStart || undefined}
                            onChange={e => setDateEnd(e.target.value)}
                            style={{ ...mInputBase, paddingLeft: 42, marginBottom: 10, WebkitAppearance: 'none', appearance: 'none' }} />
                    </div>
                )}
                <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
                    {places.map((p, i) => (
                        <div key={p.label + i} style={{
                            ...mInputBase, paddingLeft: 42, position: 'relative',
                            display: 'flex', alignItems: 'center',
                        }}>
                            <span style={{ ...fieldIcon, color: 'var(--green)' }}>
                                {cloneElement(Icons.pin, { style: { width: 18, height: 18 } })}
                            </span>
                            <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.label}
                            </span>
                            <button onClick={() => setPlaces(places.filter((_, j) => j !== i))} aria-label="odobrať miesto"
                                style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'var(--muted-2)', display: 'grid' }}>
                                {cloneElement(Icons.close, { style: { width: 16, height: 16 } })}
                            </button>
                        </div>
                    ))}
                    {places.length < MAX_PLACES && (
                        <button onClick={() => setPlaceSheet(true)} style={{
                            ...mInputBase, paddingLeft: 42, position: 'relative',
                            display: 'flex', alignItems: 'center', textAlign: 'left', cursor: 'pointer',
                            color: 'var(--muted-2)',
                        }}>
                            <span style={fieldIcon}>
                                {cloneElement(places.length ? Icons.plus : Icons.pin, { style: { width: 18, height: 18 } })}
                            </span>
                            <span className="grow">{places.length ? 'pridať ďalšie miesto' : 'vyber miesto'}</span>
                            <span style={{ color: 'var(--muted-2)' }}>
                                {cloneElement(Icons.arrow, { style: { width: 16, height: 16 } })}
                            </span>
                        </button>
                    )}
                </div>

                {/* Kto pridal */}
                <div className="eyebrow" style={{ marginBottom: 10 }}>kto pridal</div>
                <div className="row" style={{
                    gap: 0, background: 'var(--surface)', border: '0.5px solid var(--line)',
                    borderRadius: 12, padding: 4, marginBottom: 18,
                }}>
                    {['S', 'M', 'spolu'].map(w => (
                        <button key={w} onClick={() => setWho(w)} style={{
                            flex: 1, padding: '9px', borderRadius: 9, font: 'inherit',
                            fontSize: 13.5, fontWeight: 500, cursor: 'pointer', border: 'none',
                            background: who === w ? 'var(--green)' : 'transparent',
                            color: who === w ? 'var(--paper)' : 'var(--muted)',
                        }}>{w}</button>
                    ))}
                </div>

                {/* Poznámka */}
                <div className="eyebrow" style={{ marginBottom: 10 }}>poznámka</div>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                    placeholder="pár viet, aby sme nezabudli…" rows={3}
                    style={{ ...mInputBase, resize: 'none', lineHeight: 1.5 }} />

                {error && (
                    <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--accent)', textAlign: 'center' }}>{error}</div>
                )}

                <div className="handwritten" style={{
                    marginTop: 20, textAlign: 'center', fontSize: 17, color: 'var(--muted)',
                }}>
                    {edit ? 'každý detail sa ráta ✎' : 'malá chvíľa, veľká spomienka ♡'}
                </div>
            </div>

            {/* Sticky footer */}
            <div style={{
                padding: '14px 20px calc(14px + env(safe-area-inset-bottom))',
                borderTop: '0.5px solid var(--line)', background: 'var(--paper)',
            }}>
                {progress && (
                    <div style={{ marginBottom: 10 }}>
                        <div className="row between" style={{ marginBottom: 5 }}>
                            <span className="eyebrow" style={{ color: 'var(--green)' }}>nahrávam fotky</span>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--green)' }}>
                                {progress.done} / {progress.total}
                            </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: 'var(--green-line)', overflow: 'hidden' }}>
                            <div style={{
                                width: `${Math.round(progress.done / progress.total * 100)}%`,
                                height: '100%', background: 'var(--green)',
                                transition: 'width 300ms ease',
                            }} />
                        </div>
                    </div>
                )}
                <button className="btn primary" disabled={!canSave} onClick={save}
                    style={{
                        width: '100%', padding: '15px', fontSize: 15,
                        opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'default',
                    }}>
                    {busy
                        ? (progress ? `nahrávam ${progress.done} / ${progress.total}…` : 'ukladám…')
                        : (edit ? 'uložiť zmeny' : 'uložiť moment')}
                </button>
            </div>

            {editIndex !== null && files[editIndex] && (
                <PhotoEditor
                    file={files[editIndex].file}
                    onCancel={() => setEditIndex(null)}
                    onSave={(edited) => {
                        URL.revokeObjectURL(files[editIndex].url);
                        setFiles(files.map((f, j) => j === editIndex
                            ? { file: edited, url: URL.createObjectURL(edited) }
                            : f));
                        setEditIndex(null);
                    }}
                />
            )}

            {placeSheet && (
                <PlacePicker
                    countries={countries}
                    moments={moments}
                    onClose={() => setPlaceSheet(false)}
                    onPick={(p) => {
                        // To isté miesto dvakrát nepridáme.
                        if (!places.some(x => x.label === p.label)) {
                            setPlaces([...places, { label: p.label, short: p.short, city: p.city, country: p.country }]);
                        }
                        setPlaceSheet(false);
                    }}
                />
            )}
        </div>
    );
}

/* ---------- Výber miesta (zdieľaný — momenty aj chvíľky) ---------- */
export const PlacePicker = ({ current, countries, moments, onClose, onPick }) => {
    const [q, setQ] = useState('');
    const [adding, setAdding] = useState(false);
    const [newCity, setNewCity] = useState('');
    const [newCountry, setNewCountry] = useState('');

    // Uložené miesta: mapa (mesto · krajina) + miesta z existujúcich momentov
    const known = [];
    const seen = new Set();
    countries.forEach(c => (c.cities || []).forEach(ci => {
        const label = `${ci.name} · ${c.name}`;
        if (!seen.has(label)) {
            seen.add(label);
            known.push({ label, flag: c.flag, short: ci.name, city: ci.name, country: c.name });
        }
    }));
    // Po jednotlivých miestach — zhrnutie viacerých („Viedeň, Salzburg") by ako
    // návrh nedávalo zmysel.
    moments.forEach(m => momentPlaces(m).forEach(p => {
        if (seen.has(p.label)) return;
        seen.add(p.label);
        known.push({ label: p.label, flag: '📍', short: p.short, city: p.city || '', country: p.country || '' });
    }));

    const query = q.trim().toLowerCase();
    const filtered = known.filter(k => !query || k.label.toLowerCase().includes(query));

    const saveNew = () => {
        const city = newCity.trim();
        const country = newCountry.trim();
        if (!city) return;
        onPick({ label: country ? `${city} · ${country}` : city, short: city, city, country });
    };

    return (
        <Sheet onClose={onClose}>
            {!adding ? (
                <>
                    <div className="row between" style={{ alignItems: 'baseline', marginBottom: 12 }}>
                        <div className="col">
                            <div className="eyebrow" style={{ color: 'var(--green)' }}>kde to bolo</div>
                            <div style={{ fontSize: 17, fontWeight: 500 }}>Vyber miesto</div>
                        </div>
                        <button className="icon-btn" onClick={onClose}>
                            {cloneElement(Icons.close, { style: { width: 18, height: 18 } })}
                        </button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: 12 }}>
                        <span style={{
                            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                            color: 'var(--muted-2)', display: 'grid', placeItems: 'center',
                        }}>{cloneElement(Icons.search, { style: { width: 16, height: 16 } })}</span>
                        <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                            placeholder="hľadaj mesto alebo krajinu…"
                            style={{ ...mInputBase, paddingLeft: 38, borderRadius: 999 }} />
                    </div>

                    <button onClick={() => { setAdding(true); setNewCity(q); }} className="row gap-12" style={{
                        width: '100%', padding: '12px 0', alignItems: 'center', textAlign: 'left',
                        background: 'none', border: 'none', font: 'inherit', color: 'var(--green)',
                        cursor: 'pointer', borderBottom: '0.5px solid var(--line)',
                    }}>
                        <span style={{
                            width: 30, height: 30, borderRadius: '50%', background: 'var(--green-soft)',
                            display: 'grid', placeItems: 'center', flexShrink: 0,
                        }}>{cloneElement(Icons.plus, { style: { width: 16, height: 16 } })}</span>
                        <span style={{ fontSize: 13.5, fontWeight: 500 }}>Pridať nové miesto</span>
                    </button>

                    {filtered.map(k => (
                        <button key={k.label} onClick={() => onPick(k)} className="row gap-12" style={{
                            width: '100%', padding: '12px 0', alignItems: 'center', textAlign: 'left',
                            background: 'none', border: 'none', font: 'inherit',
                            color: current === k.label ? 'var(--green)' : 'var(--ink)',
                            cursor: 'pointer', borderBottom: '0.5px solid var(--line)',
                        }}>
                            <span style={{ fontSize: 20 }}>{k.flag}</span>
                            <span className="grow" style={{ fontSize: 13.5, fontWeight: current === k.label ? 500 : 400 }}>{k.label}</span>
                            {current === k.label && <span style={{ color: 'var(--green)' }}>
                                {cloneElement(Icons.check, { style: { width: 17, height: 17 } })}
                            </span>}
                        </button>
                    ))}
                    {filtered.length === 0 && (
                        <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12.5, color: 'var(--muted-2)' }}>
                            žiadne uložené miesto — pridaj nové ↑
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="row between" style={{ alignItems: 'baseline', marginBottom: 16 }}>
                        <div className="col">
                            <div className="eyebrow" style={{ color: 'var(--green)' }}>nové miesto</div>
                            <div style={{ fontSize: 17, fontWeight: 500 }}>Kam ste išli?</div>
                        </div>
                        <button className="btn ghost" onClick={() => setAdding(false)}
                            style={{ padding: 6, gap: 4, fontSize: 12.5, color: 'var(--muted)' }}>
                            {cloneElement(Icons.back, { style: { width: 16, height: 16 } })} späť
                        </button>
                    </div>
                    <div className="eyebrow" style={{ marginBottom: 8 }}>mesto</div>
                    <input value={newCity} onChange={e => setNewCity(e.target.value)} autoFocus
                        placeholder="napr. Barcelona"
                        style={{ ...mInputBase, marginBottom: 14 }} />
                    <div className="eyebrow" style={{ marginBottom: 8 }}>krajina</div>
                    <input value={newCountry} onChange={e => setNewCountry(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveNew(); }}
                        placeholder="napr. Španielsko"
                        style={{ ...mInputBase, marginBottom: 18 }} />
                    <button className="btn primary" disabled={!newCity.trim()} onClick={saveNew}
                        style={{
                            width: '100%', padding: '14px', fontSize: 15,
                            opacity: newCity.trim() ? 1 : 0.45, cursor: newCity.trim() ? 'pointer' : 'default',
                        }}>
                        použiť toto miesto
                    </button>
                </>
            )}
        </Sheet>
    );
};

/* ---------- Hľadanie momentov ---------- */
export function MomentSearch({ onBack, navigate }) {
    const { moments } = useStore();
    const [q, setQ] = useState('');

    const query = q.trim().toLowerCase();
    const results = moments.filter(m =>
        !query ||
        m.title.toLowerCase().includes(query) ||
        (m.place || '').toLowerCase().includes(query) ||
        (m.description || '').toLowerCase().includes(query)
    );

    const suggestions = ['Viedeň', 'Tatry', 'výročie', 'koncert'];

    return (
        <div className="col" style={{ height: '100%', background: 'var(--paper)' }}>
            {/* Hlavička s vyhľadávaním */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '16px 16px 12px',
            }}>
                <button className="icon-btn" onClick={onBack} style={{ flexShrink: 0 }}>{Icons.back}</button>
                <div style={{ position: 'relative', flex: 1 }}>
                    <span style={{
                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        color: 'var(--muted-2)', display: 'grid', placeItems: 'center',
                    }}>{cloneElement(Icons.search, { style: { width: 17, height: 17 } })}</span>
                    <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                        placeholder="hľadaj v momentoch…"
                        style={{ ...mInputBase, paddingLeft: 38, paddingRight: q ? 38 : 14, borderRadius: 999 }} />
                    {q && (
                        <button onClick={() => setQ('')} style={{
                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-2)',
                            display: 'grid', placeItems: 'center', padding: 4,
                        }}>{cloneElement(Icons.close, { style: { width: 15, height: 15 } })}</button>
                    )}
                </div>
            </div>

            <div className="scroll" style={{ flex: 1, paddingTop: 4 }}>
                {/* Návrhy pri prázdnom hľadaní */}
                {!query && (
                    <div style={{ marginBottom: 18 }}>
                        <div className="eyebrow" style={{ marginBottom: 10 }}>skús hľadať</div>
                        <div className="row gap-6 wrap">
                            {suggestions.map(s => (
                                <button key={s} onClick={() => setQ(s)}
                                    className="chip" style={{ cursor: 'pointer', border: 'none', font: 'inherit' }}>
                                    {cloneElement(Icons.search, { style: { width: 12, height: 12, marginRight: 4 } })}{s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="row between" style={{ marginBottom: 12, alignItems: 'baseline' }}>
                    <div className="eyebrow">{results.length} výsledkov</div>
                </div>

                {results.length === 0 ? (
                    <div className="col" style={{ alignItems: 'center', gap: 6, padding: '40px 0' }}>
                        <div className="handwritten" style={{ fontSize: 22, color: 'var(--muted)' }}>
                            nič sme nenašli
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted-2)' }}>skús iné slovo</div>
                    </div>
                ) : (
                    <div className="col gap-10">
                        {results.map(m => (
                            <button key={m.id} className="card flush" onClick={() => navigate('moment:' + m.slug)}
                                style={{
                                    display: 'flex', gap: 12, padding: 10, textAlign: 'left',
                                    width: '100%', border: '0.5px solid var(--line)', cursor: 'pointer',
                                    background: 'var(--surface)', font: 'inherit', color: 'inherit',
                                    alignItems: 'center',
                                }}>
                                <Photo seed={m.seed} url={coverSrc(m)}
                                    style={{ width: 64, height: 64, borderRadius: 12, flexShrink: 0 }} />
                                <div className="col grow" style={{ minWidth: 0, gap: 3 }}>
                                    <div style={{ fontSize: 14.5, fontWeight: 500 }}>{m.title}</div>
                                    <div className="eyebrow" style={{ textTransform: 'none', letterSpacing: 0 }}>
                                        {m.date_short} · 📍 {m.place_short}
                                    </div>
                                </div>
                                <span style={{ color: 'var(--muted-2)', flexShrink: 0 }}>
                                    {cloneElement(Icons.arrow, { style: { width: 18, height: 18 } })}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
