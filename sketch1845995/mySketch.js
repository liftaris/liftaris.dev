const maxVertexCount = 750; // Increase to get more blobs. Not really a max but more of a guideline for the setup :)
const substeps = 10; // How many physics steps per frame
const maxRadius = 0.25; // relative to min canvas length [min(widht,length)]
const minRadius = 0.1; // relative to min canvas length [min(widht,length)]
const vertexDistance = 0.015; // How far apart are the vertices (relative to min canvas length) (smaller number == more cpu work)
const outlineOnly = false; // draw only the outline, no fill
const showCollisionAreas = false;

let mx;
let my;
let blobs;
let particles;
let distanceJoints;
let hashGrid;
let effectiveVertexDistance;

const marginX = 20;
const marginY = 20;

function setup() {
	createCanvas(windowWidth, windowHeight);
	colorMode(HSB, 360, 100, 100, 100);
	pixelDensity(1);
	frameRate(50);
	cursor(CROSS);
	
	effectiveVertexDistance = vertexDistance * min(width,height);

	mx = 0;
	my = 0;
	hashGrid = new HashGrid(width, height, Math.floor(effectiveVertexDistance*2));
	particles = [];
	distanceJoints = [];
	blobs = [];

	const minLength = min(width, height);
	let offsetY = 0;
	let totalArea = 0;
	let prevRadius = 0;
	let maxArea = (width - marginX * 2) * (height - marginY * 2) * 0.8;
	while (totalArea < maxArea && particles.length < maxVertexCount) {
		const radiusLimit = (maxArea - totalArea) / (PI * 2);
		const radius = Math.min(radiusLimit, (random(1) ** 3 * (maxRadius-minRadius) + minRadius)*minLength);
		offsetY += prevRadius + radius + 50;
		const blob = generateBlob(width / 2+random(-1,1)*(width/2-marginX-radius), height / 2 - offsetY, radius);
		totalArea += blob.area;
		blobs.push(blob);
		particles.push(...blob.particles);
		distanceJoints.push(...blob.joints);

		prevRadius = radius;
	}
};

function draw(){
	const mr = min(width,height)*0.1;
	mx = lerp(mx, mouseX, 1);
	my = lerp(my, mouseY, 1);

	const dt = 1 / 60;
	const sdt = dt / substeps;
	
	for(let i=particles.length; i--;){
			const particle = particles[i];
			particle.updateClient();
	}

	for (let substep = substeps; substep--; ) {
		for(let i=blobs.length; i--;){
			const blob = blobs[i];
			blob.currentArea = geometry.polygonArea(blob.particles);
			blob.areaDiff = (blob.area - blob.currentArea) / blob.area;
		}

		for(let i=particles.length; i--;){
			const particle = particles[i];
			particle.addForce(0, 1000 * sdt, 0);
			const v = geometry.limit({ x: particle.vx, y: particle.vy }, effectiveVertexDistance / sdt *2);
			particle.vx = v.x;
			particle.vy = v.y;
			particle.update(sdt);
		}

		for(let i=particles.length; i--;){
			const v = particles[i];
			// Area constraint
			const v0 = v.prevSibling;
			const v1 = v.nextSibling;
			const lineNormal = geometry.getLineNormal(v0.x, v0.y, v1.x, v1.y);
			const dir = v.parent.areaDiff;
			v.move(lineNormal.x * dir, lineNormal.y * dir, 0);
		}

		for(let i=distanceJoints.length; i--;){
			distanceJoints[i].update(1);
		}

		for(let i=particles.length; i--;){
			const particle = particles[i];
			hashGrid
				.query(particle.x, particle.y, particle.radius)
				.forEach((other) => {
					if (
						other === particle ||
						other === particle.nextSibling ||
						other === particle.prevSibling
					)
						return;

					const force = particle.testCollision(
						other.x,
						other.y,
						other.radius
					);

					if (force) {
						particle.move(force.x * 0.5, force.y * 0.5);
						other.move(-force.x * 0.5, -force.y * 0.5);
					}
				});
		}

		for(let i=particles.length; i--;){
			const particle = particles[i];
			particle.collide(mx,my,mr,9999);
			particle.constrain(
				marginX,
				-99999,
				width - marginX,
				height - marginY,
			);
			particle.endUpdate(sdt);
		}
	}

	background(10);
	fill(20);
	noStroke();
	circle(mx, my, mr * 2 - 2);

	for(let i=blobs.length; i--;){
		const blob = blobs[i];
		let currentParticle = blob.rootParticle;

		if(outlineOnly){
			stroke(blob.color);
			noFill();
			strokeWeight(1);
		}
		else {
			stroke(blob.color);
			strokeWeight(effectiveVertexDistance*2-6);
			fill(blob.color);
		}
		beginShape();
		do {
			curveVertex(currentParticle.x, currentParticle.y);
			currentParticle = currentParticle.nextSibling;
		} while (currentParticle !== blob.rootParticle);
		
		curveVertex(currentParticle.x, currentParticle.y);
		currentParticle = currentParticle.nextSibling;
		curveVertex(currentParticle.x, currentParticle.y);
		currentParticle = currentParticle.nextSibling;
		curveVertex(currentParticle.x, currentParticle.y);
		endShape();

		
		if(showCollisionAreas){
			strokeWeight(1);
			stroke(blob.color);
			noFill();
			currentParticle = blob.rootParticle;
			do {
				circle(currentParticle.x, currentParticle.y, currentParticle.radius*2);
				currentParticle = currentParticle.nextSibling;
			} while (currentParticle !== blob.rootParticle);
		}
	}
}

function generateBlob(offsetX, offsetY, radius) {
	const numPoints = Math.floor((radius * PI * 2) / effectiveVertexDistance);
	const vertices = new Array(numPoints).fill(0).map((_, i, { length }) => {
		const t = i / length;
		const angle = t * TWO_PI;
		const particle = new ChainableParticle({
			x: Math.cos(angle) * radius + offsetX,
			y: Math.sin(angle) * radius + offsetY,
			z: 0,
			damping: 1,
			friction: 0.1,
			radius: effectiveVertexDistance,
			mass: 1,
		});
		particle.setClient(hashGrid.createClient(particle));
		return particle;
	});

	vertices.forEach((v, i, { length }) => {
		const vprev = vertices[(i + length - 1) % length];
		const vnext = vertices[(i + 1) % length];

		v.setPrevSibling(vprev);
		v.setNextSibling(vnext);

		if (i === 0) {
			v.setIsRoot(true);
		}
	});

	const joints = vertices
		.map((v) => {
			const v2 = v.nextSibling.nextSibling;
			return [
				new DistanceJoint(
					v,
					v.nextSibling,
					effectiveVertexDistance,
					0.75
				),
				new DistanceJoint(
					v,
					v2,
					effectiveVertexDistance * 2,
					0.25
				),
			];
		})
		.flat();

	const area = geometry.polygonArea(vertices) * random(0.6,0.9);
	const blob = {
		area,
		currentArea: area,
		areaDiff: 0,
		rootParticle: vertices[0],
		particles: vertices,
		joints,
		radius,
		color: color(random(360), random(30, 100), 100),
	};

	blob.particles.forEach((particle) => {
		particle.parent = blob;
	});

	return blob;
}
