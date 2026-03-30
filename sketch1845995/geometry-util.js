const EPSILON = 0.00001;

const geometry={
	getLineNormal: (
		x1,
		y1,
		x2,
		y2
	) => {
		return { x: y2 - y1, y: -(x2 - x1) };
	},
		normalize:(coord) => {
  let mag = (coord.x * coord.x + coord.y * coord.y) ** 0.5;
  if (mag > 1) {
    return {
      x: coord.x / mag,
      y: coord.y / mag,
    };
  }

  return { x: 0, y: 0 };
},

limit: (coord, maxLength) => {
  if (!coord) return null;
  let mag = (coord.x * coord.x + coord.y * coord.y) ** 0.5;
  if (mag > maxLength) {
    return {
      x: (coord.x / mag) * maxLength,
      y: (coord.y / mag) * maxLength,
    };
  }
  return coord;
},
	rotate: (x, y, rot) => {
  return {
    x: x * Math.cos(rot) - y * Math.sin(rot),
    y: x * Math.sin(rot) + y * Math.cos(rot),
  };
},
	polygonArea: (polygon) => {
  // compute area
  let area = 0;
  const n = polygon.length;
  for (let i = 1; i <= n; i++) {
    area +=
      polygon[i % n].x * (polygon[(i + 1) % n].y - polygon[(i - 1) % n].y);
  }
  return area / 2;
}
}
