// Zdieľané shell komponenty (podľa design/hifi-shell.jsx)
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const ico = (paths) => <svg viewBox="0 0 24 24" className="ico">{paths}</svg>;

export const Icons = {
    home: ico(<path d="M3 11.5l9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6.5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1V21H4a1 1 0 0 1-1-1z" />),
    bucket: ico(<><path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>),
    img: ico(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="10.5" r="1.4" /><path d="M3 17l5.5-5 5 4.5L17 12l4 4" /></>),
    map: ico(<><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></>),
    chart: ico(<><path d="M4 20h17" /><rect x="5" y="13" width="3.5" height="6" rx="1" /><rect x="10.5" y="9" width="3.5" height="10" rx="1" /><rect x="16" y="5" width="3.5" height="14" rx="1" /></>),
    plus: ico(<path d="M12 5v14M5 12h14" />),
    back: ico(<path d="M15 5l-7 7 7 7" />),
    search: ico(<><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.4-4.4" /></>),
    filter: ico(<path d="M5 6h14M8 12h8M11 18h2" />),
    pin: ico(<><path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>),
    heart: ico(<path d="M12 20.5s-7.2-4.5-9.5-9.2A5.4 5.4 0 0 1 12 5a5.4 5.4 0 0 1 9.5 6.3C19.2 16 12 20.5 12 20.5z" />),
    heartFill: <svg viewBox="0 0 24 24" className="ico" style={{ fill: 'currentColor', stroke: 'currentColor' }}><path d="M12 20.5s-7.2-4.5-9.5-9.2A5.4 5.4 0 0 1 12 5a5.4 5.4 0 0 1 9.5 6.3C19.2 16 12 20.5 12 20.5z" /></svg>,
    cal: ico(<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>),
    more: ico(<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>),
    play: <svg viewBox="0 0 24 24" className="ico" style={{ fill: 'currentColor', stroke: 'none' }}><path d="M7 4.5v15a1 1 0 0 0 1.5.87l13-7.5a1 1 0 0 0 0-1.74l-13-7.5A1 1 0 0 0 7 4.5z" /></svg>,
    sparkle: ico(<><path d="M12 4l1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5z" /><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></>),
    arrow: ico(<><path d="M5 12h14M13 6l6 6-6 6" /></>),
    arrowDown: ico(<path d="M6 9l6 6 6-6" />),
    close: ico(<path d="M6 6l12 12M18 6L6 18" />),
    check: ico(<path d="M5 13l4 4L19 7" />),
    edit: ico(<><path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17.5z" /><path d="M13.5 6.5l4 4" /></>),
    chat: ico(<path d="M20 14.5a2 2 0 0 1-2 2H8l-4 3.5v-14a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />),
    trash: ico(<><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></>),
    share: ico(<><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" /></>),
    download: ico(<><path d="M12 4v11M7 11l5 5 5-5" /><path d="M5 20h14" /></>),
    send: ico(<path d="M4 12l16-7-7 16-2.5-6.5z" />),
    loc: ico(<path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z M12 9 m-2.5 0 a2.5 2.5 0 1 1 5 0 a2.5 2.5 0 1 1 -5 0" />),
    globe: ico(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
    logout: ico(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>),
    mic: ico(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
    camera: ico(<><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>),
};

export const TabBar = ({ active, onChange }) => {
    const tabs = [
        { id: 'home', icon: Icons.home, label: 'Domov' },
        { id: 'bucket', icon: Icons.bucket, label: 'Bucket' },
        { id: 'gallery', icon: Icons.img, label: 'Galéria' },
        { id: 'map', icon: Icons.map, label: 'Mapa' },
        { id: 'stats', icon: Icons.chart, label: 'Štats' },
    ];
    return (
        <div className="tabbar">
            {tabs.map(t => (
                <button key={t.id} className={`tab ${active === t.id ? 'active' : ''}`}
                    onClick={() => onChange(t.id)}>
                    {t.icon}
                    <span>{t.label}</span>
                </button>
            ))}
        </div>
    );
};

export const AppHeader = ({ eyebrow, title, titleGreen, right, children }) => (
    <div className="app-header">
        <div className="col" style={{ minWidth: 0 }}>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h1 className={titleGreen ? 'green' : ''}>{title}</h1>
            {children}
        </div>
        {right && <div className="actions">{right}</div>}
    </div>
);

// ---- Fotky ----
// Reálna fotka (url) > picsum placeholder podľa seed > gradient.
export const PALETTES = {
    vienna: ['#d6c8a4', '#7a6b4a'],
    tatry: ['#cfd9d6', '#476859'],
    prague: ['#e2d2bc', '#7a5b3e'],
    tromso: ['#c4d5e0', '#3b5a72'],
    home: ['#e8dcc2', '#9c815f'],
    picnic: ['#c9d5b1', '#5b7240'],
    beach: ['#e8d8be', '#a98c5f'],
    forest: ['#bccfb6', '#3f5a3c'],
    cafe: ['#e0c9aa', '#8a6843'],
    desk: ['#dad2bf', '#6c5e44'],
    road: ['#c8c2b1', '#534b3a'],
    party: ['#d8c2c8', '#7a4b58'],
    ski: ['#dbe4e8', '#4a6878'],
    city: ['#cfc3a8', '#6a5840'],
    default: ['#c2d4c8', '#5a7062'],
};

// Titulná fotka momentu/kapsuly — preferuje uložený výrez z editora (cover_*),
// inak originál. photos[0] je vždy cover (API radí is_cover prvú).
export const coverSrc = (entity, { full = false } = {}) => {
    const p = entity?.photos?.[0];
    if (!p) return undefined;
    return full
        ? (p.cover_url || p.url)
        : (p.cover_thumb_url || p.thumb_url || p.url);
};

export const photoUrl = ({ url, seed = 'default', index = 0, w = 600, h = 400 }) => {
    if (url) return url;
    return `https://picsum.photos/seed/sm-${seed}-${index}/${Math.round(w)}/${Math.round(h)}`;
};

export const Photo = ({ url, seed = 'default', index = 0, label, fit, className = '', style = {}, children, ...rest }) => {
    const pal = PALETTES[seed] || PALETTES.default;
    const src = photoUrl({ url, seed, index, w: style.width || 600, h: style.height || 400 });

    // fit="contain" — celá fotka viditeľná, prázdne okraje vyplní rozmazaná verzia tej istej fotky
    if (fit === 'contain') {
        return (
            <div className={`photo ${className}`}
                style={{ ...style, backgroundImage: 'none', background: 'var(--line-soft)' }}
                {...rest}>
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center',
                    filter: 'blur(14px) saturate(1.1)', transform: 'scale(1.15)', opacity: 0.6,
                }} />
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${src})`, backgroundSize: 'contain',
                    backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
                }} />
                {children}
                {label && <div className="photo-label">{label}</div>}
            </div>
        );
    }

    return (
        <div className={`photo empty ${className}`}
            style={{ '--ph-c1': pal[0], '--ph-c2': pal[1], ...style, backgroundImage: `url(${src})` }}
            {...rest}>
            {children}
            {label && <div className="photo-label">{label}</div>}
        </div>
    );
};

export const ProgressBar = ({ value }) => (
    <div style={{ height: 4, borderRadius: 2, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, value * 100)}%`, height: '100%', background: 'var(--green)' }} />
    </div>
);

// ---- Bottom sheet ----
// Portál na .app-frame — sheet musí prekryť aj tab bar (screen-content má
// vlastný stacking context kvôli animácii, z-index by nestačil).
// Na mobile sa sheet zdvihne nad softvérovú klávesnicu (visualViewport).
export const Sheet = ({ onClose, children }) => {
    const [kb, setKb] = useState(0);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const update = () => {
            // výška klávesnice = layout viewport mínus viditeľný viewport
            setKb(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
        };
        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, []);

    return createPortal(
        <div className="sheet-backdrop" onClick={onClose}>
            <div className="sheet" onClick={(e) => e.stopPropagation()}
                style={kb > 0 ? {
                    marginBottom: kb,
                    maxHeight: `calc(100% - ${kb + 24}px)`,
                    transition: 'margin-bottom 150ms ease',
                } : undefined}>
                <div className="sheet-handle" />
                {children}
            </div>
        </div>,
        document.querySelector('.app-frame') || document.body
    );
};

// ---- Zdieľané inline štýly ----
export const iconBg = {
    width: 32, height: 32, borderRadius: 10,
    background: 'var(--green-soft)', color: 'var(--green)',
    display: 'grid', placeItems: 'center',
};
