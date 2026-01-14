import {useEffect, useLayoutEffect, useState} from 'react';
import {X} from 'lucide-react';


const CountdownButton = ({onClose, countdown}: { onClose: () => void, countdown: number }) => {
    const [isHovered, setIsHovered] = useState(false);
    const radius = 8;
    const circumference = 2 * Math.PI * radius;
    const progress = countdown / 8;
    const strokeDashoffset = circumference * (1 - progress);

    return (
        <button
            onClick={onClose}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            aria-label="Dismiss alpha disclaimer"
            className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-200 focus:outline-none"
        >
            <div className="relative w-6 h-6 flex items-center justify-center">
                {/* SVG for countdown circle */}
                <svg className="absolute w-full h-full" viewBox="0 0 20 20">
                    <circle
                        cx="10"
                        cy="10"
                        r={radius}
                        className="stroke-current text-gray-200"
                        strokeWidth="2"
                        fill="transparent"
                    />
                    <circle
                        cx="10"
                        cy="10"
                        r={radius}
                        className="stroke-current"
                        strokeWidth="2"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        transform="rotate(-90 10 10)"
                        style={{transition: 'stroke-dashoffset 1s linear'}}
                    />
                </svg>

                {/* Content: X on hover, countdown number otherwise */}
                <div
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${isHovered ? 'opacity-0 scale-50' : 'opacity-100 scale-100'}`}>
                    <span className="text-xs">{countdown}</span>
                </div>
                <div
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                    <X className="w-4 h-4"/>
                </div>
            </div>
        </button>
    );
};


export const AlphaDisclaimer = () => {
    const [visible, setVisible] = useState(false); // controls animation state
    const [mounted, setMounted] = useState(true);  // controls actual render removal after exit
    const [animReady, setAnimReady] = useState(false); // ensures initial off-screen state applied before animating in
    const [countdown, setCountdown] = useState(8);
    const [dismissed, setDismissed] = useState(false);

    // Check if we're in the browser
    const isBrowser = typeof window !== 'undefined';

    useEffect(() => {
        if (!isBrowser) return;
        const stored = sessionStorage.getItem('alphaDisclaimerDismissed');
        if (stored) {
            setDismissed(true);
        }
    }, [isBrowser]);

    useLayoutEffect(() => {
        if (isBrowser) {
            setAnimReady(true);
        }
    }, [isBrowser]);

    useEffect(() => {
        if (animReady && isBrowser) {
            requestAnimationFrame(() => setVisible(true));
        }
    }, [animReady, isBrowser]);

    const handleClose = () => {
        setVisible(false);
        if (isBrowser) {
            sessionStorage.setItem('alphaDisclaimerDismissed', 'true');
        }
        setDismissed(true);
    };

    useEffect(() => {
        if (visible) {
            setCountdown(8);
            const closeTimer = setTimeout(() => {
                handleClose();
            }, 8000);

            const countdownTimer = setInterval(() => {
                setCountdown(prev => (prev > 0 ? prev - 1 : 0));
            }, 1000);

            return () => {
                clearTimeout(closeTimer);
                clearInterval(countdownTimer);
            };
        }
    }, [visible]);

    const handleTransitionEnd = () => {
        if (!visible) {
            // After exit animation, unmount component completely
            setMounted(false);
        }
    };

    if (!mounted || dismissed) return null;

    const stateClasses = visible
        ? 'translate-x-0 opacity-100 pointer-events-auto'
        : 'translate-x-[120%] opacity-0 pointer-events-none';

    return (
        <div
            className={`fixed top-4 right-4 z-50 w-80 max-w-[90vw] transform transition-all duration-500 ease-out will-change-transform ${stateClasses}`}
            role="note"
            aria-label="Alpha stage disclaimer"
            onTransitionEnd={handleTransitionEnd}
        >
            <div
                className="relative overflow-hidden rounded-xl border border-blue-300 bg-white/95 backdrop-blur-md p-4 shadow-xl">
                <CountdownButton onClose={handleClose} countdown={countdown}/>
                <p className="text-xs leading-relaxed text-gray-700 pr-4">
                    <span className="font-semibold tracking-wide text-blue-700">NOTICE:</span> This service is in
                    an early alpha stage. Search results and metadata may be incomplete, outdated, or inaccurate. Please
                    verify critical information independently.
                </p>
            </div>
        </div>
    );
};
