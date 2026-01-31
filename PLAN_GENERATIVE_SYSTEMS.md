# Engineering Plan: Generative Systems for Commit Flipbook

This document outlines the roadmap for implementing advanced generative algorithms to visualize GitHub repositories. The goal is to move beyond simple particle systems into structured, mathematical art forms, strictly adhering to the **Zero Dependency** and **Deterministic** philosophy.

## Core Philosophy
Every algorithm must be **seeded** by repository data.
- `Math.random()` -> `this.rng()` (Seeded Linear Congruential Generator)
- Parameters (Noise scale, Fractal depth, Grid rules) -> Derived from `repo stats` (Commit count, Language distribution).

---

## Implemented Systems

### 1. Noise Functions: "Code Topography"
**Concept:** Visualize the repository as a landscape. High "peaks" represent complex code or high activity.
**Implemented:**
- `SeededPerlinNoise` class for deterministic 2D noise.
- Used in `flow`, `nebula`, `mosaic`, `paint` styles.

### 2. Geometric Construction: "Isometric City"
**Concept:** Treat the repo as a blueprint. Files are rooms, commits are structural changes.
**Implemented:** `drawCity` method.
- **Visuals:** Isometric projection of blocks.
- **Data Mapping:**
    - `X, Y`: Hashed from commit SHA (Location).
    - `Height`: Logarithmic scale of commit lines changed (Size).
    - `Color`: Hashed from Author Name (Ownership).
- **Themes:** 'Blueprint', 'Neon', 'Sunset'.

### 3. Abstract Expressionism: "Painterly"
**Concept:** Code as a living painting. Commits are brush strokes.
**Implemented:** `drawPainting` method.
- **Behavior:** Accumulative canvas (does not clear).
- **Styles:** 'Oil' (dense, textured), 'Watercolor' (transparent, spreading).
- **Data Mapping:**
    - `Brush Size`: Commit complexity.
    - `Color`: Author identity.
    - `Motion`: Driven by Perlin flow fields.

---

## Roadmap & Future Concepts

### Phase 1: Core Utilities (Done)
- [x] Implement `SeededPerlinNoise` class.
- [x] Implement `Voronoi` / `Mosaic` helper.

### Phase 2: Advanced Styles (In Progress)
- [x] **Style 'City':** Isometric architectural visualization.
- [x] **Style 'Paint':** Accumulative abstract art.
- [ ] **Style 'Loom':** Weaving threads (Textile art).

### Phase 3: "The Swarm" (Future)
- [ ] **Style 'Boids':** Flocking simulation where commits chase bugs.
- [ ] **Interactivity:** Mouse interaction to scatter/attract particles.

### Phase 4: Audio-Visual
- [ ] **Sonification:** Map commit frequency to audio frequencies? (Potential WebAudio API).