"use strict";

const V = require('gl-vec3');

const vec3 = function(x, y, z) {
	let v = V.create();
	if (x !== undefined) {
		V.set(v, x, y, z);
	}
	return v;
}

var createPositionsForMeshgrid = function([xs, ys, zs]) {
  var positions = [];
  for (var z=0; z<zs.length; z++) {
    for (var y=0; y<ys.length; y++) {
      for (var x=0; x<xs.length; x++) {
        positions.push([zs[z], ys[y], xs[x]]);
      }
    }
  }
  return positions;
};

const findLastSmallerIndex = function(points, v) {
  for (var i=0; i<points.length; i++) {
    if (points[i] >= v) {
      return i-1;
    }
  }
  return i;
};

const tmp = V.create();
const tmp2 = V.create();

const clamp = function(v, min, max) {
	return v < min ? min : (v > max ? max : v);
};

const sampleMeshgrid = function(point, array, meshgrid, clampOverflow) {
	const x = point[0];
	const y = point[1];
	const z = point[2];

	var w = meshgrid[0].length;
	var h = meshgrid[1].length;
	var d = meshgrid[2].length;

	// Find the index of the nearest smaller value in the meshgrid for each coordinate of (x,y,z).
	// The nearest smaller value index for x is the index x0 such that
	// meshgrid[0][x0] < x and for all x1 > x0, meshgrid[0][x1] >= x.
	var x0 = findLastSmallerIndex(meshgrid[0], x);
	var y0 = findLastSmallerIndex(meshgrid[1], y);
	var z0 = findLastSmallerIndex(meshgrid[2], z);

	// Get the nearest larger meshgrid value indices.
	// From the above "nearest smaller value", we know that
	//   meshgrid[0][x0] < x
	//   meshgrid[0][x0+1] >= x
	var x1 = x0 + 1;
	var y1 = y0 + 1;
	var z1 = z0 + 1;

	if (clampOverflow) {
		x0 = clamp(x0, 0, w-1);
		x1 = clamp(x1, 0, w-1);
		y0 = clamp(y0, 0, h-1);
		y1 = clamp(y1, 0, h-1);
		z0 = clamp(z0, 0, d-1);
		z1 = clamp(z1, 0, d-1);
	}

	// Reject points outside the meshgrid, return a zero vector.
	if (x0 < 0 || y0 < 0 || z0 < 0 || x1 >= w || y1 >= h || z1 >= d) {
		return V.create();
	}

	// Normalize point coordinates to 0..1 scaling factor between x0 and x1.
	var xf = (x - meshgrid[0][x0]) / (meshgrid[0][x1] - meshgrid[0][x0]);
	var yf = (y - meshgrid[1][y0]) / (meshgrid[1][y1] - meshgrid[1][y0]);
	var zf = (z - meshgrid[2][z0]) / (meshgrid[2][z1] - meshgrid[2][z0]);

	if (xf < 0 || xf > 1 || isNaN(xf)) xf = 0;
	if (yf < 0 || yf > 1 || isNaN(yf)) yf = 0;
	if (zf < 0 || zf > 1 || isNaN(zf)) zf = 0;

	var z0off = z0*w*h;
	var z1off = z1*w*h;

	var y0off = y0*w;
	var y1off = y1*w;

	var x0off = x0;
	var x1off = x1;

	// Sample data array around the (x,y,z) point.
	//  vZYX = array[zZoff + yYoff + xXoff]
	var v000 = array[y0off + z0off + x0off];
	var v001 = array[y0off + z0off + x1off];
	var v010 = array[y1off + z0off + x0off];
	var v011 = array[y1off + z0off + x1off];
	var v100 = array[y0off + z1off + x0off];
	var v101 = array[y0off + z1off + x1off];
	var v110 = array[y1off + z1off + x0off];
	var v111 = array[y1off + z1off + x1off];

	var result = V.create();

	// Average samples according to distance to point.
	V.lerp(result, v000, v001, xf);
	V.lerp(tmp, v010, v011, xf);
	V.lerp(result, result, tmp, yf);
	V.lerp(tmp, v100, v101, xf);
	V.lerp(tmp2, v110, v111, xf);
	V.lerp(tmp, tmp, tmp2, yf);
	V.lerp(result, result, tmp, zf);

	return result;
};

module.exports = function(vectorfield, bounds) {
	var positions;
	if (vectorfield.positions) {
		positions = vectorfield.positions;
	} else {
		positions = createPositionsForMeshgrid(vectorfield.meshgrid);
	}
	var meshgrid = vectorfield.meshgrid;
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
	let positionVectors = [];
	for (let i = 0; i < positions.length; i++) {
		let v1 = positions[i];
		minX = Math.min(v1[0], minX);
		maxX = Math.max(v1[0], maxX);
		minY = Math.min(v1[1], minY);
		maxY = Math.max(v1[1], maxY);
		minZ = Math.min(v1[2], minZ);
		maxZ = Math.max(v1[2], maxZ);
		let u;
		if (meshgrid) {
			u = sampleMeshgrid(v1, vectors, meshgrid, true);
		} else {
			u = vectors[i];
		}
		if (V.length(u) > maxLen) {
			maxLen = V.length(u);
		}
		positionVectors.push(u);
	}
	let minV = [minX, minY, minZ];
	let maxV = [maxX, maxY, maxZ];
	if (bounds) {
		bounds[0] = minV;
		bounds[1] = maxV;
	}
	let scaleV = V.subtract(vec3(), maxV, minV);
	let imaxLen = 1 / maxLen;

	let coneScale = vectorfield.coneSize || 2;

	if (vectorfield.absoluteConeSize) {
		coneScale = vectorfield.absoluteConeSize * maxLen;
	}

	// Build the cone model.
	for (let i = 0; i < positions.length; i++) {

		// Position at point i.
		let v1 = positions[i];

		// Vector at point i, scaled down by maximum magnitude.
		let d = positionVectors[i];
		V.scale(d, d, imaxLen);

		// Intensity for the cone.
		var intensity = V.length(d);

		// Scale the cone up so that maximum magnitude cone touches the next cone's base.
		V.scale(d, d, coneScale);

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