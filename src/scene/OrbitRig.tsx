import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  DEFAULT_ORBIT_CAMERA_POSITION,
  DEFAULT_ORBIT_TARGET,
} from './orbitDefaults.ts';

interface OrbitRigProps {
  readonly resetSignal: number;
  readonly reducedMotion: boolean;
  readonly onUserOrbit: () => void;
}

/**
 * Wraps Three.js OrbitControls inside React Three Fiber with explicit camera reset
 * and reduced-motion support.
 */
export function OrbitRig({ resetSignal, reducedMotion, onUserOrbit }: OrbitRigProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const lastResetRef = useRef<number>(resetSignal);
  const onUserOrbitRef = useRef(onUserOrbit);
  const isProgrammaticResetRef = useRef(false);

  useEffect(() => {
    onUserOrbitRef.current = onUserOrbit;
  }, [onUserOrbit]);

  useEffect(() => {
    const domElement = gl.domElement;
    const controls = new OrbitControls(camera, domElement);
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.keyPanSpeed = 12;
    controls.keyRotateSpeed = 2.5;
    controls.minDistance = 2.6;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.target.set(
      DEFAULT_ORBIT_TARGET[0],
      DEFAULT_ORBIT_TARGET[1],
      DEFAULT_ORBIT_TARGET[2],
    );
    controls.update();
    controls.saveState();
    controls.listenToKeyEvents(domElement);

    const handleStart = () => {
      if (!isProgrammaticResetRef.current) {
        onUserOrbitRef.current();
      }
    };

    const handleChange = () => {
      if (!isProgrammaticResetRef.current) {
        onUserOrbitRef.current();
      }
    };

    controls.addEventListener('start', handleStart);
    controls.addEventListener('change', handleChange);
    controlsRef.current = controls;

    return () => {
      controls.removeEventListener('start', handleStart);
      controls.removeEventListener('change', handleChange);
      controls.stopListenToKeyEvents();
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl, reducedMotion]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }
    controls.enableDamping = !reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    if (resetSignal === lastResetRef.current) {
      return;
    }
    lastResetRef.current = resetSignal;

    const controls = controlsRef.current;
    if (controls) {
      isProgrammaticResetRef.current = true;
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      controls.reset();
      controls.enableDamping = previousDamping;
      isProgrammaticResetRef.current = false;
    } else {
      camera.position.set(
        DEFAULT_ORBIT_CAMERA_POSITION[0],
        DEFAULT_ORBIT_CAMERA_POSITION[1],
        DEFAULT_ORBIT_CAMERA_POSITION[2],
      );
      camera.lookAt(
        DEFAULT_ORBIT_TARGET[0],
        DEFAULT_ORBIT_TARGET[1],
        DEFAULT_ORBIT_TARGET[2],
      );
    }
  }, [camera, resetSignal]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (controls && controls.enableDamping) {
      controls.update();
    }
  });

  return null;
}
