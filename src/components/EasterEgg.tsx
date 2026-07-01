import {useEffect, useMemo} from 'react';
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';

interface Particle {
    id: number;
    x: number;
    y: number;
    rotation: number;
    duration: number;
    delay: number;
    type: 'icon' | 'confetti';
    emoji?: string;
    color?: string;
}

interface LogoParticle {
    id: string;
    x: number;
    duration: number;
    delay: number;
}

interface EasterEggProps {
    active: boolean;
    onComplete: () => void;
}

// Scientific emojis and symbols
const scientificIcons = [
    '🔬', // Microscope
    '🧪', // Test tube
    '⚛️', // Atom
    '🧬', // DNA
    '🔭', // Telescope
    '🌌', // Milky way
    '🧫', // Petri dish
    '⚗️', // Alembic
    '🦠', // Microbe
    '💉', // Syringe
    '🩺', // Stethoscope
    '🧮', // Abacus
    '📊', // Bar chart
    '📈', // Chart increasing
    '📉', // Chart decreasing
    '📐', // Triangular ruler
    '🧲', // Magnet
    '💡', // Light bulb
    '☄️', // Comet
    '🚀', // Rocket
    '🛰️', // Satellite
    '🧑‍🔬', // Scientist
    '👨‍🔬', // Male scientist
    '👩‍🔬', // Female scientist
    '🧑‍💻', // Technologist
    '📡', // Satellite antenna
    '💾', // Floppy disk
    '💿', // Optical disk
    '🖥️', // Desktop computer
    '🧠', // Brain
    '🫀', // Anatomical heart
    '🫁', // Lungs
    '🦴', // Bone
];
const confettiColors = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#dbeafe'];

// Helper function to shuffle an array
const shuffleArray = <T, >(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
};

// Helper function to generate particles
const generateParticles = (count: number): Particle[] => {
    // Shuffle emojis to ensure variety
    const shuffledEmojis = shuffleArray(scientificIcons);
    const shuffledColors = shuffleArray(confettiColors);

    // Calculate how many emojis and confetti we need
    const confettiCount = Math.floor(count / 3);
    const emojiCount = count - confettiCount;

    // Create emoji particles (each emoji appears at least once)
    const emojiParticles: Particle[] = [];
    for (let i = 0; i < emojiCount; i++) {
        emojiParticles.push({
            id: i,
            x: Math.random() * 100,
            y: -10,
            rotation: Math.random() * 360,
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 0.5,
            type: 'icon' as const,
            emoji: shuffledEmojis[i % shuffledEmojis.length],
            color: undefined,
        });
    }

    // Create confetti particles
    const confettiParticles: Particle[] = [];
    for (let i = 0; i < confettiCount; i++) {
        confettiParticles.push({
            id: emojiCount + i,
            x: Math.random() * 100,
            y: -10,
            rotation: Math.random() * 360,
            duration: 3 + Math.random() * 2,
            delay: Math.random() * 0.5,
            type: 'confetti' as const,
            emoji: undefined,
            color: shuffledColors[i % shuffledColors.length],
        });
    }

    // Combine and shuffle all particles for random distribution
    return shuffleArray([...emojiParticles, ...confettiParticles]);
};

const generateLogoParticles = (count: number): LogoParticle[] => {
    return Array.from({length: count}, (_, i) => ({
        id: `logo-${i}`,
        x: (i + 1) * 12,
        duration: 3.5 + Math.random(),
        delay: Math.random() * 0.3,
    }));
};

export const EasterEgg = ({active, onComplete}: EasterEggProps) => {
    // Regenerated each time the animation is (re)activated
    const particles = useMemo<Particle[]>(() => active ? generateParticles(100) : [], [active]);
    const logoParticles = useMemo<LogoParticle[]>(() => active ? generateLogoParticles(5) : [], [active]);

    useEffect(() => {
        if (!active) return;

        // Clear after animation
        const timer = setTimeout(() => {
            onComplete();
        }, 5000);

        return () => {
            clearTimeout(timer);
        };
    }, [active, onComplete]);

    if (!active) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
            {particles.map((particle) => (
                <div
                    key={particle.id}
                    className="absolute animate-fall"
                    style={{
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        animationDuration: `${particle.duration}s`,
                        animationDelay: `${particle.delay}s`,
                        transform: `rotate(${particle.rotation}deg)`,
                    }}
                >
                    {particle.type === 'icon' && (
                        <span className="text-2xl sm:text-3xl md:text-4xl opacity-90 animate-spin-slow">
              {particle.emoji}
            </span>
                    )}
                    {particle.type === 'confetti' && (
                        <div
                            className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm animate-spin"
                            style={{backgroundColor: particle.color}}
                        />
                    )}
                </div>
            ))}

            {/* EOSC Logo rain */}
            {logoParticles.map((logo) => (
                <div
                    key={logo.id}
                    className="absolute animate-fall"
                    style={{
                        left: `${logo.x}%`,
                        top: '-10%',
                        animationDuration: `${logo.duration}s`,
                        animationDelay: `${logo.delay}s`,
                    }}
                >
                    <img
                        src={dataCommonsIconBlue}
                        alt=""
                        className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 opacity-70 animate-spin-slow"
                    />
                </div>
            ))}
        </div>
    );
};

