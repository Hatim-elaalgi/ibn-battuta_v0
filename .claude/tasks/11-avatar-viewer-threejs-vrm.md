# 11-avatar-viewer-threejs-vrm.md

## Purpose
Create a dedicated 3D avatar viewer component for the Ibn Battuta persona.

This task introduces:
- `frontend/src/components/avatar/AvatarViewer.jsx`
- Three.js + VRM loading (or a fallback placeholder if VRM is missing)
- An idle animation loop

Mouth/lip sync integration happens in task `12`.

## Pre-checks
1. Current frontend does not have any avatar component folder.
2. Current frontend dependencies are minimal; you will need to add 3D dependencies:
   - `three`
   - `@react-three/fiber`
   - optionally `@react-three/drei`
   - a VRM loader:
     - recommended: `@pixiv/three-vrm` or `three-vrm` (choose one based on what works in your environment)

## Implementation
### 1) Add the avatar folder + component (required)
1. Create directory: `frontend/src/components/avatar/`
2. Add file:
   - `frontend/src/components/avatar/AvatarViewer.jsx`
3. Component props (define now, used later by lip-sync):
   - `energy: number` (0..1), default 0
   - `speaking: boolean`, default false
   - `vrmUrl: string | null`, optional (URL/path to VRM asset)
4. Layout:
   - Use a fixed-height container so it fits into `MainLayout`
   - Example: `className="w-full h-full"`

### 2) 3D canvas + scene setup (required)
5. Use `Canvas` from `@react-three/fiber`:
   - Add basic lighting (ambient + directional)
6. Add an idle animation:
   - subtle rotation or breathing effect using `useFrame`
7. If VRM is present:
   - load the VRM model asynchronously
   - add it to the scene
8. If VRM is missing or fails to load:
   - render a fallback placeholder:
     - e.g., a simple sphere/head shape with a “Loading avatar…” or “Avatar model missing” label via HTML overlay.
   - This ensures the UI still works even without the asset.

### 3) VRM loading specifics (required in guidance)
9. Choose one of these loading approaches (implement whichever is easiest in your environment):
   - Approach A (recommended): use `@pixiv/three-vrm`’s loader and add the resulting scene to the R3F scene.
   - Approach B: manual loader inside `useEffect` using Three.js `GLTFLoader` plus VRM plugin.
10. After loading:
   - keep a ref to the VRM instance so later tasks can set blendshape/mouth parameters
   - ensure you call `vrm.scene.rotation` adjustments so it faces camera

### 4) Export interface hooks for lip-sync (required)
11. Even though lip sync is implemented in task `12`, prepare the internal structure:
   - store blendshape-related refs/IDs (or be ready to compute them)
   - expose a place in code where the mouth-energy update will happen:
     - e.g., inside `useFrame` call a function like `updateMouth(energy, speaking)`

## Verification (hard gates)
1. Frontend builds successfully after adding dependencies.
2. `AvatarViewer` renders without crashing:
   - with `vrmUrl=null`
   - with an invalid `vrmUrl` (should fall back gracefully)
3. Idle animation runs:
   - confirm the avatar scene is animating subtly

## Risk notes
- VRM loading APIs differ between `three-vrm` and `@pixiv/three-vrm`; implement the version that matches your installed package.
- Keep fallback so the app is usable even if you cannot ship a VRM asset yet.
