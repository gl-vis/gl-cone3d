var createCamera = require('3d-view-controls')
var getBounds    = require('bound-points')
var perspective  = require('gl-mat4/perspective')
var createAxes   = require('gl-axes3d')
var createSpikes = require('gl-spikes3d')
var createSelect = require('gl-select-static')
var getBounds    = require('bound-points')
var mouseChange  = require('mouse-change')
var createMesh   = require('gl-mesh3d')
var createConePlot = require('../cone')
var createShader = require('gl-shader')

var shaders = require('../lib/shaders')

var bounds = []

var wind = require('./dataset-wind')
var conePlot = createConePlot(wind, bounds)

var canvas = document.createElement('canvas')
document.body.appendChild(canvas)
window.addEventListener('resize', require('canvas-fit')(canvas))
var gl = canvas.getContext('webgl')

var camera = createCamera(canvas, {
  eye:    bounds[0],
  center: [0.5*(bounds[0][0]+bounds[1][0]),
           0.5*(bounds[0][1]+bounds[1][1]),
           0.5*(bounds[0][2]+bounds[1][2])],
  zoomMax: 500,
  mode: 'turntable'
})

conePlot.colormap = 'portland'
var mesh = createMesh(gl, conePlot)

function createConeShader(gl, meshShader) {
  var shader = createShader(gl, meshShader.vertex, meshShader.fragment)
  shader.attributes.position.location = 0
  shader.attributes.color.location    = 2
  shader.attributes.uv.location       = 3
  shader.attributes.vector.location   = 4
  shader.uniforms.vectorScale = conePlot.vectorScale;
  return shader
}

var shader = createConeShader(gl, shaders.meshShader)
mesh.triShader = shader

var select = createSelect(gl, [canvas.width, canvas.height])
var tickSpacing = 5;
var ticks = bounds[0].map((v,i) => {
  var arr = [];
  var firstTick = Math.ceil(bounds[0][i] / tickSpacing) * tickSpacing;
  var lastTick = Math.floor(bounds[1][i] / tickSpacing) * tickSpacing;
  for (var tick = firstTick; tick <= lastTick; tick += tickSpacing) {
    if (tick === -0) tick = 0;
    arr.push({x: tick, text: tick.toString()});
  }
  return arr;
});
var axes = createAxes(gl, { bounds: bounds, ticks: ticks })
var spikes = createSpikes(gl, {
  bounds: bounds
})
var spikeChanged = false

mouseChange(canvas, function(buttons, x, y) {
  var pickData = select.query(x, canvas.height - y, 10)
  var pickResult = mesh.pick(pickData)
  if(pickResult) {
    spikes.update({
      position: pickResult.position,
      enabled: [true, true, true]
    })
    spikeChanged = true
  } else {
    spikeChanged = spikes.enabled[0]
    spikes.update({
      enabled: [false, false, false]
    })
  }
})

function render() {
  requestAnimationFrame(render)

  gl.enable(gl.DEPTH_TEST)

  var needsUpdate = camera.tick()
  var cameraParams = {
    projection: perspective([], Math.PI/4, canvas.width/canvas.height, 0.01, 1000),
    view: camera.matrix
  }

  if(needsUpdate || spikeChanged) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    axes.draw(cameraParams)
    spikes.draw(cameraParams)
    mesh.draw(cameraParams)
    spikeChanged = false
  }

  if(needsUpdate) {
    select.shape = [canvas.width, canvas.height]
    select.begin()
    mesh.drawPick(cameraParams)
    select.end()
  }
}
render()
