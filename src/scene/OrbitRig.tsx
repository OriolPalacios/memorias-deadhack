import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraRigPreset } from './orbitDefaults.ts';

interface OrbitRigProps {
  readonly preset: CameraRigPreset;
  readonly resetSignal: number;
  readonly focusSignal: number;
  readonly reducedMotion: boolean;
  readonly onUserOrbit: () => void;
}

interface CameraTransitionState {
  readonly fromPos: Vector3;
  readonly fromTarget: Vector3;
  readonly toPos: Vector3;
  readonly toTarget: Vector3;
  readonly durationSec: number;
  readonly saveAfter: boolean;
  elapsedSec: number;
}

const TRANSITION_DURATION_SEC = 0.65;

/**
 * Wraps Three.js OrbitControls inside React Three Fiber with smooth 650ms ease-out
 * camera reset and simulated-objective centering, cancelled immediately on user orbit.
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
  const transitionRef = useRef<CameraTransitionState | null>(null);

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
        transitionRef.current = null;
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
    transitionRef.current = null;
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

  // Handle explicit view reset (smoothly returns to saved overview fit)
  useEffect(() => {
    if (resetSignal === lastResetRef.current) {
      return;
    }
    lastResetRef.current = resetSignal;

    const controls = controlsRef.current;
    if (!controls) {
      camera.position.set(...preset.overviewPosition);
      camera.lookAt(...preset.overviewTarget);
      return;
    }

    if (reducedMotion) {
      transitionRef.current = null;
      isProgrammaticResetRef.current = true;
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      camera.position.set(...preset.overviewPosition);
      controls.target.set(...preset.overviewTarget);
      controls.update();
      controls.saveState();
      controls.enableDamping = previousDamping;
      isProgrammaticResetRef.current = false;
      return;
    }

    transitionRef.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: new Vector3(...preset.overviewPosition),
      toTarget: new Vector3(...preset.overviewTarget),
      durationSec: TRANSITION_DURATION_SEC,
      saveAfter: true,
      elapsedSec: 0,
    };
  }, [camera, preset, reducedMotion, resetSignal]);

  // Handle "Centrar objetivo simulado" smoothly without overwriting saved overview fit
  useEffect(() => {
    if (focusSignal === lastFocusRef.current) {
      return;
    }
    lastFocusRef.current = focusSignal;
    if (!preset.focusPosition || !preset.focusTarget) {
      return;
    }

    const controls = controlsRef.current;
    if (!controls) {
      camera.position.set(...preset.focusPosition);
      camera.lookAt(...preset.focusTarget);
      return;
    }

    if (reducedMotion) {
      transitionRef.current = null;
      isProgrammaticResetRef.current = true;
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      camera.position.set(...preset.focusPosition);
      controls.target.set(...preset.focusTarget);
      controls.update();
      controls.enableDamping = previousDamping;
      isProgrammaticResetRef.current = false;
      return;
    }

    transitionRef.current = {
      fromPos: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPos: new Vector3(...preset.focusPosition),
      toTarget: new Vector3(...preset.focusTarget),
      durationSec: TRANSITION_DURATION_SEC,
      saveAfter: false,
      elapsedSec: 0,
    };
  }, [camera, focusSignal, preset, reducedMotion]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const activeTransition = transitionRef.current;
    if (activeTransition) {
      activeTransition.elapsedSec += Math.min(delta, 0.05);
      const t = Math.min(1, activeTransition.elapsedSec / activeTransition.durationSec);
      const eased = 1 - Math.pow(1 - t, 3);

      isProgrammaticResetRef.current = true;
      const previousDamping = controls.enableDamping;
      controls.enableDamping = false;
      camera.position.lerpVectors(activeTransition.fromPos, activeTransition.toPos, eased);
      controls.target.lerpVectors(
        activeTransition.fromTarget,
        activeTransition.toTarget,
        eased,
      );
      controls.update();
      if (t >= 1) {
        if (activeTransition.saveAfter) {
          controls.saveState();
        }
        transitionRef.current = null;
      }
      controls.enableDamping = previousDamping;
      isProgrammaticResetRef.current = false;
      return;
    }

    if (controls.enableDamping) {
      controls.update();
    }
  });

  return null;
}
