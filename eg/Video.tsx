import {
    AbsoluteFill,
    interpolate,
    Sequence,
    spring,
    useCurrentFrame,
    useVideoConfig,
} from 'remotion';
import React from 'react';

// --- Data ---

const VIDEO_DATA = {
    title: 'NEXUS',
    tagline: 'The Future of Productivity',
    colors: {
        primary: '#3b82f6', // bright blue
        secondary: '#8b5cf6', // violet
        accent: '#06b6d4', // cyan
        background: '#0f172a', // slate 900
        text: '#ffffff',
        textSecondary: '#94a3b8', // slate 400
    },
    features: [
        {
            icon: '⚡',
            title: 'Lightning Fast',
            desc: 'Optimized for speed and efficiency at every step.',
        },
        {
            icon: '🔒',
            title: 'Secure by Design',
            desc: 'Enterprise-grade encryption protecting your data.',
        },
        {
            icon: '🌍',
            title: 'Global Scale',
            desc: 'Deploy instantly to edge regions worldwide.',
        },
    ],
    stats: [
        { label: 'Active Users', value: 50000, suffix: '+' },
        { label: 'Uptime', value: 99.99, suffix: '%' },
        { label: 'Global Regions', value: 120, suffix: '' },
    ],
};

// --- Components ---

const GradientBackground: React.FC = () => {
    const frame = useCurrentFrame();
    const { durationInFrames } = useVideoConfig();

    // Slowly shift the hue/gradient over time
    const offset = interpolate(frame, [0, durationInFrames], [0, 50]);
    const gradientAngle = interpolate(frame, [0, durationInFrames], [0, 180]);

    return (
        <AbsoluteFill
            style={{
                background: `linear-gradient(${135 + gradientAngle}deg, ${VIDEO_DATA.colors.background} 0%, #1e1b4b 100%)`, // slate 900 to indigo 900
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
            }}
        >
            <AbsoluteFill
                style={{
                    background: `radial-gradient(circle at ${50 + offset}% ${50 - offset}%, ${VIDEO_DATA.colors.primary}22 0%, transparent 60%)`,
                }}
            />
            <AbsoluteFill
                style={{
                    background: `radial-gradient(circle at ${20 - offset}% ${80 + offset}%, ${VIDEO_DATA.colors.secondary}22 0%, transparent 60%)`,
                }}
            />
        </AbsoluteFill>
    );
};

// Simple particle system for atmosphere
const Particles: React.FC = () => {
    useVideoConfig();
    const particles = React.useMemo(() => {
        return new Array(20).fill(0).map((_, i) => ({
            x: Math.random() * 100, // %
            y: Math.random() * 100, // %
            size: 2 + Math.random() * 4,
            opacity: 0.1 + Math.random() * 0.4,
            speed: 0.2 + Math.random() * 0.5,
        }));
    }, []);

    const frame = useCurrentFrame();

    return (
        <AbsoluteFill>
            {particles.map((p, i) => {
                const yPos = (p.y - (frame * p.speed) / 10) % 100;
                // wrap around
                const finalY = yPos < 0 ? 100 + yPos : yPos;

                return (
                    <div
                        key={i}
                        style={{
                            position: 'absolute',
                            left: `${p.x}%`,
                            top: `${finalY}%`,
                            width: p.size,
                            height: p.size,
                            borderRadius: '50%',
                            backgroundColor: VIDEO_DATA.colors.text,
                            opacity: p.opacity,
                        }}
                    />
                );
            })}
        </AbsoluteFill>
    );
};

const TitleScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const titleOpacity = interpolate(frame, [0, 20], [0, 1]);
    const titleScale = spring({
        frame,
        fps,
        config: { damping: 200, stiffness: 100 },
    });

    const taglineOpacity = interpolate(frame, [20, 50], [0, 1]);
    const taglineY = interpolate(frame, [20, 50], [20, 0], {
        extrapolateRight: 'clamp',
    });

    return (
        <AbsoluteFill
            style={{
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
            }}
        >
            <h1
                style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: 180,
                    fontWeight: 800,
                    color: VIDEO_DATA.colors.text,
                    margin: 0,
                    opacity: titleOpacity,
                    transform: `scale(${titleScale})`,
                    letterSpacing: '-5px',
                    background: `linear-gradient(to right, ${VIDEO_DATA.colors.primary}, ${VIDEO_DATA.colors.accent})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}
            >
                {VIDEO_DATA.title}
            </h1>
            <h2
                style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: 40,
                    fontWeight: 400,
                    color: VIDEO_DATA.colors.textSecondary,
                    marginTop: 20,
                    opacity: taglineOpacity,
                    transform: `translateY(${taglineY}px)`,
                }}
            >
                {VIDEO_DATA.tagline}
            </h2>
        </AbsoluteFill>
    );
};

const FeatureCard: React.FC<{
    feature: typeof VIDEO_DATA.features[0];
    index: number;
}> = ({ feature, index }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Staggered entrance
    const delay = index * 40; // reduced delay to fit 3 cards in 10s nicely
    const actualFrame = Math.max(0, frame - delay);

    const opacity = interpolate(actualFrame, [0, 20], [0, 1]);

    // Slide in from alternate sides
    const initialX = index % 2 === 0 ? -100 : 100;
    const x = spring({
        frame: actualFrame,
        fps,
        from: initialX,
        to: 0,
        config: { mass: 1, damping: 15 },
    });

    // If it hasn't started yet, don't render (optional optimization)
    if (frame < delay) return null;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(10px)',
                borderRadius: 20,
                padding: 40,
                marginBottom: 30,
                width: '70%',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                opacity,
                transform: `translateX(${x}px)`,
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
        >
            <div
                style={{
                    fontSize: 60,
                    marginRight: 40,
                    background: `linear-gradient(135deg, ${VIDEO_DATA.colors.primary}, ${VIDEO_DATA.colors.secondary})`,
                    width: 100,
                    height: 100,
                    borderRadius: 25,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    boxShadow: `0 0 20px ${VIDEO_DATA.colors.primary}66`,
                }}
            >
                {feature.icon}
            </div>
            <div>
                <h3
                    style={{
                        color: VIDEO_DATA.colors.text,
                        fontSize: 42,
                        marginBottom: 10,
                        marginTop: 0,
                        fontFamily: 'system-ui, sans-serif',
                    }}
                >
                    {feature.title}
                </h3>
                <p
                    style={{
                        color: VIDEO_DATA.colors.textSecondary,
                        fontSize: 28,
                        lineHeight: 1.4,
                        margin: 0,
                        fontFamily: 'system-ui, sans-serif',
                    }}
                >
                    {feature.desc}
                </p>
            </div>
        </div>
    );
};

const FeaturesScene: React.FC = () => {
    return (
        <AbsoluteFill
            style={{
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
                padding: 100,
            }}
        >
            <h2 style={{
                color: VIDEO_DATA.colors.text,
                fontFamily: 'system-ui, sans-serif',
                fontSize: 60,
                marginBottom: 60,
                opacity: 0.8,
            }}>
                Powerful Features
            </h2>
            {VIDEO_DATA.features.map((feature, i) => (
                <FeatureCard key={i} feature={feature} index={i} />
            ))}
        </AbsoluteFill>
    );
};

const AnimatedCounter: React.FC<{
    end: number;
    label: string;
    suffix?: string;
    delay: number;
}> = ({ end, label, suffix = '', delay }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const actualFrame = Math.max(0, frame - delay);

    const val = interpolate(actualFrame, [0, 60], [0, end], {
        extrapolateRight: 'clamp',
    });

    const scale = spring({
        frame: actualFrame,
        fps,
        from: 0.5,
        to: 1,
        config: { damping: 12 },
    });

    const opacity = interpolate(actualFrame, [0, 15], [0, 1]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                opacity,
                transform: `scale(${scale})`,
                margin: '0 40px',
            }}
        >
            <div
                style={{
                    fontSize: 100,
                    fontWeight: 800,
                    fontFamily: 'system-ui, sans-serif',
                    background: `linear-gradient(to bottom, #fff, ${VIDEO_DATA.colors.textSecondary})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}
            >
                {Math.floor(val).toLocaleString()}
                {suffix}
            </div>
            <div
                style={{
                    fontSize: 32,
                    color: VIDEO_DATA.colors.accent,
                    fontFamily: 'system-ui, sans-serif',
                    fontWeight: 600,
                    marginTop: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                }}
            >
                {label}
            </div>
        </div>
    );
};

const StatsScene: React.FC = () => {
    return (
        <AbsoluteFill
            style={{
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'row' }}>
                {VIDEO_DATA.stats.map((stat, i) => (
                    <AnimatedCounter
                        key={i}
                        end={stat.value}
                        label={stat.label}
                        suffix={stat.suffix}
                        delay={i * 15}
                    />
                ))}
            </div>
        </AbsoluteFill>
    );
};

const CTAScene: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const scale = spring({
        frame,
        fps,
        from: 0.8,
        to: 1,
        config: { stiffness: 100, damping: 10 },
    });

    const opacity = interpolate(frame, [0, 10], [0, 1]);

    return (
        <AbsoluteFill
            style={{
                justifyContent: 'center',
                alignItems: 'center',
                flexDirection: 'column',
            }}
        >
            <h2
                style={{
                    fontSize: 100,
                    fontFamily: 'system-ui, sans-serif',
                    color: VIDEO_DATA.colors.text,
                    opacity,
                    transform: `scale(${scale})`,
                    textAlign: 'center',
                    marginBottom: 60,
                    lineHeight: 1.1,
                }}
            >
                Start Building<br />
                <span style={{ color: VIDEO_DATA.colors.primary }}>Today</span>
            </h2>

            <div
                style={{
                    padding: '25px 60px',
                    backgroundColor: VIDEO_DATA.colors.primary,
                    color: 'white',
                    fontSize: 40,
                    fontWeight: 'bold',
                    borderRadius: 50,
                    fontFamily: 'system-ui, sans-serif',
                    boxShadow: `0 10px 40px ${VIDEO_DATA.colors.primary}88`,
                    opacity: interpolate(frame, [10, 20], [0, 1]),
                    transform: `translateY(${interpolate(frame, [10, 20], [20, 0], { extrapolateRight: 'clamp' })}px)`,
                }}
            >
                Get Started &rarr;
            </div>
        </AbsoluteFill>
    );
};

// --- Main Composition ---

export const ProductLaunchVideo: React.FC = () => {
    return (
        <AbsoluteFill style={{ backgroundColor: VIDEO_DATA.colors.background }}>
            {/* Shared background across all scenes */}
            <GradientBackground />
            <Particles />

            {/* Scene 1: Intro (0-5s = 0-150 frames) */}
            <Sequence from={0} durationInFrames={150}>
                <TitleScene />
            </Sequence>

            {/* Scene 2: Features (5-15s = 150-450 frames) */}
            <Sequence from={150} durationInFrames={300}>
                <FeaturesScene />
            </Sequence>

            {/* Scene 3: Stats (15-23s = 450-690 frames) */}
            <Sequence from={450} durationInFrames={240}>
                <StatsScene />
            </Sequence>

            {/* Scene 4: Call to Action (23-30s = 690-900 frames) */}
            <Sequence from={690} durationInFrames={210}>
                <CTAScene />
            </Sequence>
        </AbsoluteFill>
    );
};
