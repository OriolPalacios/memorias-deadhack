import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { DrapedPose } from '../data/jezeroContracts.ts';

interface AstronautFigureProps {
  readonly pose: DrapedPose;
  readonly isWalking: boolean;
  readonly isPaused: boolean;
  readonly reducedMotion: boolean;
}

/**
 * Enlarged stylized EVA astronaut built purely from local Three.js primitives (27 meshes).
 * Explicitly scaled as a legible symbolic marker over the 400 m terrain cut (~22 m symbol height).
 */
export function AstronautFigure({
  pose,
  isWalking,
  isPaused,
  reducedMotion,
}: AstronautFigureProps) {
  const bodyGroupRef = useRef<THREE.Group | null>(null);
  const pelvisRef = useRef<THREE.Group | null>(null);
  const leftLegRef = useRef<THREE.Group | null>(null);
  const rightLegRef = useRef<THREE.Group | null>(null);
  const leftArmRef = useRef<THREE.Group | null>(null);
  const rightArmRef = useRef<THREE.Group | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const stridePhaseRef = useRef(0);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (isWalking && !isPaused && !reducedMotion) {
      stridePhaseRef.current += dt * 7.2;
      const p = stridePhaseRef.current;
      const swing = Math.sin(p) * 0.56;
      const counter = Math.sin(p) * 0.42;

      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -counter;
      if (rightArmRef.current) rightArmRef.current.rotation.x = counter;
      if (pelvisRef.current) {
        pelvisRef.current.position.y = Math.abs(Math.sin(p)) * 0.85;
        pelvisRef.current.rotation.z = Math.cos(p) * 0.035;
      }
      if (ringRef.current) {
        const s = 1 + Math.sin(p * 2) * 0.08;
        ringRef.current.scale.set(s, s, 1);
      }
    } else if (!isWalking || reducedMotion) {
      stridePhaseRef.current = 0;
      if (leftLegRef.current) leftLegRef.current.rotation.x = 0;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = 0;
      if (rightArmRef.current) rightArmRef.current.rotation.x = 0;
      if (pelvisRef.current) {
        pelvisRef.current.position.y = 0;
        pelvisRef.current.rotation.z = 0;
      }
      if (ringRef.current) {
        ringRef.current.scale.set(1, 1, 1);
      }
    }
    // When paused mid-walk (`isWalking && isPaused`), leave limbs frozen at current stridePhase.
  });

  const suitWhite = '#f2f5f3';
  const suitShade = '#cfd8dc';
  const bootDark = '#2b3942';
  const accentCyan = '#00d9c2';
  const visorGold = '#c98838';

  return (
    <group
      ref={bodyGroupRef}
      position={[pose.x, pose.y, pose.z]}
      rotation={[0, pose.yawRad, 0]}
    >
      {/* 1. Ground contact ring */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.38, 0]}
        renderOrder={5}
      >
        <ringGeometry args={[3.9, 5.6, 28]} />
        <meshBasicMaterial
          color={accentCyan}
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
        />
      </mesh>

      <group ref={pelvisRef}>
        {/* 2. Torso suit core */}
        <mesh position={[0, 11.4, 0]} renderOrder={5}>
          <boxGeometry args={[4.8, 5.8, 3.2]} />
          <meshStandardMaterial color={suitWhite} roughness={0.62} metalness={0.08} />
        </mesh>

        {/* 3. Chest Display & Control Module */}
        <mesh position={[0, 11.8, 1.85]} renderOrder={5}>
          <boxGeometry args={[2.4, 2.1, 0.8]} />
          <meshStandardMaterial color={suitShade} roughness={0.5} metalness={0.18} />
        </mesh>

        {/* 4 & 5. Chest indicator beacons */}
        <mesh position={[-0.6, 12.1, 2.3]} renderOrder={5}>
          <boxGeometry args={[0.55, 0.45, 0.25]} />
          <meshBasicMaterial color={accentCyan} />
        </mesh>
        <mesh position={[0.6, 12.1, 2.3]} renderOrder={5}>
          <boxGeometry args={[0.55, 0.45, 0.25]} />
          <meshBasicMaterial color="#e5a93b" />
        </mesh>

        {/* 6. PLSS Life-Support Backpack */}
        <mesh position={[0, 11.9, -2.55]} renderOrder={5}>
          <boxGeometry args={[4.1, 6.2, 2.3]} />
          <meshStandardMaterial color={suitShade} roughness={0.55} metalness={0.14} />
        </mesh>

        {/* 7. PLSS top cyan identification strip */}
        <mesh position={[0, 14.3, -2.55]} renderOrder={5}>
          <boxGeometry args={[3.9, 0.7, 2.42]} />
          <meshBasicMaterial color={accentCyan} />
        </mesh>

        {/* 8. Telemetry antenna mast */}
        <mesh position={[1.45, 16.5, -3.0]} renderOrder={5}>
          <cylinderGeometry args={[0.16, 0.22, 3.6, 8]} />
          <meshStandardMaterial color={bootDark} roughness={0.5} metalness={0.35} />
        </mesh>

        {/* 9. Antenna beacon tip */}
        <mesh position={[1.45, 18.4, -3.0]} renderOrder={5}>
          <sphereGeometry args={[0.38, 10, 10]} />
          <meshBasicMaterial color={accentCyan} />
        </mesh>

        {/* 10. Neck disconnect ring */}
        <mesh position={[0, 14.7, 0.1]} renderOrder={5}>
          <cylinderGeometry args={[1.95, 2.15, 0.85, 14]} />
          <meshStandardMaterial color={bootDark} roughness={0.45} metalness={0.3} />
        </mesh>

        {/* 11. EVA Helmet dome */}
        <mesh position={[0, 17.0, 0.15]} renderOrder={5}>
          <sphereGeometry args={[2.7, 16, 14]} />
          <meshStandardMaterial color={suitWhite} roughness={0.45} metalness={0.1} />
        </mesh>

        {/* 12. Gold reflective face visor */}
        <mesh position={[0, 17.05, 1.25]} scale={[1.02, 0.86, 0.88]} renderOrder={5}>
          <sphereGeometry args={[2.05, 14, 12]} />
          <meshStandardMaterial
            color={visorGold}
            roughness={0.22}
            metalness={0.68}
            emissive="#4a2c0c"
            emissiveIntensity={0.25}
          />
        </mesh>

        {/* 13. Pelvis waist assembly */}
        <mesh position={[0, 8.2, 0]} renderOrder={5}>
          <boxGeometry args={[4.4, 1.5, 2.9]} />
          <meshStandardMaterial color={suitShade} roughness={0.68} metalness={0.08} />
        </mesh>

        {/* 14-17. Left leg assembly (hip pivot at y=7.6) */}
        <group ref={leftLegRef} position={[-1.28, 7.6, 0]}>
          <mesh position={[0, -1.9, 0]} renderOrder={5}>
            <cylinderGeometry args={[1.05, 0.92, 3.6, 10]} />
            <meshStandardMaterial color={suitWhite} roughness={0.65} />
          </mesh>
          <mesh position={[0, -3.8, 0.15]} renderOrder={5}>
            <sphereGeometry args={[0.92, 10, 10]} />
            <meshStandardMaterial color={suitShade} roughness={0.65} />
          </mesh>
          <mesh position={[0, -5.55, 0]} renderOrder={5}>
            <cylinderGeometry args={[0.88, 0.8, 3.2, 10]} />
            <meshStandardMaterial color={suitWhite} roughness={0.65} />
          </mesh>
          <mesh position={[0, -7.1, 0.45]} renderOrder={5}>
            <boxGeometry args={[1.65, 1.0, 2.55]} />
            <meshStandardMaterial color={bootDark} roughness={0.75} />
          </mesh>
        </group>

        {/* 18-21. Right leg assembly */}
        <group ref={rightLegRef} position={[1.28, 7.6, 0]}>
          <mesh position={[0, -1.9, 0]} renderOrder={5}>
            <cylinderGeometry args={[1.05, 0.92, 3.6, 10]} />
            <meshStandardMaterial color={suitWhite} roughness={0.65} />
          </mesh>
          <mesh position={[0, -3.8, 0.15]} renderOrder={5}>
            <sphereGeometry args={[0.92, 10, 10]} />
            <meshStandardMaterial color={suitShade} roughness={0.65} />
          </mesh>
          <mesh position={[0, -5.55, 0]} renderOrder={5}>
            <cylinderGeometry args={[0.88, 0.8, 3.2, 10]} />
            <meshStandardMaterial color={suitWhite} roughness={0.65} />
          </mesh>
          <mesh position={[0, -7.1, 0.45]} renderOrder={5}>
            <boxGeometry args={[1.65, 1.0, 2.55]} />
            <meshStandardMaterial color={bootDark} roughness={0.75} />
          </mesh>
        </group>

        {/* 22-25. Left arm assembly */}
        <group ref={leftArmRef} position={[-3.05, 13.6, 0]}>
          <mesh position={[0, -0.1, 0]} renderOrder={5}>
            <sphereGeometry args={[1.05, 10, 10]} />
            <meshStandardMaterial color={suitWhite} roughness={0.62} />
          </mesh>
          <mesh position={[-0.2, -1.85, 0.1]} rotation={[0, 0, -0.08]} renderOrder={5}>
            <cylinderGeometry args={[0.85, 0.74, 3.1, 10]} />
            <meshStandardMaterial color={suitWhite} roughness={0.62} />
          </mesh>
          <mesh position={[-0.25, -4.1, 0.65]} rotation={[-0.35, 0, 0]} renderOrder={5}>
            <cylinderGeometry args={[0.7, 0.64, 2.6, 10]} />
            <meshStandardMaterial color={suitShade} roughness={0.62} />
          </mesh>
          <mesh position={[-0.25, -5.45, 1.1]} renderOrder={5}>
            <sphereGeometry args={[0.72, 10, 10]} />
            <meshStandardMaterial color={bootDark} roughness={0.7} />
          </mesh>
        </group>

        {/* 26-29. Right arm assembly */}
        <group ref={rightArmRef} position={[3.05, 13.6, 0]}>
          <mesh position={[0, -0.1, 0]} renderOrder={5}>
            <sphereGeometry args={[1.05, 10, 10]} />
            <meshStandardMaterial color={suitWhite} roughness={0.62} />
          </mesh>
          <mesh position={[0.2, -1.85, 0.1]} rotation={[0, 0, 0.08]} renderOrder={5}>
            <cylinderGeometry args={[0.85, 0.74, 3.1, 10]} />
            <meshStandardMaterial color={suitWhite} roughness={0.62} />
          </mesh>
          <mesh position={[0.25, -4.1, 0.65]} rotation={[-0.35, 0, 0]} renderOrder={5}>
            <cylinderGeometry args={[0.7, 0.64, 2.6, 10]} />
            <meshStandardMaterial color={suitShade} roughness={0.62} />
          </mesh>
          <mesh position={[0.25, -5.45, 1.1]} renderOrder={5}>
            <sphereGeometry args={[0.72, 10, 10]} />
            <meshStandardMaterial color={bootDark} roughness={0.7} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
