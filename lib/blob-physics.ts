export type Vec2 = { x: number; y: number };

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const polygonArea = (points: Particle[]): number => {
  let area = 0;
  const n = points.length;
  for (let i = 1; i <= n; i++) {
    area +=
      points[i % n].x * (points[(i + 1) % n].y - points[(i - 1 + n) % n].y);
  }
  return area * 0.5;
};

export const lineNormal = (a: Particle, b: Particle): Vec2 => {
  return { x: b.y - a.y, y: -(b.x - a.x) };
};

export class Particle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  damping: number;
  friction: number;
  mass: number;
  nextSibling!: Particle;
  prevSibling!: Particle;

  constructor(
    x: number,
    y: number,
    radius: number,
    damping: number,
    friction: number,
    mass = 1,
  ) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.damping = damping;
    this.friction = friction;
    this.mass = mass;
  }

  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  addForce(fx: number, fy: number): void {
    this.vx += fx;
    this.vy += fy;
  }

  testCollision(
    otherX: number,
    otherY: number,
    otherRadius: number,
  ): Vec2 | null {
    const diffX = otherX - this.x;
    const diffY = otherY - this.y;
    const distSq = diffX * diffX + diffY * diffY;
    const combined = this.radius + otherRadius;
    const combinedSq = combined * combined;
    if (distSq <= 0 || distSq >= combinedSq) {
      return null;
    }

    const dist = Math.sqrt(distSq);
    const push = dist - combined;
    const invDist = 1 / dist;

    return {
      x: diffX * invDist * push,
      y: diffY * invDist * push,
    };
  }

  collide(otherX: number, otherY: number, radius: number): void {
    const diffX = otherX - this.x;
    const diffY = otherY - this.y;
    const distSq = diffX * diffX + diffY * diffY;
    const combined = this.radius + radius;
    const combinedSq = combined * combined;
    if (distSq <= 0 || distSq >= combinedSq) {
      return;
    }

    const dist = Math.sqrt(distSq);
    const push = dist - combined;
    const invDist = 1 / dist;
    const fx = diffX * invDist * push;
    const fy = diffY * invDist * push;

    this.move(fx, fy);
    this.prevX += (this.x - this.prevX) * this.friction;
    this.prevY += (this.y - this.prevY) * this.friction;
  }

  constrain(left: number, top: number, right: number, bottom: number): void {
    const paddedLeft = left + this.radius;
    const paddedTop = top + this.radius;
    const paddedRight = right - this.radius;
    const paddedBottom = bottom - this.radius;

    let hitWall = false;

    if (this.x > paddedRight) {
      this.x = paddedRight;
      hitWall = true;
    } else if (this.x < paddedLeft) {
      this.x = paddedLeft;
      hitWall = true;
    }

    if (this.y > paddedBottom) {
      this.y = paddedBottom;
      hitWall = true;
    } else if (this.y < paddedTop) {
      this.y = paddedTop;
      hitWall = true;
    }

    if (hitWall) {
      this.prevX += (this.x - this.prevX) * this.friction;
      this.prevY += (this.y - this.prevY) * this.friction;
    }
  }

  update(dt: number): void {
    this.prevX = this.x;
    this.prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  endUpdate(dt: number): void {
    const dampingScale = this.damping / dt;
    this.vx = (this.x - this.prevX) * dampingScale;
    this.vy = (this.y - this.prevY) * dampingScale;
  }
}

export class DistanceJoint {
  pointA: Particle;
  pointB: Particle;
  len: number;
  strength: number;

  constructor(
    pointA: Particle,
    pointB: Particle,
    len: number,
    strength: number,
  ) {
    this.pointA = pointA;
    this.pointB = pointB;
    this.len = len;
    this.strength = strength;
  }

  update(dt: number): void {
    const diffX = this.pointB.x - this.pointA.x;
    const diffY = this.pointB.y - this.pointA.y;
    const distance = Math.sqrt(diffX * diffX + diffY * diffY);
    if (distance <= 0) {
      return;
    }

    const distanceDelta = this.len - distance;
    const massSum = this.pointA.mass + this.pointB.mass;
    const invDistance = 1 / distance;

    const aFactor = -(
      (this.pointA.mass / massSum) *
      distanceDelta *
      this.strength *
      dt *
      invDistance
    );
    const bFactor =
      (this.pointB.mass / massSum) *
      distanceDelta *
      this.strength *
      dt *
      invDistance;

    this.pointA.move(diffX * aFactor, diffY * aFactor);
    this.pointB.move(diffX * bFactor, diffY * bFactor);
  }
}

export class SpatialHash {
  cellSize: number;
  grid: Map<string, Particle[]>;

  constructor(cellSize: number) {
    this.cellSize = Math.max(4, Math.floor(cellSize));
    this.grid = new Map();
  }

  clear(): void {
    this.grid.clear();
  }

  private key(ix: number, iy: number): string {
    return `${ix}.${iy}`;
  }

  private index(value: number): number {
    return Math.floor(value / this.cellSize);
  }

  insert(particle: Particle): void {
    const ix = this.index(particle.x);
    const iy = this.index(particle.y);
    const key = this.key(ix, iy);
    const bucket = this.grid.get(key);
    if (bucket) {
      bucket.push(particle);
      return;
    }
    this.grid.set(key, [particle]);
  }

  query(x: number, y: number, radius: number): Particle[] {
    const ix0 = this.index(x - radius) - 1;
    const ix1 = this.index(x + radius) + 1;
    const iy0 = this.index(y - radius) - 1;
    const iy1 = this.index(y + radius) + 1;
    const result: Particle[] = [];

    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iy = iy0; iy <= iy1; iy++) {
        const bucket = this.grid.get(this.key(ix, iy));
        if (!bucket) {
          continue;
        }
        result.push(...bucket);
      }
    }

    return result;
  }
}

export type BlobEntity = {
  particles: Particle[];
  joints: DistanceJoint[];
  targetArea: number;
  areaDiff: number;
  preferredRadius: number;
  color: string;
};

export type PointerState = {
  x: number;
  y: number;
  active: boolean;
};

export const BLOB_COLORS = [
  "#3ec9d9",
  "#d791d5",
  "#3f22ff",
  "#98a8ee",
  "#3f8be5",
  "#ad8de0",
  "#62dfbb",
  "#2bafe1",
  "#f7ba22",
  "#ea25db",
  "#73fb0f",
  "#ff5d2a",
  "#36e4b4",
  "#bc5adf",
  "#72c7dd",
];

export const randomBetween = (min: number, max: number): number => {
  return min + Math.random() * (max - min);
};

export const createBlob = (
  x: number,
  y: number,
  radius: number,
  vertexSpacing: number,
  color: string,
): BlobEntity => {
  const pointCount = Math.max(
    9,
    Math.floor((radius * Math.PI * 2) / vertexSpacing),
  );
  const particles: Particle[] = [];

  for (let i = 0; i < pointCount; i++) {
    const t = i / pointCount;
    const angle = t * Math.PI * 2;
    particles.push(
      new Particle(
        Math.cos(angle) * radius + x,
        Math.sin(angle) * radius + y,
        vertexSpacing,
        1,
        0.1,
      ),
    );
  }

  for (let i = 0; i < pointCount; i++) {
    particles[i].prevSibling = particles[(i + pointCount - 1) % pointCount];
    particles[i].nextSibling = particles[(i + 1) % pointCount];
  }

  const joints: DistanceJoint[] = [];
  const halfTurn = Math.floor(pointCount / 2);

  for (let i = 0; i < pointCount; i++) {
    const current = particles[i];
    const next = current.nextSibling;
    const nextTwo = next.nextSibling;
    const nextThree = nextTwo.nextSibling;
    const opposite = particles[(i + halfTurn) % pointCount];

    joints.push(new DistanceJoint(current, next, vertexSpacing, 0.75));
    joints.push(new DistanceJoint(current, nextTwo, vertexSpacing * 2, 0.25));
    joints.push(new DistanceJoint(current, nextThree, vertexSpacing * 3, 0.1));
    if (pointCount >= 12) {
      joints.push(new DistanceJoint(current, opposite, radius * 2, 0.045));
    }
  }

  const baseArea = polygonArea(particles);

  return {
    particles,
    joints,
    targetArea: baseArea * randomBetween(0.84, 1.02),
    areaDiff: 0,
    preferredRadius: radius,
    color,
  };
};

export type SimulationState = {
  blobs: BlobEntity[];
  particles: Particle[];
  joints: DistanceJoint[];
  spatialHash: SpatialHash;
  width: number;
  height: number;
  vertexSpacing: number;
  seamWidth: number;
  pointerRadius: number;
  pointer: PointerState;
};

export const createSimulation = (): SimulationState => {
  return {
    blobs: [],
    particles: [],
    joints: [],
    spatialHash: new SpatialHash(20),
    width: 0,
    height: 0,
    vertexSpacing: 10,
    seamWidth: 6,
    pointerRadius: 80,
    pointer: { x: 0, y: 0, active: false },
  };
};

export const MARGIN = 20;
export const SUBSTEPS = 2;
export const GRAVITY = 0;

export const resetScene = (
  sim: SimulationState,
  width: number,
  height: number,
): void => {
  sim.width = width;
  sim.height = height;

  const minLength = Math.min(width, height);
  const maxRadius = minLength * 0.14;
  const minRadius = minLength * 0.055;
  sim.vertexSpacing = minLength * 0.022;
  sim.seamWidth = Math.max(4, sim.vertexSpacing * 0.9);
  sim.pointerRadius = minLength * 0.095;
  sim.spatialHash = new SpatialHash(sim.vertexSpacing * 2);

  sim.blobs = [];
  sim.particles = [];
  sim.joints = [];

  const innerWidth = width - MARGIN * 2;
  const innerHeight = height - MARGIN * 2;
  const columns = Math.max(6, Math.round(width / 170));
  const rows = Math.max(5, Math.round(height / 170));
  const cellWidth = innerWidth / columns;
  const cellHeight = innerHeight / rows;
  let colorIndex = 0;

  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      if (sim.particles.length > 1300) {
        break;
      }

      const radiusCap = Math.min(cellWidth, cellHeight) * 0.62;
      const radius = clamp(
        randomBetween(
          Math.min(minRadius, radiusCap * 0.6),
          Math.min(maxRadius, radiusCap),
        ),
        minRadius * 0.75,
        radiusCap,
      );

      const jitterX = (cellWidth - radius * 2) * 0.25;
      const jitterY = (cellHeight - radius * 2) * 0.25;
      const x =
        MARGIN + cellWidth * (column + 0.5) + randomBetween(-jitterX, jitterX);
      const y =
        MARGIN + cellHeight * (row + 0.5) + randomBetween(-jitterY, jitterY);

      const blob = createBlob(
        x,
        y,
        radius,
        sim.vertexSpacing,
        BLOB_COLORS[colorIndex % BLOB_COLORS.length],
      );

      sim.blobs.push(blob);
      sim.particles.push(...blob.particles);
      sim.joints.push(...blob.joints);
      colorIndex++;
    }
  }

  if (sim.blobs.length === 0) {
    const fallback = createBlob(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.2,
      sim.vertexSpacing,
      BLOB_COLORS[0],
    );
    sim.blobs.push(fallback);
    sim.particles.push(...fallback.particles);
    sim.joints.push(...fallback.joints);
  }
};

export const updatePhysics = (sim: SimulationState): void => {
  const {
    blobs,
    particles,
    joints,
    spatialHash,
    pointer,
    width,
    height,
    vertexSpacing,
  } = sim;
  const dt = 1 / 60;
  const subDt = dt / SUBSTEPS;
  const maxVelocity = (vertexSpacing / subDt) * 2;

  for (let step = 0; step < SUBSTEPS; step++) {
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const currentArea = polygonArea(blob.particles);
      blob.areaDiff = clamp(
        (blob.targetArea - currentArea) / blob.targetArea,
        -0.35,
        0.35,
      );

      const areaRatio =
        Math.abs(currentArea) / Math.max(1, Math.abs(blob.targetArea));
      if (areaRatio < 0.42) {
        let centerX = 0;
        let centerY = 0;
        for (let j = 0; j < blob.particles.length; j++) {
          centerX += blob.particles[j].x;
          centerY += blob.particles[j].y;
        }
        centerX /= blob.particles.length;
        centerY /= blob.particles.length;

        const minRadius = blob.preferredRadius * 0.62;
        for (let j = 0; j < blob.particles.length; j++) {
          const particle = blob.particles[j];
          const dx = particle.x - centerX;
          const dy = particle.y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= minRadius) {
            continue;
          }

          const push = (minRadius - dist) * 0.15;
          if (dist > 0.0001) {
            const invDist = 1 / dist;
            particle.move(dx * invDist * push, dy * invDist * push);
          } else {
            const angle = (j / blob.particles.length) * Math.PI * 2;
            particle.move(Math.cos(angle) * push, Math.sin(angle) * push);
          }
        }
      }
    }

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      particle.addForce(0, GRAVITY * subDt);

      const speed = Math.sqrt(
        particle.vx * particle.vx + particle.vy * particle.vy,
      );
      if (speed > maxVelocity) {
        const scale = maxVelocity / speed;
        particle.vx *= scale;
        particle.vy *= scale;
      }

      particle.update(subDt);
    }

    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      for (let j = 0; j < blob.particles.length; j++) {
        const particle = blob.particles[j];
        const normal = lineNormal(particle.prevSibling, particle.nextSibling);
        particle.move(
          normal.x * blob.areaDiff * 0.03,
          normal.y * blob.areaDiff * 0.03,
        );
      }
    }

    for (let i = 0; i < joints.length; i++) {
      joints[i].update(1);
    }

    spatialHash.clear();
    for (let i = 0; i < particles.length; i++) {
      spatialHash.insert(particles[i]);
    }

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      const nearby = spatialHash.query(particle.x, particle.y, particle.radius);
      for (let j = 0; j < nearby.length; j++) {
        const other = nearby[j];
        if (
          other === particle ||
          other === particle.nextSibling ||
          other === particle.prevSibling
        ) {
          continue;
        }

        const force = particle.testCollision(other.x, other.y, other.radius);
        if (!force) {
          continue;
        }
        particle.move(force.x * 0.5, force.y * 0.5);
        other.move(-force.x * 0.5, -force.y * 0.5);
      }
    }

    for (let i = 0; i < particles.length; i++) {
      const particle = particles[i];
      if (pointer.active) {
        particle.collide(pointer.x, pointer.y, sim.pointerRadius);
      }
      particle.constrain(MARGIN, MARGIN, width - MARGIN, height - MARGIN);
      particle.endUpdate(subDt);
    }
  }
};
