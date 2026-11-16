import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Neutral geometric reference scene shown while the real Jezero DEM/DTM crop is pending (APP-03).
 * Contains zero procedural Martian relief, zero thermal imagery, and zero invented metric coordinates.
 */
export function ReferenceStage() {
  const { volumeEdges, axisGeometry } = useMemo(() => {
    const box = new THREE.BoxGeometry(4.4, 0.84, 4.4);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();

    const linePts = [
      new THREE.Vector3(-2.6, 0.008, 0),
      new THREE.Vector3(2.6, 0.008, 0),
      new THREE.Vector3(0, 0.008, -2.6),
      new THREE.Vector3(0, 0.008, 2.6),
      new THREE.Vector3(0, 0.008, 0),
      new THREE.Vector3(0, 1.15, 0),
    ];
    const axisGeo = new THREE.BufferGeometry().setFromPoints(linePts);

    return { volumeEdges: edges, axisGeometry: axisGeo };
  }, []);

  useEffect(() => {
    return () => {
      volumeEdges.dispose();
      axisGeometry.dispose();
    };
  }, [axisGeometry, volumeEdges]);

  return (
    <group>
      <color attach="background" args={['#080809']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={0.9} />
      <directionalLight position={[-4, 3, -4]} intensity={0.25} />

      {/* Neutral planar calibration grid (explicitly non-terrain reference) */}
      <gridHelper args={[10, 10, '#363636', '#1c1c1c']} position={[0, 0, 0]} />

      {/* Orthogonal non-metric reference axes */}
      <lineSegments geometry={axisGeometry}>
        <lineBasicMaterial color="#464646" />
      </lineSegments>

      {/* Outer calibration ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.08, 2.12, 72]} />
        <meshBasicMaterial color="#3c3c3c" />
      </mesh>

      {/* Inner regolith-hue datum ring indicating awaiting DEM mount */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]}>
        <ringGeometry args={[0.88, 0.91, 56]} />
        <meshBasicMaterial color="#d4a373" />
      </mesh>

      {/* Wireframe bounding envelope reserved for future DEM mesh */}
      <lineSegments geometry={volumeEdges} position={[0, 0.42, 0]}>
        <lineBasicMaterial color="#2f2f2f" />
      </lineSegments>

      {/* Central geometric reference marker to make 3D orbit/reset immediately legible */}
      <mesh position={[0, 0.42, 0]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#b4b4b4" wireframe />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#d4a373" />
      </mesh>
    </group>
  );
}
