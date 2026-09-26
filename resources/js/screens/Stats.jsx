// Štatistiky — mesačné Wrapped, ročný Wrapped CTA, stat grid + akčný sheet (podľa design/hifi-stats.jsx)
import { cloneElement, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { AppHeader, Icons, Sheet } from '../components/shell';
import Mascot from '../components/Mascot';
import { durationSk } from '../lib/dates';
import { SEASON_THEMES } from './Wrapped';

export default function Stats({ navigate }) {
    const { stats, settings, wrapped } = useStore();
    const [menu, setMenu] = useState(false);

    const year = new Date().getFullYear();
    const topMonth = stats?.top_month;

    return (
        <>
            <AppHeader
                eyebrow="náš vzťah v číslach"
                title="prehľad"
                right={<button className={'icon-btn' + (menu ? ' green' : '')} onClick={() => setMenu(true)}>{Icons.more}</button>}
            />
            <div className="scroll">
                {/* Mesačné Wrapped — horizontálny carousel */}
                <div className="row between" style={{ marginBottom: 10 }}>
                    <div className="handwritten" style={{ fontSize: 22 }}>Mesačné Wrapped</div>
                    <span className="eyebrow">každý mesiac</span>
                </div>
                <div style={{ margin: '0 -20px 22px', overflowX: 'auto', paddingLeft: 20 }}>
                    <div className="row gap-10" style={{ width: 'max-content', paddingRight: 20 }}>
                        {wrapped.map(m => (
                            <button key={m.wrapped_id}
                                onClick={() => navigate('wrapped-month:' + m.wrapped_id)}
                                style={{
                                    width: 140, flexShrink: 0,
                                    padding: 0, border: '0.5px solid var(--line)',
                                    borderRadius: 'var(--r-md)', overflow: 'hidden',
                                    cursor: 'pointer', font: 'inherit',
                                    background: SEASON_THEMES[m.season] || SEASON_THEMES.winter,
                                    color: 'var(--paper)',
                                    position: 'relative',
                                    textAlign: 'left',
                                }}>
                                <div style={{ padding: 14, minHeight: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                        {m.short} {(m.label.split(' ')[1] || '').slice(2)}
                                    </div>
                                    <div className="serif" style={{ fontSize: 28, lineHeight: 1, fontWeight: 600 }}>
                                        {m.month}
                                    </div>
                                    <div className="num" style={{ fontSize: 32, lineHeight: 0.9, marginTop: 'auto', color: 'var(--paper)' }}>
                                        {m.photos_count}
                                    </div>
                                    <div style={{ fontSize: 10.5, opacity: 0.85 }}>
                                        {m.photos_count === 1 ? 'fotka' : 'fotiek'} · ťukni
                                    </div>
                                    {m.is_top && (
                                        <div style={{
                                            position: 'absolute', top: 10, right: 10,
                                            fontSize: 9, fontWeight: 600, letterSpacing: 0.5,
                                            background: 'var(--paper)', color: 'var(--green-deep)',
                                            padding: '3px 8px', borderRadius: 999,
                                            textTransform: 'uppercase',
                                        }}>top mesiac</div>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Ročný Wrapped CTA */}
                <div className="row between" style={{ marginBottom: 10 }}>
                    <div className="handwritten" style={{ fontSize: 22 }}>Ročný Wrapped</div>
                    <span className="eyebrow">každý január</span>
                </div>
                <button className="card hero" style={{
                    padding: 20, width: '100%', textAlign: 'left',
                    cursor: 'pointer', display: 'block', font: 'inherit', color: 'var(--paper)',
                    background: 'linear-gradient(135deg, var(--green) 0%, var(--green-deep) 100%)',
                }}
                    onClick={() => navigate('wrapped')}>
                    <div className="row between">
                        <div className="eyebrow" style={{ color: 'rgba(255,255,255,0.7)' }}>{year} · pre nás dvoch</div>
                        <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.15)',
                            display: 'grid', placeItems: 'center',
                        }}>{Icons.play}</div>
                    </div>
                    <div className="serif" style={{ fontSize: 48, fontWeight: 600, marginTop: 12, lineHeight: 0.95 }}>
                        Wrapped
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.85, marginTop: 6 }}>
                        6 slidov o celom roku — vychádza každý január
                    </div>
                    <div className="row gap-6" style={{ marginTop: 14 }}>
                        {[1, 1, 1, 1, 1, 1].map((_, i) => (
                            <div key={i} className="grow" style={{
                                height: 3, borderRadius: 2,
                                background: 'rgba(255,255,255,0.35)',
                            }} />
                        ))}
                    </div>
                </button>

                {/* Stat grid */}
                <div style={{ marginTop: 22 }}>
                    <div className="eyebrow" style={{ marginBottom: 10 }}>v číslach</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <StatCard
                            big
                            num={(stats?.days_together ?? 0).toLocaleString('sk-SK')}
                            label="dní spolu"
                            sub={settings.together_since ? durationSk(settings.together_since) : undefined}
                            tint
                        />
                        <StatCard
                            num={topMonth ? topMonth.short : '—'}
                            label="mesiac s najviac fotkami"
                            sub={topMonth ? `${topMonth.photos} fotiek` : 'zatiaľ bez fotiek'}
                        />
                        <StatCard num={(stats?.photos ?? 0).toLocaleString('sk-SK')} label="fotiek" />
                        <StatCard num={stats?.countries ?? 0} label="krajín" sub={`${stats?.cities ?? 0} miest`} />
                        <StatCard
                            num={`${stats?.bucket_done ?? 0}/${stats?.bucket_total ?? 0}`}
                            label="bucket list"
                            sub={stats?.bucket_total ? `${Math.round(stats.bucket_done / stats.bucket_total * 100)}% hotových` : undefined}
                        />
                    </div>
                </div>

                <div className="handwritten" style={{ marginTop: 22, textAlign: 'center', fontSize: 16 }}>
                    ✦ počíta sa samo z vašich momentov · vždy aktuálne
                </div>
            </div>

            {menu && <StatsMenu onClose={() => setMenu(false)} navigate={navigate} />}
        </>
    );
}

/* ---- Akčný sheet (tri bodky) ---- */
const MASCOTS = [
    { id: 'pebbles', label: 'kamienky' },
    { id: 'sprouts', label: 'klíčky' },
    { id: 'orbits', label: 'kruhy' },
];

function StatsMenu({ onClose, navigate }) {
    const { stats, settings, logout, refresh } = useStore();
    const current = settings.mascot_variant || 'pebbles';

    const rowStyle = {
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 4px', width: '100%', textAlign: 'left',
        background: 'none', border: 'none', font: 'inherit', cursor: 'pointer',
        color: 'var(--ink)', fontSize: 15,
    };
    const ic = (icon, color = 'var(--muted)') => (
        <span style={{ color, display: 'grid', placeItems: 'center', width: 22 }}>
            {cloneElement(icon, { style: { width: 20, height: 20 } })}
        </span>
    );

    const share = async () => {
        const text = `S+M · ${(stats?.days_together ?? 0).toLocaleString('sk-SK')} dní spolu · ` +
            `${(stats?.photos ?? 0).toLocaleString('sk-SK')} fotiek · ` +
            `${stats?.countries ?? 0} krajín, ${stats?.cities ?? 0} miest · ` +
            `bucket list ${stats?.bucket_done ?? 0}/${stats?.bucket_total ?? 0} ♡`;
        try {
            if (navigator.share) {
                await navigator.share({ text });
            } else {
                await navigator.clipboard.writeText(text);
                alert('Štatistiky skopírované do schránky.');
            }
        } catch { /* zdieľanie zrušené */ }
        onClose();
    };

    const setMascot = async (value) => {
        await api.patch('/settings', { key: 'mascot_variant', value });
        await refresh('settings');
    };

    const actions = [
        { icon: Icons.play, label: 'Prehrať ročný Wrapped', onClick: () => { onClose(); navigate('wrapped'); } },
        { icon: Icons.share, label: 'Zdieľať štatistiky', onClick: share },
        { icon: Icons.download, label: 'Stiahnuť ako obrázok', onClick: () => onClose() },
        { icon: Icons.sparkle, label: 'Notifikácie o Wrapped', onClick: () => onClose() },
    ];

    return (
        <Sheet onClose={onClose}>
            <div className="eyebrow" style={{ padding: '6px 4px 2px' }}>štatistiky S+M</div>
            {actions.map(a => (
                <button key={a.label} style={rowStyle} onClick={a.onClick}>
                    {ic(a.icon)}{a.label}
                </button>
            ))}

            {/* Maskot */}
            <div className="eyebrow" style={{ padding: '14px 4px 10px', borderTop: '0.5px solid var(--line)', marginTop: 6 }}>
                maskot
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {MASCOTS.map(m => {
                    const active = current === m.id;
                    return (
                        <button key={m.id} onClick={() => setMascot(m.id)}
                            style={{
                                padding: '12px 6px 10px', borderRadius: 14, cursor: 'pointer', font: 'inherit',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                background: active ? 'var(--green-soft)' : 'var(--surface)',
                                border: '0.5px solid ' + (active ? 'var(--green)' : 'var(--line)'),
                                color: active ? 'var(--green-deep)' : 'var(--ink-soft)',
                            }}>
                            <Mascot variant={m.id} size={36} animated={false} />
                            <span style={{ fontSize: 11.5, fontWeight: active ? 600 : 400 }}>{m.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Odhlásenie */}
            <button style={{ ...rowStyle, color: 'var(--accent)', borderTop: '0.5px solid var(--line)', marginTop: 14 }}
                onClick={async () => { onClose(); await logout(); }}>
                {ic(Icons.logout, 'var(--accent)')}odhlásiť sa
            </button>
        </Sheet>
    );
}

const StatCard = ({ num, label, sub, big, tint }) => (
    <div className={`card ${tint ? 'tint' : ''}`}
        style={{
            padding: 16, textAlign: 'left',
            gridColumn: big ? 'span 2' : 'auto',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            minHeight: big ? 'auto' : 110,
            position: 'relative',
            border: '0.5px solid ' + (tint ? 'var(--green-line)' : 'var(--line)'),
        }}>
        <div className="num" style={{
            fontSize: big ? 72 : (String(num).length > 4 ? 28 : 36),
            color: 'var(--green)',
            lineHeight: 0.95,
        }}>{num}</div>
        <div style={{ marginTop: big ? 6 : 8 }}>
            <div className="eyebrow" style={{ fontSize: 10 }}>{label}</div>
            {sub && <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 3 }}>{sub}</div>}
        </div>
    </div>
);
