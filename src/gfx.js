(function(scope) {

scope.gfx_create_context = gfx_create_context;
scope.mat3               = mat3;
scope.mat3mulx           = mat3mulx;
scope.mat3muly           = mat3muly;
scope.mat3copy           = mat3copy;
scope.mat3identity       = mat3identity;
scope.mat3mul            = mat3mul;
scope.mat3translate      = mat3translate;
scope.mat3scale          = mat3scale;
scope.mat3skew           = mat3skew;
scope.mat3rotate         = mat3rotate;
scope.mat3ortho          = mat3ortho;

var u16_size = Uint16Array.BYTES_PER_ELEMENT;
var f32_size = Float32Array.BYTES_PER_ELEMENT;
var vertex_size = 4 * f32_size + 4;

var vertex = {x: 0, y: 0, u: 0, v: 0, rgba: [0, 0, 0, 0]};

var vs_src = [
	"attribute vec2 pos;",
	"attribute vec2 tex;",
	"attribute vec4 clr;",
	"uniform mat3 mvp;",
	"varying vec2 t;",
	"varying vec4 c;",
	"",
	"void main(void) {",
	"	c = clr;",
	"	t = tex;",
	"	gl_Position = vec4(mvp * vec3(pos, 1.0), 1.0);",
	"}",
	""
].join("\n");

var fs_src = [
	"precision mediump float;",
	"varying mediump vec2 t;",
	"varying mediump vec4 c;",
	"uniform sampler2D s;",
	"",
	"void main(void) {",
	"	gl_FragColor = texture2D(s, t) * c;",
	"}",
	""
].join("\n");

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

function gfx_create_context(canvas, params)
{
	return new Context(canvas, params);
}

function shader_create(gl, vs, fs)
{
	var program = gl.createProgram();

	gl.attachShader(program, shader_compile(gl, vs, gl.VERTEX_SHADER));
	gl.attachShader(program, shader_compile(gl, fs, gl.FRAGMENT_SHADER));
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS))
		console.log("Error linking shader program.");

	gl.useProgram(program);

	return program;
}

function shader_compile(gl, source, type)
{
	var shader = gl.createShader(type);

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
		console.log("Shader error: " + gl.getShaderInfoLog(shader));

	return shader;
}

function Context(canvas, params)
{
	this.canvas = canvas;
	this.gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);

	var gl = this.gl;

	this.mvp = mat3();
	this.proj = mat3();
	this.view = mat3();
	this.mvp_dirty = true;

	mat3identity(this.mvp);
	mat3identity(this.view);
	mat3identity(this.proj);

	this.framebuffer = gl.createFramebuffer();
	this.program = shader_create(gl, vs_src, fs_src);
	this.loc_mvp = gl.getUniformLocation(this.program, "mvp");;
	this.loc_pos = gl.getAttribLocation(this.program, "pos");
	this.loc_tex = gl.getAttribLocation(this.program, "tex");
	this.loc_clr = gl.getAttribLocation(this.program, "clr");

	this.White = this.create_texture(1, 1, gl.RGBA, function(x, y, rgba) {
		rgba[0] = rgba[1] = rgba[2] = rgba[3] = 1;
	});

	this.White.filter(gl.NEAREST, gl.NEAREST);

	gl.enableVertexAttribArray(this.loc_pos);
	gl.enableVertexAttribArray(this.loc_tex);
	gl.enableVertexAttribArray(this.loc_clr);

	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

Context.prototype.Stream  = WebGLRenderingContext.STREAM_DRAW;
Context.prototype.Static  = WebGLRenderingContext.STATIC_DRAW;
Context.prototype.Dynamic = WebGLRenderingContext.DYNAMIC_DRAW;

Context.prototype.Points        = WebGLRenderingContext.POINTS;
Context.prototype.LineStrip     = WebGLRenderingContext.LINE_STRIP;
Context.prototype.LineLoop      = WebGLRenderingContext.LINE_LOOP;
Context.prototype.Lines         = WebGLRenderingContext.LINES;
Context.prototype.TriangleStrip = WebGLRenderingContext.TRIANGLE_STRIP;
Context.prototype.TriangleFan   = WebGLRenderingContext.TRIANGLE_FAN;
Context.prototype.Triangles     = WebGLRenderingContext.TRIANGLES;

Context.prototype.RGBA  = WebGLRenderingContext.RGBA;
Context.prototype.RGB   = WebGLRenderingContext.RGB;
Context.prototype.Alpha = WebGLRenderingContext.ALPHA;

Context.prototype.Clamp  = WebGLRenderingContext.CLAMP_TO_EDGE;
Context.prototype.Repeat = WebGLRenderingContext.REPEAT;

Context.prototype.Linear               = WebGLRenderingContext.LINEAR;
Context.prototype.Nearest              = WebGLRenderingContext.NEAREST;
Context.prototype.NearestMipmapNearest = WebGLRenderingContext.NEAREST_MIPMAP_NEAREST;
Context.prototype.LinearMipmapNearest  = WebGLRenderingContext.LINEAR_MIPMAP_NEAREST;
Context.prototype.NearestMipmapLinear  = WebGLRenderingContext.NEAREST_MIPMAP_LINEAR;
Context.prototype.LinearMipmapLinear   = WebGLRenderingContext.LINEAR_MIPMAP_LINEAR;

Context.prototype.Zero                  = WebGLRenderingContext.ZERO;
Context.prototype.One                   = WebGLRenderingContext.ONE;
Context.prototype.SrcColor              = WebGLRenderingContext.SRC_COLOR;
Context.prototype.OneMinusSrcColor      = WebGLRenderingContext.ONE_MINUS_SRC_COLOR;
Context.prototype.SrcAlpha              = WebGLRenderingContext.SRC_ALPHA;
Context.prototype.OneMinusSrcAlpha      = WebGLRenderingContext.ONE_MINUS_SRC_ALPHA;
Context.prototype.DstAlpha              = WebGLRenderingContext.DST_ALPHA;
Context.prototype.OneMinusDstAlpha      = WebGLRenderingContext.ONE_MINUS_DST_ALPHA;
Context.prototype.DstColor              = WebGLRenderingContext.DST_COLOR;
Context.prototype.OneMinusDstColor      = WebGLRenderingContext.ONE_MINUS_DST_COLOR;
Context.prototype.SrcAlphaSaturate      = WebGLRenderingContext.SRC_ALPHA_SATURATE;
Context.prototype.ConstantColor         = WebGLRenderingContext.CONSTANT_COLOR;
Context.prototype.OneMinusConstantColor = WebGLRenderingContext.ONE_MINUS_CONSTANT_COLOR;
Context.prototype.ConstantAlpha         = WebGLRenderingContext.CONSTANT_ALPHA;
Context.prototype.OneMinusConstantAlpha = WebGLRenderingContext.ONE_MINUS_CONSTANT_ALPHA;

Context.prototype.FuncAdd             = WebGLRenderingContext.FUNC_ADD;
Context.prototype.FuncSubtract        = WebGLRenderingContext.FUNC_SUBTRACT;
Context.prototype.FuncReverseSubtract = WebGLRenderingContext.FUNC_REVERSE_SUBTRACT;

Context.prototype.clear = function()
{
	var gl = this.gl;
	gl.clear(gl.COLOR_BUFFER_BIT);
}

Context.prototype.clear_color = function(r, g, b, a)
{
	this.gl.clearColor(r, g, b, a);
}

Context.prototype.viewport = function(x, y, w, h)
{
	this.gl.viewport(x, y, w, h);
}

Context.prototype.scissor_enable = function(enable)
{
	var gl = this.gl;

	if (enable)
		gl.enable(gl.SCISSOR_TEST);
	else
		gl.disable(gl.SCISSOR_TEST);
}

Context.prototype.scissor = function(x, y, w, h)
{
	this.gl.scissor(x, y, w, h);
}

Context.prototype.projection = function(matrix)
{
	this.mvp_dirty = true;
	mat3copy(matrix, this.proj);
}

Context.prototype.transform = function(matrix)
{
	this.mvp_dirty = true;
	mat3copy(matrix, this.view);
}

Context.prototype.blend = function(src, dst, src_a, dst_a)
{
	this.gl.blendFuncSeparate(src, dst, src_a, dst_a);
}

Context.prototype.blend_eq = function(func, func_a)
{
	this.gl.blendEquationSeparate(func, func_a);
}

Context.prototype.blend_color = function(r, g, b, a)
{
	this.gl.blendColor(r, g, b, a);
}

Context.prototype.bind = function(texture)
{
	var gl = this.gl;
	gl.bindTexture(gl.TEXTURE_2D, texture.id);
}

Context.prototype.target = function(texture)
{
	var gl = this.gl;

	if (texture === null)
	{
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
	else
	{
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture.id, 0);
	}
}

Context.prototype.draw = function(mode, vbo, ibo, offset, count)
{
	var gl = this.gl;

	if (this.mvp_dirty)
	{
		mat3mul(this.proj, this.view, this.mvp);
		gl.uniformMatrix3fv(this.loc_mvp, false, this.mvp);
		this.mvp_dirty = false;
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, vbo.id);

	gl.vertexAttribPointer(this.loc_pos, 2, gl.FLOAT, false, vertex_size, 0);
	gl.vertexAttribPointer(this.loc_tex, 2, gl.FLOAT, false, vertex_size, 2 * f32_size);
	gl.vertexAttribPointer(this.loc_clr, 4, gl.UNSIGNED_BYTE, true, vertex_size, 4 * f32_size);

	if (ibo !== null)
	{
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo.id);
		gl.drawElements(mode, count, gl.UNSIGNED_SHORT, u16_size * offset);
	}
	else
	{
		gl.drawArrays(mode, offset, count);
	}
}

Context.prototype.create_vbo = function(capacity, usage)
{
	return new VertexBuffer(this.gl, capacity, usage);
}

Context.prototype.create_ibo = function(capacity, usage)
{
	return new IndexBuffer(this.gl, capacity, usage);
}

Context.prototype.create_texture = function()
{
	var texture = new Texture(this.gl);

	if (arguments.length === 1)
		texture.load_from_image(arguments[0]);
	else
		texture.create(arguments[0], arguments[1], arguments[2], arguments[3]);

	return texture;
}

// -----------------------------------------------------------------------------
// Texture
// -----------------------------------------------------------------------------

function Texture(gl)
{
	this.gl = gl;
	this.id = gl.createTexture();
	this.width = 0;
	this.height = 0;

	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

Texture.prototype.load_from_image = function(image)
{
	var gl = this.gl;
	this.width = image.width;
	this.height = image.height;

	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
}

Texture.prototype.create = function(w, h, format, func)
{
	var gl = this.gl;
	var data = null;

	this.width = w;
	this.height = h;

	if (func)
	{
		var channels = (format === gl.ALPHA ? 1 : format === gl.RGB ? 3 : 4);
		var rgba = [0, 0, 0, 0];

		data = new Uint8Array(w * h * channels);

		for (var y = 0, i = 0; y < h; y++)
		{
			for (var x = 0; x < w; x++)
			{
				func(x, y, rgba);

				rgba[0] = Math.max(Math.min(1, rgba[0]), 0);
				rgba[1] = Math.max(Math.min(1, rgba[1]), 0);
				rgba[2] = Math.max(Math.min(1, rgba[2]), 0);
				rgba[3] = Math.max(Math.min(1, rgba[3]), 0);

				if (channels > 1)
				{
					data[i++] = rgba[0] * 255;
					data[i++] = rgba[1] * 255;
					data[i++] = rgba[2] * 255;

					if (channels === 4)
						data[i++] = rgba[3] * 255;
				}
				else
				{
					data[i++] = rgba[3] * 255;
				}
			}
		}
	}

	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texImage2D(gl.TEXTURE_2D, 0, format, w, h, 0, format, gl.UNSIGNED_BYTE, data);
}

Texture.prototype.update = function(x, y, w, h, format, data)
{
	var gl = this.gl;
	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, format, gl.UNSIGNED_BYTE, data);
}

Texture.prototype.generate_mipmap = function()
{
	var gl = this.gl;
	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.generateMipmap(gl.TEXTURE_2D);
}

Texture.prototype.filter = function(min, mag)
{
	var gl = this.gl;
	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
}

Texture.prototype.wrap = function(u, v)
{
	var gl = this.gl;
	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, u);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, v);
}

// -----------------------------------------------------------------------------
// VertexBuffer
// -----------------------------------------------------------------------------

function VertexBuffer(gl, capacity, usage)
{
	this.gl = gl;

	this.id = gl.createBuffer();
	this.capacity = 0;
	this.size = 0;
	this.usage = usage;

	this.buffer = null;
	this.f32 = null;
	this.u8 = null;

	this.realloc(capacity, usage);
}

VertexBuffer.prototype.realloc = function(capacity, usage)
{
	this.usage = usage;
	this.capacity = capacity;
	this.size = 0;

	this.buffer = new ArrayBuffer(capacity * vertex_size);
	this.f32 = new Float32Array(this.buffer, 0, this.buffer.byteLength / f32_size);
	this.u8 = new Uint8Array(this.buffer, 0, this.buffer.byteLength);

	var gl = this.gl;

	gl.bindBuffer(gl.ARRAY_BUFFER, this.id);
	gl.bufferData(gl.ARRAY_BUFFER, this.buffer.byteLength, usage);
}

VertexBuffer.prototype.reserve = function(capacity)
{
	if (this.capacity < capacity)
	{
		var buf = this.u8;
		var size = this.size;

		this.realloc(capacity, this.usage);
		this.u8.set(buf.subarray(0, size * vertex_size));
		this.size = size;
	}
}

VertexBuffer.prototype.set = function(index, x, y, u, v, rgba)
{
	var base = index * vertex_size;
	var i = base / f32_size;

	this.f32[i++] = x;
	this.f32[i++] = y;
	this.f32[i++] = u;
	this.f32[i++] = v;
	this.u8.set(rgba, base + f32_size * 4);
}

VertexBuffer.prototype.get = function(index)
{
	var base = index * vertex_size;
	var i = base / f32_size;

	vertex.x = this.f32[i++];
	vertex.y = this.f32[i++];
	vertex.u = this.f32[i++];
	vertex.v = this.f32[i++];

	i = base + f32_size * 4;

	vertex.rgba[0] = this.u8[i++];
	vertex.rgba[1] = this.u8[i++];
	vertex.rgba[2] = this.u8[i++];
	vertex.rgba[3] = this.u8[i++];

	return vertex;
}

VertexBuffer.prototype.push = function(x, y, u, v, rgba)
{
	this.set(this.size, x, y, u, v, rgba);
	return this.size++;
}

VertexBuffer.prototype.pushv = function(v)
{
	this.set(this.size, v.x, v.y, v.u, v.v, v.rgba);
	return this.size++;
}

VertexBuffer.prototype.clear = function()
{
	this.size = 0;
}

VertexBuffer.prototype.upload = function(offset, count)
{
	var gl = this.gl;
	var beg = vertex_size * (offset || 0);
	var end = beg + vertex_size * (count || (this.size - beg));

	gl.bindBuffer(gl.ARRAY_BUFFER, this.id);
	gl.bufferSubData(gl.ARRAY_BUFFER, beg, this.u8.subarray(beg, end));
}

VertexBuffer.prototype.vertex_size = vertex_size;

// -----------------------------------------------------------------------------
// IndexBuffer
// -----------------------------------------------------------------------------

function IndexBuffer(gl, capacity, usage)
{
	this.gl = gl;

	this.id = gl.createBuffer();
	this.capacity = 0;
	this.size = 0;
	this.usage = usage;
	this.buffer = null;

	this.realloc(capacity, usage);
}

IndexBuffer.prototype.realloc = function(capacity, usage)
{
	this.usage = usage;
	this.capacity = capacity;
	this.size = 0;
	this.buffer = new Uint16Array(capacity);

	var gl = this.gl;

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.id);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.buffer.byteLength, usage);
}

IndexBuffer.prototype.reserve = function(capacity)
{
	if (this.capacity < capacity)
	{
		var buf = this.buffer;
		var size = this.size;

		this.realloc(capacity, this.usage);
		this.buffer.set(buf.subarray(0, size));
		this.size = size;
	}
}

IndexBuffer.prototype.set = function(index, value)
{
	this.buffer[index] = value;
}

IndexBuffer.prototype.get = function(index)
{
	return this.buffer[index];
}

IndexBuffer.prototype.push = function()
{
	for (var i = 0, n = arguments.length; i < n; i++)
		this.buffer[this.size++] = arguments[i];
}

IndexBuffer.prototype.clear = function()
{
	this.size = 0;
}

IndexBuffer.prototype.upload = function(offset, count)
{
	var gl = this.gl;
	var beg = offset || 0;
	var end = beg  + (count || (this.size - beg));

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.id);
	gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, beg * u16_size, this.buffer.subarray(beg, end));
}

// -----------------------------------------------------------------------------
// mat3 functions
// -----------------------------------------------------------------------------

function mat3() { return new Float32Array(9); }
function mat3mulx(m, x, y) { return m[0] * x + m[3] * y + m[6]; }
function mat3muly(m, x, y) { return m[1] * x + m[4] * y + m[7]; }

function mat3copy(src, dest)
{
	dest.set(src);
	return dest;
}

function mat3identity(out)
{
	out[0] = 1; out[3] = 0; out[6] = 0;
	out[1] = 0; out[4] = 1; out[7] = 0;
	out[2] = 0; out[5] = 0; out[8] = 1;
	return out;
}

function mat3mul(a, b, out)
{
	out[0] = a[0] * b[0] + a[3] * b[1];
	out[1] = a[1] * b[0] + a[4] * b[1];
	out[2] = 0;
	out[3] = a[0] * b[3] + a[3] * b[4];
	out[4] = a[1] * b[3] + a[4] * b[4];
	out[5] = 0;
	out[6] = a[0] * b[6] + a[3] * b[7] + a[6];
	out[7] = a[1] * b[6] + a[4] * b[7] + a[7];
	out[8] = 1;
	return out;
}

function mat3translate(x, y, out)
{
	out[0] = 1; out[3] = 0; out[6] = x;
	out[1] = 0; out[4] = 1; out[7] = y;
	out[2] = 0; out[5] = 0; out[8] = 1;
	return out;
}

function mat3scale(x, y, out)
{
	out[0] = x; out[3] = 0; out[6] = 0;
	out[1] = 0; out[4] = y; out[7] = 0;
	out[2] = 0; out[5] = 0; out[8] = 1;
	return out;
}

function mat3skew(x, y, out)
{
	out[0] = 1; out[3] = y; out[6] = 0;
	out[1] = x; out[4] = 1; out[7] = 0;
	out[2] = 0; out[5] = 0; out[8] = 1;
	return out;
}

function mat3rotate(rot, out)
{
	var c = Math.cos(rot), s = Math.sin(rot);
	out[0] = c; out[3] = -s; out[6] = 0;
	out[1] = s; out[4] =  c; out[7] = 0;
	out[2] = 0; out[5] =  0; out[8] = 1;
	return out;
}

function mat3ortho(left, right, bottom, top, out)
{
	var w = right - left, h = top - bottom;
	out[0] = 2 / w; out[3] = 0;     out[6] = -(right + left) / w;
	out[1] = 0;     out[4] = 2 / h; out[7] = -(top + bottom) / h;
	out[2] = 0;     out[5] = 0;     out[8] =  1;
	return out;
}

}(this));
