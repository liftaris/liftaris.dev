class Particle extends Coordinate2D {
  constructor({
    x,
    y,
    z,
    radius,
    damping,
    friction,
    mass,
    parent,
  }) {
    super(x, y);
    this.prevX = x;
    this.prevY = y;
    this.sx = x;
    this.sy = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius ?? 10;
    this.damping = damping ?? 0.9;
    this.friction = friction ?? 0.1;
    this.mass = mass ?? 1;
    this.parent = parent;
  }

  setClient(client) {
    this.client = client;
  }

  move(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  addForce(fx, fy) {
    this.vx += fx;
    this.vy += fy;
  }

  attract(
    otherX,
    otherY,
    strength = 1
  ) {
    const diffx = otherX - this.x;
    const diffy = otherY - this.y;
    const mag = diffx * diffx + diffy * diffy;
    if (mag > 0.1) {
      const magSqrt = 1 / mag ** 0.5;
      this.addForce(
        diffx * magSqrt * strength, // force x
        diffy * magSqrt * strength, // force y
      );
    }
  }

  repel(
    otherX,
    otherY,
    radius = 1,
    strength = 1
  ) {
    const diffx = this.x - otherX;
    const diffy = this.y - otherY;
    const mag = diffx * diffx + diffy * diffy;
    const combinedRadius = radius + this.radius;
    const minDist = combinedRadius * combinedRadius;
    if (mag > 0 && mag < minDist) {
      const magSqrt = 1 / mag ** 0.5;
      const forceX = diffx * magSqrt * strength;
      const forceY = diffy * magSqrt * strength;
      this.addForce(forceX, forceY);
      return new Coordinate2D(forceX, forceY);
    }

    return null;
  }

  testCollision(
    otherX,
    otherY,
    radius
  ) {
    const diffx = otherX - this.x;
    const diffy = otherY - this.y;
    const diffMag = diffx * diffx + diffy * diffy;
    const combinedRadius = radius + this.radius;
    if (diffMag < combinedRadius ** 2) {
      const forceMag = diffMag ** 0.5 - combinedRadius;
      const invMag = 1 / diffMag;
      const fx = diffx * invMag * forceMag;
      const fy = diffy * invMag * forceMag;

      return new Coordinate2D(fx, fy);
    }
    return null;
  }

  collide(
    otherX,
    otherY,
    radius
  ) {
    const diffx = otherX - this.x;
    const diffy = otherY - this.y;
    const diffMag = diffx * diffx + diffy * diffy;
    const combinedRadius = radius + this.radius;
    if (diffMag < combinedRadius ** 2) {
      const forceMag = diffMag ** 0.5 - combinedRadius;
      const invMag = 1 / diffMag;
      const fx = diffx * invMag * forceMag;
      const fy = diffy * invMag * forceMag;

      this.move(fx, fy);

      this.prevX = lerp(this.prevX, this.x, this.friction);
      this.prevY = lerp(this.prevY, this.y, this.friction);

      return new Coordinate2D(fx, fy);
    }

    return null;
  }

  constrain(
    left,
    top,
    right,
    bottom,
  ) {
    const { x, y, friction, radius } = this;

    left += radius;
    top += radius;
    right -= radius;
    bottom -= radius;

    let collide = false;

    if (x > right) {
      this.x = right;
      collide = true;
    } else if (x < left) {
      this.x = left;
      collide = true;
    }
    if (y > bottom) {
      this.y = bottom;
      collide = true;
    } else if (y < top) {
      this.y = top;
      collide = true;
    }

    if (collide) {
      this.prevX = lerp(this.prevX, this.x, friction);
      this.prevY = lerp(this.prevY, this.y, friction);
    }
  }

  getVelocity() {
    return new Coordinate2D(this.vx, this.vy);
  }

  getVelocityMag() {
    return (this.vx * this.vx + this.vy * this.vy) ** 0.5;
  }

  update(dt = 1) {
    this.prevX = this.x;
    this.prevY = this.y;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  endUpdate(dt = 1) {
    const m = this.damping / dt;
    this.vx = (this.x - this.prevX) * m;
    this.vy = (this.y - this.prevY) * m;
  }

  updateClient() {
    if (this.client) this.client.update();
  }
}

class ChainableParticle extends Particle {
  setIsRoot(isRoot) {
    this.isRoot = isRoot;
  }

  setNextSibling(sibling) {
    this.nextSibling = sibling;
  }
  setPrevSibling(sibling) {
    this.prevSibling = sibling;
  }
}
