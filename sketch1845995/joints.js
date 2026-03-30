class DistanceJoint {
  constructor(
    pointA,
    pointB,
    len,
    strength
  ) {
    this.pointA = pointA;
    this.pointB = pointB;
    this.originalLen = len;
    this.len = len;
    this.strength = strength;
  }

  update(dt = 1) {
    const diffx = this.pointB.x - this.pointA.x;
    const diffy = this.pointB.y - this.pointA.y;
    const mag = (diffx * diffx + diffy * diffy) ** 0.5;
    const diffMag = this.len - mag;
    if (mag > 0) {
      const dA =
        (((this.pointA.mass / (this.pointA.mass + this.pointB.mass)) *
          diffMag *
          this.strength) /
          mag) *
        -dt;
      const dB =
        (((this.pointB.mass / (this.pointA.mass + this.pointB.mass)) *
          diffMag *
          this.strength) /
          mag) *
        dt;
      this.pointA.move(diffx * dA, diffy * dA);
      this.pointB.move(diffx * dB, diffy * dB);
    }
  }
}
