# Engineering Plan: Generative Systems for Commit Flipbook

This document outlines the roadmap for implementing advanced generative algorithms to visualize GitHub repositories. The goal is to move beyond simple particle systems into structured, mathematical art forms, strictly adhering to the **Zero Dependency** and **Deterministic** philosophy.

## Core Philosophy
Every algorithm must be **seeded** by repository data.
- `Math.random()` -> `this.rng()` (Seeded Linear Congruential Generator)
- Parameters (Noise scale, Fractal depth, Grid rules) -> Derived from `repo stats` (Commit count, Language distribution).

---

## 1. Noise Functions: "Code Topography"
**Concept:** Visualize the repository as a landscape. High "peaks" represent complex code or high activity; "valleys" are stable regions.
**Method:** Perlin/Simplex Noise (2D).
**Implementation:**
- **Algorithm:** Port a lightweight, seeded 2D Perlin Noise function to vanilla JS.
- **Mapping:**
    - `x, y` coordinates -> Noise value (0-1).
    - `Noise Scale` -> Proportional to `total_commits` (more commits = rougher terrain).
    - `Color Gradient` -> Mapped to commit authors or dominant language colors.
- **Visuals:** Flow fields or isolines (contour map) drawn based on noise values.

## 2. Fractals & Recursion: "The Directory Tree"
**Concept:** A literal or abstract tree structure representing the growth of the codebase.
**Method:** Recursive Branching (L-Systems).
**Implementation:**
- **Algorithm:** Recursive function `drawBranch(length, angle, depth)`.
- **Mapping:**
    - `Trunk` -> Initial commit.
    - `Branches` -> Splits based on major "merge" commits or time intervals.
    - `Branch Angle` -> Determined by commit hash characters.
    - `Leaves` -> Individual files or recent commits.
- **Emergence:** Complex organic structures emerge from simple branching rules defined by the project's history.

## 3. Cellular Automata: "Living History"
**Concept:** A grid where the state of the code evolves biologically.
**Method:** Conway's Game of Life or Cyclic Cellular Automaton.
**Implementation:**
- **Grid:** A canvas pixel grid (e.g., 100x100).
- **Initial State:** Seeded by the binary representation of the first 100 commit hashes.
- **Rules:**
    - Cells live/die based on neighbors.
    - **Modification:** Introduce "mutation" events triggered by actual commit timestamps in the animation loop.
- **Visuals:** A shifting, pixelated mosaic that stabilizes or "gliders" depending on repo activity.

## 4. Geometric Algorithms: "Contributor Mosaic"
**Concept:** Partitioning the screen into territories owned by different contributors.
**Method:** Voronoi Diagrams / Delaunay Triangulation.
**Implementation:**
- **Sites (Points):** Each active contributor is a "site" on the canvas.
    - Position: Deterministic hash of their username.
    - Weight: Number of commits (affects the size of their cell in weighted Voronoi).
- **Algorithm:** Compute Euclidean distance from every pixel to the nearest site to determine color.
- **Animation:** Sites slowly drift over time (representing changing influence), reshaping the boundaries.

## 5. Agent-Based Systems: "The Swarm"
**Concept:** Particles that exhibit complex group behavior.
**Method:** Boids (Flocking Simulation).
**Implementation:**
- **Agents:** Commits or files represented as boids.
- **Forces:**
    - **Separation:** Don't crowd (code modularity).
    - **Alignment:** Steer towards average heading (team cohesion).
    - **Cohesion:** Steer towards center of mass (project goal).
- **Mapping:**
    - "Predators" (Bugs/Issues) could chase the swarm, causing scattering.
    - "Attractors" (Milestones/Releases) pull the swarm together.

---

## Roadmap

### Phase 1: Core Utilities (Immediate)
- [ ] Implement `SeededPerlinNoise` class.
- [ ] Implement `Voronoi` helper (simple distance check version for GPU-less performance).

### Phase 2: New Styles (Next)
- [ ] **Style 'Topography':** Uses Perlin noise for flow fields.
- [ ] **Style 'Mosaic':** Uses Voronoi for contributor visualization.

### Phase 3: Advanced Styles (Future)
- [ ] **Style 'Tree':** Recursive fractal generator.
- [ ] **Style 'Life':** Cellular automata grid.
