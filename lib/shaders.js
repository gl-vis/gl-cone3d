var glslify       = require('glslify')

var triVertSrc = glslify('./triangle-vertex.glsl')
var triFragSrc = glslify('./triangle-fragment.glsl')

exports.meshShader = {
  vertex:   triVertSrc,
  fragment: triFragSrc,
  attributes: [
    {name: 'position', type: 'vec4'},
    {name: 'normal', type: 'vec3'},
    {name: 'color', type: 'vec4'},
    {name: 'uv', type: 'vec2'},
    {name: 'vector', type: 'vec3'}
  ]
}