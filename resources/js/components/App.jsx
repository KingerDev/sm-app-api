import { useState } from 'react';
import { useStore } from '../store';
import { TabBar } from './shell';
import Login from '../screens/Login';
import Home from '../screens/Home';
import Bucket from '../screens/Bucket';
import BucketAdd from '../screens/BucketAdd';
import Gallery from '../screens/Gallery';
import MapScreen from '../screens/MapScreen';
import Stats from '../screens/Stats';
import MomentDetail from '../screens/MomentDetail';
import { MomentForm, MomentSearch } from '../screens/MomentForm';
import Momentka from '../screens/Momentka';
import Calendar from '../screens/Calendar';
import CapsuleScreen from '../screens/Capsule';
import Wrapped, { monthlySlidesFor } from '../screens/Wrapped';

const TABS = ['home', 'bucket', 'gallery', 'map', 'stats'];

export default function App() {
    const { user, booting, ready, wrapped } = useStore();
    const [tab, setTab] = useState('home');
    const [overlay, setOverlay] = useState(null);

    if (booting || (user && !ready)) {
        return (
            <div className="app-frame">
                <div className="loading-screen"><div className="pulse-heart">♥</div></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="app-frame">
                <Login />
            </div>
        );
    }

    const navigate = (target) => {
        if (TABS.includes(target)) {
            setOverlay(null);
            setTab(target);
        } else {
            setOverlay(target);
        }
    };

    const close = () => setOverlay(null);

    const renderTab = () => {
        switch (tab) {
            case 'home': return <Home navigate={navigate} key="home" />;
            case 'bucket': return <Bucket navigate={navigate} key="bucket" />;
            case 'gallery': return <Gallery navigate={navigate} key="gallery" />;
            case 'map': return <MapScreen navigate={navigate} key="map" />;
            case 'stats': return <Stats navigate={navigate} key="stats" />;
            default: return null;
        }
    };

    const renderOverlay = () => {
        if (!overlay) return null;

        if (overlay.startsWith('moment:')) {
            // „moment:slug?photo=12" — Domov ňou otvára rozhovor pri konkrétnej fotke
            const [slug, query] = overlay.slice(7).split('?');
            const photo = new URLSearchParams(query || '').get('photo');

            return <MomentDetail slug={slug} photo={photo} onBack={close} navigate={navigate} />;
        }
        if (overlay === 'moment-add') {
            return <MomentForm onBack={close} navigate={navigate} />;
        }
        if (overlay.startsWith('moment-edit:')) {
            return <MomentForm slug={overlay.slice(12)} onBack={close} navigate={navigate} />;
        }
        if (overlay === 'momentka-add') {
            return <Momentka onBack={close} />;
        }
        if (overlay.startsWith('momentka:')) {
            return <Momentka id={overlay.slice(9)} onBack={close} />;
        }
        if (overlay === 'moment-search') {
            return <MomentSearch onBack={close} navigate={navigate} />;
        }
        if (overlay === 'bucket-add') {
            return <BucketAdd onBack={close} />;
        }
        if (overlay === 'calendar') {
            return <Calendar onBack={close} navigate={navigate} />;
        }
        if (overlay === 'capsule') {
            return <CapsuleScreen onBack={close} />;
        }
        if (overlay === 'wrapped') {
            return <Wrapped onExit={close} />;
        }
        if (overlay.startsWith('wrapped-month:')) {
            const m = wrapped.find(mm => mm.wrapped_id === overlay.slice(14));
            if (!m) return null;
            return <Wrapped slides={monthlySlidesFor(m)} kind="monthly" onExit={close} />;
        }
        return null;
    };

    const overlayContent = renderOverlay();
    const isStory = overlay === 'wrapped' || overlay?.startsWith('wrapped-month:');

    return (
        <div className="app-frame">
            <div className="screen">
                <div className="screen-content" key={tab}>
                    {renderTab()}
                </div>
                <TabBar active={tab} onChange={navigate} />

                {overlayContent && (isStory
                    ? overlayContent
                    : <div className="overlay">{overlayContent}</div>
                )}
            </div>
        </div>
    );
}
