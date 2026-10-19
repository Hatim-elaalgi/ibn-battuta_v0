import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { motion } from 'framer-motion';
import * as THREE from 'three';

// Suppress R3F's internal THREE.Clock deprecation warning
if (typeof window !== 'undefined') {
    const _warn = console.warn.bind(console);
    console.warn = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('Clock') && args[0].includes('deprecated')) return;
        _warn(...args);
    };
}

const lerp = (a, b, t) => a * (1 - t) + b * t;

// ─── GLB model loader ─────────────────────────────────────────────────────────
const loader = new GLTFLoader();

// ─── Collect jaw-region vertices for deformation ─────────────────────────────
function buildJawMorphData(model) {
    const result = [];

    model.traverse((child) => {
        if (!child.isMesh || !child.geometry?.attributes?.position) return;

        const pos = child.geometry.attributes.position;
        const n   = pos.count;

        // Scan Y range from position buffer
        let minY = Infinity, maxY = -Infinity;
        for (let i = 0; i < n; i++) {
            const y = pos.getY(i);
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        const h = maxY - minY;
        // chinLine = bottom of face / top of neck (nothing below this selected)
        // jawLine  = jaw hinge / upper bound (this stays fixed, weight = 0)
        // Only the band [chinLine … jawLine) is animated — no neck, no shoulders.
        const chinLine = minY + h * 0.44;
        const jawLine  = minY + h * 0.63;
        const maxDrop  = h * 0.022;

        const indices = [], origY = [];
        for (let i = 0; i < n; i++) {
            const y = pos.getY(i);
            if (y >= chinLine && y < jawLine) { indices.push(i); origY.push(y); }
        }

        if (indices.length > 20) {
            child.frustumCulled = false;
            pos.usage = 35048; // DynamicDrawUsage
            result.push({ pos, geo: child.geometry, indices, origY, chinLine, jawLine, maxDrop });
            console.log(`[jaw] ${indices.length}/${n} verts  chin=${chinLine.toFixed(1)} hinge=${jawLine.toFixed(1)}`);
        }
    });

    return result;
}

function GLBAvatar({ energy, speaking, onFail }) {
    const { scene } = useThree();
    const groupRef         = useRef();
    const currentEnergyRef = useRef(0);
    const jawMorphRef      = useRef([]);
    const onFailRef        = useRef(onFail);
    useEffect(() => { onFailRef.current = onFail; }, [onFail]);

    // Dep array is [scene] only — onFail is stable via ref, never causes remount
    useEffect(() => {
        let cancelled = false;
        let group = null;

        loader.load(
            '/models/ibn-battuta/ibn-battuta.glb',
            (gltf) => {
                if (cancelled) return;

                const model = gltf.scene;

                // ── Build jaw morph data BEFORE applying transforms ──
                // (vertex positions are still in raw local space here)
                jawMorphRef.current = buildJawMorphData(model);

                // ── Fix materials: kill specularity, add roughness ──
                model.traverse((child) => {
                    if (!child.isMesh) return;
                    const old = child.material;
                    child.material = new THREE.MeshStandardMaterial({
                        map:       old.map       ?? null,
                        color:     old.color     ?? new THREE.Color(1, 1, 1),
                        roughness: 0.78,
                        metalness: 0.0,
                    });
                    child.castShadow    = false;
                    child.receiveShadow = false;
                });

                // ── Auto-fit: center + scale to fill view ──
                const box    = new THREE.Box3().setFromObject(model);
                const size   = new THREE.Vector3();
                const center = new THREE.Vector3();
                box.getSize(size);
                box.getCenter(center);

                const maxDim = Math.max(size.x, size.y, size.z);
                const scale  = 1.8 / maxDim;
                model.scale.setScalar(scale);

                model.position.x = -center.x * scale;
                model.position.y = -center.y * scale;
                model.position.z = -center.z * scale;

                group = new THREE.Group();
                group.add(model);
                groupRef.current = group;
                scene.add(group);
            },
            undefined,
            (err) => {
                if (!cancelled) { console.warn('[GLBAvatar]', err); onFailRef.current?.(); }
            }
        );

        return () => {
            cancelled = true;
            if (group) scene.remove(group);
        };
    }, [scene]);   // ← scene only; onFail accessed via ref

    useFrame((state) => {
        if (!groupRef.current) return;
        const t = state.clock.elapsedTime;

        // ── Idle animation ──
        groupRef.current.position.y = Math.sin(t * 0.75) * 0.012;
        groupRef.current.rotation.y = Math.sin(t * 0.22) * 0.05;

        // ── Smooth energy ──
        const target = speaking ? Math.max(energy, 0) : 0;
        currentEnergyRef.current = lerp(currentEnergyRef.current, target, 0.18);
        const e = currentEnergyRef.current;

        // ── Rigid jaw drop ──
        for (const { pos, geo, indices, origY, chinLine, jawLine, maxDrop } of jawMorphRef.current) {
            const range = jawLine - chinLine; // band height, always positive
            for (let j = 0; j < indices.length; j++) {
                const oy = origY[j];
                // w=0 at jawLine (hinge, stays fixed), w=1 at chinLine (drops most)
                const w = (jawLine - oy) / range;
                pos.setY(indices[j], oy - e * maxDrop * w);
            }
            pos.needsUpdate = true;
            geo.computeBoundingSphere();
        }
    });

    return null;
}

// ─── Procedural fallback ──────────────────────────────────────────────────────
function PlaceholderAvatar({ energy, speaking }) {
    const groupRef = useRef();
    const mouthRef = useRef();
    const currentEnergyRef = useRef(0);

    useFrame((state) => {
        const t = state.clock.elapsedTime;
        if (groupRef.current) {
            groupRef.current.position.y = Math.sin(t * 0.9) * 0.025;
            groupRef.current.rotation.y = Math.sin(t * 0.25) * 0.04;
        }
        const target = speaking ? Math.max(energy, 0) : 0;
        currentEnergyRef.current = lerp(currentEnergyRef.current, target, 0.15);
        if (mouthRef.current) {
            mouthRef.current.scale.y = Math.max(0.05, currentEnergyRef.current * 1.8);
        }
    });

    return (
        <group ref={groupRef} position={[0, -0.1, 0]}>
            <mesh position={[0, 0.42, 0]}>
                <sphereGeometry args={[0.46, 32, 32]} />
                <meshStandardMaterial color="#C8956A" roughness={0.75} />
            </mesh>
            <mesh ref={mouthRef} position={[0, 0.2, 0.44]}>
                <boxGeometry args={[0.18, 0.055, 0.02]} />
                <meshStandardMaterial color="#7a3a1a" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.84, 0]}>
                <cylinderGeometry args={[0.49, 0.49, 0.12, 32]} />
                <meshStandardMaterial color="#1a3a6e" roughness={0.7} />
            </mesh>
            <mesh position={[0, -0.55, 0]}>
                <cylinderGeometry args={[0.28, 0.5, 0.9, 32]} />
                <meshStandardMaterial color="#1e5c3a" roughness={0.8} />
            </mesh>
        </group>
    );
}

// ─── Lighting (no shadows needed) ────────────────────────────────────────────
function Lighting() {
    return (
        <>
            <ambientLight intensity={0.9} />
            <directionalLight position={[1.5, 3, 3]}  intensity={1.2} />
            <directionalLight position={[-2, 1, -1]}   intensity={0.3} color="#b8ccff" />
        </>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AvatarViewer({ energy = 0, speaking = false }) {
    const [useGLB, setUseGLB]   = useState(true);
    const [loading, setLoading] = useState(true);
    // Stable callback — never recreated, so GLBAvatar's useEffect won't remount
    const handleFail = useCallback(() => setUseGLB(false), []);

    return (
        <div
            className="relative w-full h-full overflow-hidden border border-line-dark on-ink"
            style={{
                background:
                    'radial-gradient(ellipse at 50% 35%, oklch(0.30 0.020 55), oklch(0.16 0.012 60) 75%)',
            }}
        >
            {/* Top-left plate caption */}
            <div className="absolute top-4 left-4 z-20 t-caption" style={{ color: 'oklch(0.78 0.012 70)' }}>
                — Plate IV
            </div>

            {/* Top-right state caption (Idle / Speaking) */}
            <div className="absolute top-4 right-4 z-20 t-caption flex items-center gap-2"
                 style={{ color: speaking ? 'var(--color-ochre)' : 'oklch(0.78 0.012 70)' }}>
                <motion.span
                    animate={{
                        opacity: speaking ? [0.4, 1, 0.4] : 0.4,
                        scale:   speaking ? [1, 1.18, 1]   : 1,
                    }}
                    transition={{ duration: 1.4, repeat: speaking ? Infinity : 0, ease: 'easeInOut' }}
                >
                    {speaking ? '●' : '○'}
                </motion.span>
                <span>{speaking ? 'Speaking' : 'Idle'}</span>
            </div>

            <Canvas
                camera={{ position: [0, 0, 2.6], fov: 40 }}
                gl={{ antialias: true }}
                onCreated={() => setLoading(false)}
            >
                <Lighting />

                {useGLB ? (
                    <GLBAvatar
                        energy={energy}
                        speaking={speaking}
                        onFail={handleFail}
                    />
                ) : (
                    <PlaceholderAvatar energy={energy} speaking={speaking} />
                )}
            </Canvas>

            {/* Loading curtain */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-ink z-30">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-px h-10 bg-ochre animate-pulse" />
                        <p className="t-caption" style={{ color: 'var(--color-ochre)' }}>
                            — Awakening the traveler
                        </p>
                    </div>
                </div>
            )}

            {/* Bottom — bilingual nameplate (slide 09) */}
            <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.3, ease: [0.2, 0.65, 0.2, 1] }}
                className="absolute bottom-4 left-4 right-4 z-20 flex items-baseline justify-between pointer-events-none"
            >
                <span
                    className="text-bone leading-none"
                    style={{
                        fontFamily: 'var(--font-display)',
                        fontStyle:  'italic',
                        fontWeight: 300,
                        fontSize:   '24px',
                        letterSpacing: '-0.01em',
                    }}
                >
                    Ibn Battuta
                </span>
                <span
                    className="text-bone"
                    style={{
                        fontFamily: 'var(--font-arabic)',
                        fontSize:   '22px',
                        lineHeight: 1,
                    }}
                >
                    ابن بطوطة
                </span>
            </motion.div>
        </div>
    );
}
