import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraRigPreset } from './orbitDefaults.ts';

interface OrbitRigProps {
  readonly preset: CameraRigPreset;
  readonly resetSignal: number;
  readonly focusSignal: number;
  readonly reducedMotion: boolean;
  readonly onUserOrbit: () => void;
}

/**
 * Wraps Three.js OrbitControls inside React Three Fiber with explicit camera reset,
 * terrain bounds fitting, science-target centering, and reduced-motion support.
 */
export function OrbitRig({
  preset,
  resetSignal,
  focusSignal,
  reducedMotion,
  onUserOrbit,
}: OrbitRigProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);
  const lastResetRef = useRef<number>(resetSignal);
  const lastFocusRef = useRef<number>(focusSignal);
  const lastModeKeyRef = useRef<string>('');
  const onUserOrbitRef = useRef(onUserOrbit);
  const isProgrammaticResetRef = useRef(false);

  useEffect(() => {
    onUserOrbitRef.current = onUserOrbit;
  }, [onUserOrbit]);

  // Mount controls once for the active camera/renderer
  useEffect(() => {
    const domElement = gl.domElement;
    const controls = new OrbitControls(camera, domElement);
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.keyRotateSpeed = 2.5;
    controls.maxPolarAngle = Math.PI * 0.485;

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
  }, [camera, gl]);

  // Keep damping synced with reduced-motion preference
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }
    controls.enableDamping = !reducedMotion;
  }, [reducedMotion]);

  // Apply camera bounds, clipping planes, and overview fit on mount or terrain preset change
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const controlledCamera = controls.object;
    if (controlledCamera instanceof PerspectiveCamera) {
      controlledCamera.near = preset.near;
      controlledCamera.far = preset.far;
      controlledCamera.updateProjectionMatrix();
    }

    const modeChanged = lastModeKeyRef.current !== preset.modeKey;
    lastModeKeyRef.current = preset.modeKey;

    isProgrammaticResetRef.current = true;
    const previousDamping = controls.enableDamping;
    controls.enableDamping = false;
    controls.minDistance = preset.minDistance;
    controls.maxDistance = preset.maxDistance;
    controls.keyPanSpeed = preset.keyPanSpeed;

    if (modeChanged || controls.target.lengthSq() === 0) {
      controlledCamera.position.set(...preset.overviewPosition);
      controls.target.set(...preset.overviewTarget);
      controls.update();
      controls.saveState();
    } else {
      controls.update();
    }

    controls.enableDamping = previousDamping;
    isProgrammaticResetRef.current = false;
  }, [preset]);

  // Handle explicit view reset (returns to saved overview fit)
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
      camera.position.set(...preset.overviewPosition);
      controls.target.set(...preset.overviewTarget);
      controls.update();
      controls.saveState();
      controls.enableDamping = previousDamping;
      isProgrammaticResetRef.current = false;
    } else {
      camera.position.set(...preset.overviewPosition);
      camera.lookAt(...preset.overviewTarget);
    }
  }, [camera, preset, resetSignal]);

  // Handle "Centrar en Enchanted Lake" without overwriting saved overview fit
  useEffect(() => {
    if (focusSignal === lastFocusRef.current) {
      return;
    }
    lastFocusRef.current = focusSignal;
    if (!preset.focusPosition || !preset.focusTarget) {
      return;
    }

    const controls = controlsRef.current;
    if (controls) {
      isProgrammaticResetRef.current = true;
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      camera.position.set(...preset.focusPosition);
      controls.target.set(...preset.focusTarget);
      controls.update();
      controls.enableDamping = previousDamping;
      isProgrammaticResetRef.current = false;
    } else {
      camera.position.set(...preset.focusPosition);
      camera.lookAt(...preset.focusTarget);
    }
  }, [camera, focusSignal, preset]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (controls && controls.enableDamping) {
      controls.update();
    }
  });

  return null;
}
