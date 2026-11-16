/**
 * Safe WebGL capability probe so unavailable contexts fall back gracefully (APP-03).
 */
export function detectWebGLSupport(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');

    if (!context) {
      return false;
    }

    if ('getExtension' in context && typeof context.getExtension === 'function') {
      const loseContext = context.getExtension('WEBGL_lose_context') as
        | { loseContext?: () => void }
        | null;
      loseContext?.loseContext?.();
    }

    return true;
  } catch {
    return false;
  }
}
