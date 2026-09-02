// Editor fotky pred nahratím — orez, otočenie, prevrátenie (Cropper.js)
import { cloneElement, useEffect, useRef, useState } from 'react';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { Icons } from './shell';

const ASPECTS = [
    { label: 'voľný', value: NaN },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '16:9', value: 16 / 9 },
];

export default function PhotoEditor({ file, onCancel, onSave }) {
    const imgRef = useRef(null);
    const cropperRef = useRef(null);
    const [url] = useState(() => URL.createObjectURL(file));
    const [aspect, setAspect] = useState(NaN);
    const [flipped, setFlipped] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const cropper = new Cropper(imgRef.current, {
            viewMode: 1,
            autoCropArea: 1,
            background: false,
            responsive: true,
            checkOrientation: true,
        });
        cropperRef.current = cropper;
        return () => {
            cropper.destroy();
            URL.revokeObjectURL(url);
        };
    }, [url]);

    const setRatio = (value) => {
        setAspect(value);
        cropperRef.current?.setAspectRatio(value);
    };

    const rotate = (deg) => cropperRef.current?.rotate(deg);
    const flip = () => {
        const next = !flipped;
        setFlipped(next);
        cropperRef.current?.scaleX(next ? -1 : 1);
    };
    const reset = () => {
        setAspect(NaN);
        setFlipped(false);
        cropperRef.current?.reset();
        cropperRef.current?.setAspectRatio(NaN);
    };

    // Nedotknutá fotka ide na server v origináli — prekódovanie cez canvas by
    // ju len zbytočne zhoršilo (a zahodilo EXIF), keď z nej používateľ nič nebral.
    const untouched = () => {
        const cropper = cropperRef.current;
        if (!cropper) return false;
        const { rotate, scaleX, scaleY } = cropper.getData();
        if (rotate || scaleX === -1 || scaleY === -1) return false;
        const { width, height } = cropper.getImageData();
        const crop = cropper.getCropBoxData();
        const canvasBox = cropper.getCanvasData();

        return Math.abs(crop.width - canvasBox.width) < 1
            && Math.abs(crop.height - canvasBox.height) < 1
            && width > 0 && height > 0;
    };

    const save = () => {
        if (busy) return;
        setBusy(true);
        if (untouched()) { onSave(file); return; }
        const canvas = cropperRef.current?.getCroppedCanvas({
            maxWidth: 4096, maxHeight: 4096,
            imageSmoothingQuality: 'high',
        });
        if (!canvas) { setBusy(false); return; }
        canvas.toBlob((blob) => {
            if (!blob) { setBusy(false); return; }
            const name = file.name.replace(/\.\w+$/, '') + '-upravene.jpg';
            onSave(new File([blob], name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 1);
    };

    const toolBtn = {
        background: 'rgba(250,250,247,0.12)', border: 'none', color: 'var(--paper)',
        backdropFilter: 'blur(6px)',
    };

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 70,
            background: 'rgba(12, 16, 13, 0.97)',
            display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 180ms ease both',
        }}>
            {/* Horná lišta */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
                <span className="eyebrow" style={{ color: 'rgba(255,255,255,0.75)' }}>uprav fotku</span>
                <button className="icon-btn" style={toolBtn} onClick={onCancel}>{Icons.close}</button>
            </div>

            {/* Plátno editora */}
            <div style={{ flex: 1, minHeight: 0, padding: '0 12px' }}>
                <img ref={imgRef} src={url} alt=""
                    style={{ display: 'block', maxWidth: '100%' }} />
            </div>

            {/* Pomery strán */}
            <div className="row gap-6" style={{ padding: '12px 16px 0', justifyContent: 'center', flexWrap: 'wrap' }}>
                {ASPECTS.map(a => (
                    <button key={a.label} onClick={() => setRatio(a.value)}
                        className="chip"
                        style={{
                            cursor: 'pointer', border: 'none', font: 'inherit',
                            background: Object.is(aspect, a.value) ? 'var(--paper)' : 'rgba(250,250,247,0.14)',
                            color: Object.is(aspect, a.value) ? 'var(--green-deep)' : 'var(--paper)',
                        }}>{a.label}</button>
                ))}
            </div>

            {/* Nástroje + uložiť */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px calc(18px + var(--safe-bottom))', gap: 8,
            }}>
                <div className="row gap-8">
                    <button className="icon-btn" style={toolBtn} onClick={() => rotate(-90)} title="otočiť doľava">
                        <svg viewBox="0 0 24 24" className="ico" style={{ width: 18, height: 18 }}>
                            <path d="M4 10a8 8 0 1 1 2.3 6.3M4 10V4m0 6h6" />
                        </svg>
                    </button>
                    <button className="icon-btn" style={toolBtn} onClick={() => rotate(90)} title="otočiť doprava">
                        <svg viewBox="0 0 24 24" className="ico" style={{ width: 18, height: 18 }}>
                            <path d="M20 10a8 8 0 1 0-2.3 6.3M20 10V4m0 6h-6" />
                        </svg>
                    </button>
                    <button className="icon-btn" style={toolBtn} onClick={flip} title="prevrátiť">
                        <svg viewBox="0 0 24 24" className="ico" style={{ width: 18, height: 18 }}>
                            <path d="M12 3v18M8 7l-5 5 5 5M16 7l5 5-5 5" />
                        </svg>
                    </button>
                    <button className="btn ghost" onClick={reset}
                        style={{ padding: '8px 10px', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                        reset
                    </button>
                </div>
                <button className="btn invert" onClick={save} disabled={busy}
                    style={{ padding: '10px 20px', fontSize: 13.5 }}>
                    {busy ? 'ukladám…' : <>{cloneElement(Icons.check, { style: { width: 16, height: 16 } })} hotovo</>}
                </button>
            </div>
        </div>
    );
}
