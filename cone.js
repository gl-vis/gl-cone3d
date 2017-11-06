"use strict";

const V = require('gl-vec3');

const vec3 = function(x, y, z) {
	let v = V.create();
	if (x !== undefined) {
		V.set(v, x, y, z);
	}
	return v;
}

module.exports = function(vectorfield, bounds) {
	var positions = vectorfield.positions;
	var vectors = vectorfield.vectors;
	let geo = {
		positions: [],
		vertexIntensity: [],
		vertexNormals: [],
		cells: [],
		colormap: vectorfield.colormap
	};

	// Compute bounding box for the dataset.
	// Compute maximum velocity for the dataset to use for scaling the cones.
	let maxLen = 0;
	let minX = 1/0, maxX = -1/0;
	let minY = 1/0, maxY = -1/0;
	let minZ = 1/0, maxZ = -1/0;
	for (let i = 0; i < positions.length; i++) {
		let v1 = positions[i];
		minX = Math.min(v1[0], minX);
		maxX = Math.max(v1[0], maxX);
		minY = Math.min(v1[1], minY);
		maxY = Math.max(v1[1], maxY);
		minZ = Math.min(v1[2], minZ);
		maxZ = Math.max(v1[2], maxZ);
		let u = vectors[i];
		if (V.length(u) > maxLen) {
			maxLen = V.length(u);
		}
	}
	let minV = [minX, minY, minZ];
	let maxV = [maxX, maxY, maxZ];
	if (bounds) {
		bounds[0] = minV;
		bounds[1] = maxV;
	}
	let scaleV = V.subtract(vec3(), maxV, minV);
	let imaxLen = 1 / maxLen;

	// Build the cone model.
	for (let i = 0; i < positions.length; i++) {

		// Vector at point i, scaled down by maximum magnitude.
		let d = vectors[i];
		V.scale(d, d, imaxLen);

		// Position at point i.
		let v1 = positions[i];

		// Intensity for the cone.
		var intensity = V.length(d);

		// Scale the cone up so that maximum magnitude cone touches the next cone's base.
		V.scale(d, d, 2);

		let v2 = V.subtract(vec3(), v1, d);
		let u = vec3(0,1,0);
		V.cross(u, u, d);
		V.normalize(u, u);
		let v = V.cross(vec3(),u,d);
		V.normalize(v,v);
		let v4, n4;
		let nback = V.clone(d);
		V.normalize(nback, nback);
		V.negate(nback, nback);
		for (let k = 0, l = 8; k <= l; k++) {
			let a = k/l * Math.PI*2;
			let x = V.scale(vec3(), u, Math.cos(a)*V.length(d)*0.25);
			let y = V.scale(vec3(), v, Math.sin(a)*V.length(d)*0.25);
			let tx = V.scale(vec3(), u, Math.sin(a));
			let ty = V.scale(vec3(), v, -Math.cos(a));
			let v3 = V.add(vec3(), v2, x);
			V.add(v3, v3, y);
			let t3 = V.add(vec3(), tx, ty);
			let n3 = V.subtract(vec3(), v3, v1);
			V.cross(n3, n3, t3);
			V.normalize(n3, n3);
			if (k > 0) {
				geo.positions.push(v3, v4, v1);
				geo.vertexIntensity.push(intensity, intensity, intensity);
				geo.vertexNormals.push(n3, n4, n3);

				geo.positions.push(v2, v4, v3);
				geo.vertexIntensity.push(intensity, intensity, intensity);
				geo.vertexNormals.push(nback, nback, nback);

				let m = geo.positions.length;
				geo.cells.push([m-6, m-5, m-4], [m-3, m-2, m-1]);
			}
			v4 = v3;
			n4 = n3;
		}
	}

	return geo;
};