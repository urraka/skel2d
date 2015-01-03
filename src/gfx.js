(function() {

var szuint16 = Uint16Array.BYTES_PER_ELEMENT;
var szfloat = Float32Array.BYTES_PER_ELEMENT;
var szvertex = (2 + 2 + 1) * szfloat;

var gfx = {};
var gl = null;

var cache = {
	matrix1: mat3(),
	matrix2: mat3()
};

var lineTexture = null;
var spriteBatch = null;

var shader = {
	id: 0,
	mvp: mat3(),
	proj: mat3(),
	view: mat3(),
	mtx: mat3(),
	updateMvp: true,
	updateMtx: false,
	viewWidth: 0,
	viewHeight: 0,
	loc: {
		mvp: -1,
		mtx: -1,
		sampler: -1,
		pointSize: -1,
		viewWidth: -1,
		viewHeight: -1,
		pixelAlign: -1,
		patternFill: -1,
		patternSize: -1,
		position: -1,
		texcoords: -1,
		color: -1
	},
	vs: "attribute vec2 vposition;\n" +
		"attribute vec2 vtexcoords;\n" +
		"attribute vec4 vcolor;\n" +
		"uniform mat3 mvp;\n" +
		"uniform mat3 mtx;\n" +
		"uniform float pointSize;\n" +
		"uniform vec2 viewSize;\n" +
		"uniform bool pixelAlign;\n" +
		"varying vec2 texcoords;\n" +
		"varying vec4 color;\n" +
		"void main(void)\n" +
		"{\n" +
		"	gl_PointSize = pointSize;\n" +
		"	color = vcolor;\n" +
		"	texcoords = vec2(mtx * vec3(vtexcoords, 1.0));\n" +
		"	gl_Position = vec4(mvp * vec3(vposition, 1.0), 1.0);\n" +
		"\n" +
		"	if (pixelAlign)\n" +
		"	{\n" +
		"		vec2 p = gl_Position.xy;\n" +
		"		vec2 v = viewSize;\n" +
		"		p = ((floor((p + vec2(1.0)) * v / 2.0) + vec2(0.5)) * 2.0) / v - vec2(1.0);\n" +
		"		gl_Position.xy = p;\n" +
		"	}\n" +
		"}\n",
	fs: "precision mediump float;\n" +
		"varying mediump vec2 texcoords;\n" +
		"varying mediump vec4 color;\n" +
		"uniform sampler2D sampler;\n" +
		"void main(void)\n" +
		"{\n" +
		"	gl_FragColor = texture2D(sampler, texcoords) * color;\n" +
		"	if (gl_FragColor.a <= 0.0) discard;" +
		"}\n"
};

// -----------------------------------------------------------------------------
// gfx functions
// -----------------------------------------------------------------------------

function initialize(canvas, params)
{
	gl = canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);

	initialize_enums();

	gl.enable(gl.BLEND);
	blend(gfx.Default);
	blendEquation(gfx.Default);

	bgcolor(0, 0, 0, 1);

	// initialize shader

	shader.currentMatrix = shader.view;

	mat3identity(shader.view);
	mat3identity(shader.mtx);

	shader.id = shader_create(shader.vs, shader.fs);

	// uniforms
	shader.loc.mvp = gl.getUniformLocation(shader.id, "mvp");
	shader.loc.mtx = gl.getUniformLocation(shader.id, "mtx");
	shader.loc.sampler = gl.getUniformLocation(shader.id, "sampler");
	shader.loc.pointSize = gl.getUniformLocation(shader.id, "pointSize");
	shader.loc.viewSize = gl.getUniformLocation(shader.id, "viewSize");
	shader.loc.pixelAlign = gl.getUniformLocation(shader.id, "pixelAlign");

	gl.uniform1i(shader.loc.sampler, 0);
	gl.uniform1i(shader.loc.pixelAlign, 0);
	gl.uniformMatrix3fv(shader.loc.mtx, false, shader.mtx);

	// attributes
	shader.loc.position = gl.getAttribLocation(shader.id, "vposition");
	shader.loc.texcoords = gl.getAttribLocation(shader.id, "vtexcoords");
	shader.loc.color = gl.getAttribLocation(shader.id, "vcolor");

	gl.enableVertexAttribArray(shader.loc.position);
	gl.enableVertexAttribArray(shader.loc.texcoords);
	gl.enableVertexAttribArray(shader.loc.color);

	// create some textures

	lineTexture = new Texture(256, 256, gfx.RGBA, function(x, y, color) {
		color.r = 1;
		color.g = 1;
		color.b = 1;

		var size = 256;
		var px = 1 / size;
		var radius = ((size - 2) / 2) / size;
		var u = (x + 0.5) / size - 0.5;
		var v = (y + 0.5) / size - 0.5;
		var dist = radius - Math.sqrt(u * u + v * v);

		color.a = 0;

		if (dist > px)
			color.a = 1;
		else if (dist > 0)
			color.a = dist / px;
	});

	lineTexture.generateMipmap();
	lineTexture.filter(gfx.LinearMipmapNearest, gfx.Linear);

	gfx.White = new Texture(1, 1, gfx.RGBA, function(x, y, color) {
		color.r = 1;
		color.g = 1;
		color.b = 1;
		color.a = 1;
	});

	gfx.White.filter(gfx.Nearest, gfx.Nearest);

	// other stuff

	spriteBatch = new SpriteBatch(1, gfx.Dynamic);
}

function initialize_enums()
{
	gfx.Default = {};
	gfx.View = {};

	gfx.Stream  = gl.STREAM_DRAW;
	gfx.Static  = gl.STATIC_DRAW;
	gfx.Dynamic = gl.DYNAMIC_DRAW;

	gfx.Points        = gl.POINTS;
	gfx.LineStrip     = gl.LINE_STRIP;
	gfx.LineLoop      = gl.LINE_LOOP;
	gfx.Lines         = gl.LINES;
	gfx.TriangleStrip = gl.TRIANGLE_STRIP;
	gfx.TriangleFan   = gl.TRIANGLE_FAN;
	gfx.Triangles     = gl.TRIANGLES;

	gfx.RGBA  = gl.RGBA;
	gfx.RGB   = gl.RGB;
	gfx.ALPHA = gl.ALPHA;

	gfx.Clamp  = gl.CLAMP_TO_EDGE;
	gfx.Repeat = gl.REPEAT;

	gfx.Linear               = gl.LINEAR;
	gfx.Nearest              = gl.NEAREST;
	gfx.NearestMipmapNearest = gl.NEAREST_MIPMAP_NEAREST;
	gfx.LinearMipmapNearest  = gl.LINEAR_MIPMAP_NEAREST;
	gfx.NearestMipmapLinear  = gl.NEAREST_MIPMAP_LINEAR;
	gfx.LinearMipmapLinear   = gl.LINEAR_MIPMAP_LINEAR;

	gfx.Zero                  = gl.ZERO;
	gfx.One                   = gl.ONE;
	gfx.SrcColor              = gl.SRC_COLOR;
	gfx.OneMinusSrcColor      = gl.ONE_MINUS_SRC_COLOR;
	gfx.SrcAlpha              = gl.SRC_ALPHA;
	gfx.OneMinusSrcAlpha      = gl.ONE_MINUS_SRC_ALPHA;
	gfx.DstAlpha              = gl.DST_ALPHA;
	gfx.OneMinusDstAlpha      = gl.ONE_MINUS_DST_ALPHA;
	gfx.DstColor              = gl.DST_COLOR;
	gfx.OneMinusDstColor      = gl.ONE_MINUS_DST_COLOR;
	gfx.SrcAlphaSaturate      = gl.SRC_ALPHA_SATURATE;
	gfx.ConstantColor         = gl.CONSTANT_COLOR;
	gfx.OneMinusConstantColor = gl.ONE_MINUS_CONSTANT_COLOR;
	gfx.ConstantAlpha         = gl.CONSTANT_ALPHA;
	gfx.OneMinusConstantAlpha = gl.ONE_MINUS_CONSTANT_ALPHA;

	gfx.FuncAdd             = gl.FUNC_ADD;
	gfx.FuncSubtract        = gl.FUNC_SUBTRACT;
	gfx.FuncReverseSubtract = gl.FUNC_REVERSE_SUBTRACT;
}

function viewport(width, height)
{
	shader.updateMvp = true;
	shader.viewWidth = width;
	shader.viewHeight = height;

	mat3ortho(0, width, height, 0, shader.proj);

	gl.uniform2f(shader.loc.viewSize, width, height);
	gl.viewport(0, 0, width, height);
}

function bgcolor(r, g, b, a)
{
	gl.clearColor(r / 255, g / 255, b / 255, a);
}

function clear()
{
	gl.clear(gl.COLOR_BUFFER_BIT);
}

function blend(src, dst, srca, dsta)
{
	switch (arguments.length)
	{
		case 1: gl.blendFuncSeparate(gfx.SrcAlpha, gfx.OneMinusSrcAlpha, gfx.One, gfx.One); break;
		case 2: gl.blendFunc(src, dst);                                                     break;
		case 4: gl.blendFuncSeparate(src, dst, srca, dsta);                                 break;
	}
}

function blendEquation(mode, modea)
{
	if (mode === gfx.Default)
		gl.blendEquation(gfx.FuncAdd);
	else if (arguments.length === 1)
		gl.blendEquation(mode);
	else
		gl.blendEquationSeparate(mode, modea);
}

function blendColor(r, g, b, a)
{
	gl.blendColor(r / 255, g / 255, b / 255, a);
}

function lineWidth(width)
{
	gl.lineWidth(width);
}

function pointSize(size)
{
	gl.uniform1f(shader.loc.pointSize, size);
}

function pixelAlign(enable)
{
	if (enable)
		gl.uniform1i(shader.loc.pixelAlign, 1);
	else
		gl.uniform1i(shader.loc.pixelAlign, 0);
}

function bind(texture)
{
	gl.bindTexture(gl.TEXTURE_2D, texture.id);
}

function target(framebuffer)
{
	gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer !== null ? framebuffer.id : null);
}

function scissor(x, y, width, height)
{
	if (arguments.length === 1)
	{
		gl.disable(gl.SCISSOR_TEST);
	}
	else
	{
		gl.enable(gl.SCISSOR_TEST);
		gl.scissor(x, shader.viewHeight - (y + height), width, height);
	}
}

function draw(vbo, ibo, offset, count)
{
	switch (arguments.length)
	{
		case 1:
		{
			ibo = null;
			offset = 0;
			count = vbo.size;
		}
		break;

		case 2:
		{
			if (ibo.constructor === Number)
			{
				offset = 0;
				count = ibo;
				ibo = null;
			}
			else
			{
				offset = 0;
				count = ibo.size;
			}
		}
		break;

		case 3:
		{
			if (ibo.constructor === Number)
			{
				count = offset;
				offset = ibo;
				ibo = null;
			}
			else
			{
				count = offset;
				offset = 0;
			}
		}
		break;
	}

	if (shader.updateMvp)
	{
		mat3mul(shader.proj, shader.view, shader.mvp);
		gl.uniformMatrix3fv(shader.loc.mvp, false, shader.mvp);
		shader.updateMvp = false;
	}

	if (shader.updateMtx)
	{
		gl.uniformMatrix3fv(shader.loc.mtx, false, shader.mtx);
		shader.updateMtx = false;
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, vbo.id);

	gl.vertexAttribPointer(shader.loc.position, 2, gl.FLOAT, false, szvertex, 0);
	gl.vertexAttribPointer(shader.loc.texcoords, 2, gl.FLOAT, false, szvertex, 2 * szfloat);
	gl.vertexAttribPointer(shader.loc.color, 4, gl.UNSIGNED_BYTE, true, szvertex, (2 + 2) * szfloat);

	if (vbo.max !== -1)
		console.warn("gfx.draw(): vbo data not uploaded.");

	if (ibo !== null)
	{
		if (ibo.max !== -1)
			console.warn("gfx.draw(): ibo data not uploaded.");

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo.id);
		gl.drawElements(vbo.mode, count, gl.UNSIGNED_SHORT, szuint16 * offset);
	}
	else
	{
		gl.drawArrays(vbo.mode, offset, count);
	}
}

function transform(type, matrix)
{
	switch (arguments.length)
	{
		case 0:
			return shader.view;

		case 1:
		{
			switch (type)
			{
				case gfx.Texture:
					return shader.mtx;

				case gfx.View:
					return shader.view;

				default:
					mat3copy(type, shader.view);
					shader.updateMvp = true;
					break;
			}
		}
		break;

		case 2:
		{
			switch (type)
			{
				case gfx.Texture:
					mat3copy(matrix, shader.mtx);
					shader.updateMtx = true;
					break;

				case gfx.View:
					mat3copy(matrix, shader.view);
					shader.updateMvp = true;
					break;
			}
		}
		break;
	}
}

function identity(type)
{
	mat3identity(cache.matrix1);
	transform(type || gfx.View, cache.matrix1);
}

function translate(type, x, y)
{
	switch (arguments.length)
	{
		case 2:
			y = x;
			x = type;
			type = gfx.View;

		case 3:
		{
			var m = (type === gfx.View ? shader.view : shader.mtx);

			mat3translate(x, y, cache.matrix1);
			mat3mul(m, cache.matrix1, cache.matrix2);
			transform(type, cache.matrix2);
		}
		break;
	}
}

function scale(type, x, y)
{
	switch (arguments.length)
	{
		case 2:
			y = x;
			x = type;
			type = gfx.View;

		case 3:
		{
			var m = (type === gfx.View ? shader.view : shader.mtx);

			mat3scale(x, y, cache.matrix1);
			mat3mul(m, cache.matrix1, cache.matrix2);
			transform(type, cache.matrix2);
		}
		break;
	}
}

function rotate(type, angle)
{
	switch (arguments.length)
	{
		case 1:
			angle = type;
			type = gfx.View;

		case 2:
		{
			var m = (type === gfx.View ? shader.view : shader.mtx);

			mat3rotate(angle, cache.matrix1);
			mat3mul(m, cache.matrix1, cache.matrix2);
			transform(type, cache.matrix2);
		}
		break;
	}
}

function skew(type, x, y)
{
	switch (arguments.length)
	{
		case 2:
			y = x;
			x = type;
			type = gfx.View;

		case 3:
		{
			var m = (type === gfx.View ? shader.view : shader.mtx);

			mat3skew(x, y, cache.matrix1);
			mat3mul(m, cache.matrix1, cache.matrix2);
			transform(type, cache.matrix2);
		}
		break;
	}
}

// -----------------------------------------------------------------------------
// VBO
// -----------------------------------------------------------------------------

function VBO(cap, usage)
{
	this.id = gl.createBuffer();
	this.mode = gfx.Triangles;

	this.cap = 0;
	this.size = 0;
	this.buffer = null;
	this.f32 = null;
	this.u8 = null;
	this.min = 0;
	this.max = -1;
	this.usage = usage || gfx.Stream;

	this.resize(cap, this.usage);
}

VBO.prototype.delete = function()
{
	gl.deleteBuffer(this.id);
}

VBO.prototype.reserve = function(capacity)
{
	if (this.cap < capacity)
		this.resize(capacity, this.usage, true);
}

VBO.prototype.resize = function(cap, usage, preserve)
{
	var oldBuffer = this.u8;

	this.cap = cap;
	this.usage = usage || gfx.Stream;
	this.buffer = new ArrayBuffer(cap * szvertex);
	this.f32 = new Float32Array(this.buffer, 0, this.buffer.byteLength / szfloat);
	this.u8 = new Uint8Array(this.buffer, 0, this.buffer.byteLength);
	this.min = 0;
	this.max = -1;

	if (preserve)
	{
		var len = Math.min(this.u8.length, oldBuffer.length);
		this.u8.set(oldBuffer.subarray(0, len));
		this.max = (len / szvertex) - 1;
	}
	else
	{
		this.size = 0;
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, this.id);
	gl.bufferData(gl.ARRAY_BUFFER, this.buffer.byteLength, this.usage);
}

VBO.prototype.set = function(index, x, y, u, v, r, g, b, a)
{
	if (index < this.min) this.min = index;
	if (index > this.max) this.max = index;

	var base = index * szvertex;

	var i = base / szfloat;

	this.f32[i + 0] = x;
	this.f32[i + 1] = y;
	this.f32[i + 2] = u;
	this.f32[i + 3] = v;

	i = base + szfloat * 4;

	this.u8[i + 0] = r;
	this.u8[i + 1] = g;
	this.u8[i + 2] = b;
	this.u8[i + 3] = a;
}

var vbo_vertex = {x: 0, y: 0, u: 0, v: 0, r: 0, g: 0, b: 0, a: 0};

VBO.prototype.get = function(index)
{
	var base = index * szvertex;

	var i = base / szfloat;

	vbo_vertex.x = this.f32[i + 0];
	vbo_vertex.y = this.f32[i + 1];
	vbo_vertex.u = this.f32[i + 2];
	vbo_vertex.v = this.f32[i + 3];

	i = base + szfloat * 4;

	vbo_vertex.r = this.u8[i + 0];
	vbo_vertex.g = this.u8[i + 1];
	vbo_vertex.b = this.u8[i + 2];
	vbo_vertex.a = this.u8[i + 3];

	return vbo_vertex;
}

VBO.prototype.push = function(x, y, u, v, color)
{
	this.set(this.size, x, y, u, v, color[0], color[1], color[2], color[3]);
	return this.size++;
}

VBO.prototype.pushv = function(v)
{
	this.set(this.size, v.x, v.y, v.u, v.v, v.r, v.g, v.b, v.a);
	return this.size++;
}

VBO.prototype.clear = function()
{
	this.size = 0;
}

VBO.prototype.upload = function()
{
	if (this.max - this.min < 0)
		return;

	var start = szvertex * this.min;
	var end = start + szvertex * (this.max - this.min + 1);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.id);
	gl.bufferSubData(gl.ARRAY_BUFFER, start, this.u8.subarray(start, end));

	this.min = 0;
	this.max = -1;
}

// -----------------------------------------------------------------------------
// IBO
// -----------------------------------------------------------------------------

function IBO(cap, usage)
{
	this.id = gl.createBuffer();

	this.data = null;
	this.cap = 0;
	this.size = 0;
	this.min = 0;
	this.max = -1;
	this.usage = usage || gfx.Stream;

	this.resize(cap, usage);
}

IBO.prototype.delete = function()
{
	gl.deleteBuffer(this.id);
}

IBO.prototype.reserve = function(capacity)
{
	if (this.cap < capacity)
		this.resize(capacity, this.usage, true);
}

IBO.prototype.resize = function(cap, usage, preserve)
{
	var oldBuffer = this.data;

	this.data = new Uint16Array(cap);
	this.cap = cap;
	this.usage = usage || gfx.Stream;
	this.min = 0;
	this.max = -1;

	if (preserve)
	{
		var len = Math.min(oldBuffer.length, this.data.length);
		this.data.set(oldBuffer.subarray(0, len));
		this.max = len - 1;
	}
	else
	{
		this.size = 0;
	}

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.id);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.data.buffer.byteLength, this.usage);
}

IBO.prototype.set = function(index, value)
{
	if (index < this.min) this.min = index;
	if (index > this.max) this.max = index;

	this.data[index] = value;
}

IBO.prototype.push = function(a, b, c)
{
	this.set(this.size++, a);
	this.set(this.size++, b);
	this.set(this.size++, c);
}

IBO.prototype.clear = function()
{
	this.size = 0;
}

IBO.prototype.upload = function()
{
	if (this.max - this.min < 0)
		return;

	var data = this.data.subarray(this.min, this.max + 1);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.id);
	gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, this.min * szuint16, data);

	this.min = 0;
	this.max = -1;
}

// -----------------------------------------------------------------------------
// Texture(image)
// Texture(width, height, format, func procedure(x, y, color));
// -----------------------------------------------------------------------------

function Texture(image)
{
	this.width = 0;
	this.height = 0;

	this.id = gl.createTexture();
	this.format = gl.RGBA;
	this.loading = false;
	this.onload = null;
	this.mipmap = false;

	var self = this;

	function load_trigger()
	{
		if (self.onload)
			self.onload();
	}

	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	if (arguments.length === 1)
	{
		if (image.constructor === String) // loading from url
		{
			var src = image;
			var image = new Image();

			this.loading = true;

			image.onload = function()
			{
				self.width = image.width;
				self.height = image.height;

				gl.bindTexture(gl.TEXTURE_2D, self.id);
				gl.texImage2D(gl.TEXTURE_2D, 0, self.format, self.format, gl.UNSIGNED_BYTE, image);

				self.loading = false;

				if (self.mipmap)
					self.generateMipmap();

				load_trigger();
			}

			image.src = src;
		}
		else // loading from image object
		{
			this.width = image.width;
			this.height = image.height;

			gl.texImage2D(gl.TEXTURE_2D, 0, this.format, this.format, gl.UNSIGNED_BYTE, image);

			setTimeout(load_trigger, 0);
		}
	}
	else // creating empty texture or procedural
	{
		this.width = arguments[0];
		this.height = arguments[1];

		var type = arguments[2];
		var procedure = (arguments.length > 3 ? arguments[3] : null);
		var channels = (type === gfx.ALPHA ? 1 : type === gfx.RGB ? 3 : 4);
		var data = null;

		this.format = type;

		if (procedure)
		{
			data = new Uint8Array(this.width * this.height * channels);

			var color = { r: 0, g: 0, b: 0, a: 0 };

			for (var y = 0; y < this.height; y++)
			{
				for (var x = 0; x < this.width; x++)
				{
					var index = (y * this.width + x) * channels;

					procedure(x, y, color);

					color.r = Math.max(Math.min(1, color.r), 0);
					color.g = Math.max(Math.min(1, color.g), 0);
					color.b = Math.max(Math.min(1, color.b), 0);
					color.a = Math.max(Math.min(1, color.a), 0);

					if (channels > 1)
					{
						data[index + 0] = color.r * 255;
						data[index + 1] = color.g * 255;
						data[index + 2] = color.b * 255;

						if (channels === 4)
							data[index + 3] = color.a * 255;
					}
					else
					{
						data[index] = color.a * 255;
					}
				}
			}
		}

		gl.texImage2D(gl.TEXTURE_2D, 0, type, this.width, this.height, 0, type, gl.UNSIGNED_BYTE, data);

		setTimeout(load_trigger, 0);
	}
}

Texture.prototype.update = function(x, y, width, height, data)
{
	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, width, height, this.format, gl.UNSIGNED_BYTE, data);

	if (this.mipmap)
		this.generateMipmap();
}

Texture.prototype.generateMipmap = function()
{
	this.mipmap = true;

	if (this.loading)
		return;

	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.generateMipmap(gl.TEXTURE_2D);
}

Texture.prototype.filter = function(min, mag)
{
	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mag);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, min);
}

Texture.prototype.wrap = function(u, v)
{
	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, u);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, v);
}

Texture.prototype.resize = function(width, height)
{
	this.width = width;
	this.height = height;

	gl.bindTexture(gl.TEXTURE_2D, this.id);
	gl.texImage2D(gl.TEXTURE_2D, 0, this.format, width, height, 0, this.format, gl.UNSIGNED_BYTE, null);
}

// -----------------------------------------------------------------------------
// Framebuffer
// -----------------------------------------------------------------------------

function Framebuffer(width, height, alpha)
{
	this.alpha = (arguments.length === 3 ? alpha : false);

	var format = this.alpha ? gl.RGBA : gl.RGB;

	this.id = gl.createFramebuffer();
	this.texture = new Texture(width, height, format);
	this.depth = gl.createRenderbuffer();

	this.texture.filter(gfx.Nearest, gfx.Nearest);

	gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);

	gl.bindFramebuffer(gl.FRAMEBUFFER, this.id);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture.id, 0);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depth);
}

Framebuffer.prototype.resize = function(width, height)
{
	this.texture.resize(width, height);

	gl.bindRenderbuffer(gl.RENDERBUFFER, this.depth);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
}

// -----------------------------------------------------------------------------
// Sprite
// -----------------------------------------------------------------------------

function Sprite(properties)
{
	this.x = 0;
	this.y = 0;
	this.w = 0;
	this.h = 0;
	this.rotation = 0;
	this.cx = 0;
	this.cy = 0;
	this.sx = 1;
	this.sy = 1;
	this.kx = 0;
	this.ky = 0;
	this.u0 = 0;
	this.u1 = 1;
	this.v0 = 0;
	this.v1 = 1;
	this.r = 255;
	this.g = 255;
	this.b = 255;
	this.a = 1;
	this.uvrot = false;

	if (properties)
	{
		for (var i in properties)
		{
			if (i in this)
				this[i] = properties[i];
		}
	}
}

Sprite.prototype.draw = function()
{
	spriteBatch.clear();
	spriteBatch.add(this);
	spriteBatch.upload();
	spriteBatch.draw();
}

// -----------------------------------------------------------------------------
// SpriteBatch
// -----------------------------------------------------------------------------

var iboSpriteBatch = null;

function SpriteBatch(maxSize, usage)
{
	this.size = 0;
	this.maxSize = 0;
	this.vbo = null;
	this.texture = null;

	this.resize(maxSize, usage);
}

SpriteBatch.prototype.delete = function()
{
	if (this.vbo !== null)
		this.vbo.delete();
}

SpriteBatch.prototype.resize = function(maxSize, usage, preserve)
{
	var updateIbo = -1;

	if (!iboSpriteBatch)
	{
		updateIbo = 0;
		iboSpriteBatch = new IBO(6 * maxSize, usage);
	}

	if (iboSpriteBatch.size < 6 * maxSize)
	{
		updateIbo = iboSpriteBatch.size / 6;
		iboSpriteBatch.resize(6 * maxSize, usage, true);
	}

	if (updateIbo !== -1)
	{
		for (var i = updateIbo; i < maxSize; i++)
		{
			var ii = i * 6;
			var iv = i * 4;

			iboSpriteBatch.set(ii + 0, iv + 0);
			iboSpriteBatch.set(ii + 1, iv + 1);
			iboSpriteBatch.set(ii + 2, iv + 2);
			iboSpriteBatch.set(ii + 3, iv + 2);
			iboSpriteBatch.set(ii + 4, iv + 3);
			iboSpriteBatch.set(ii + 5, iv + 0);
		}

		iboSpriteBatch.upload();
	}

	if (this.vbo === null)
		this.vbo = new VBO(4 * maxSize, usage);

	if (this.vbo.size < 4 * maxSize)
		this.vbo.resize(4 * maxSize, usage, preserve);

	this.size = preserve ? Math.min(this.size, maxSize) : 0;
	this.maxSize = maxSize;
}

SpriteBatch.prototype.add = function(sprite)
{
	if (this.size >= this.maxSize)
	{
		console.error("SpriteBatch.add(): reached max size.");
		return;
	}

	var s = sprite;
	var m = mat3transform(s.x, s.y, s.rotation, s.sx, s.sy, s.cx, s.cy, s.kx, s.ky, cache.matrix1);

	var i = this.size * 4;

	var u0 = s.u0, v0 = s.v0;
	var u1 = s.u1, v1 = s.v0;
	var u2 = s.u1, v2 = s.v1;
	var u3 = s.u0, v3 = s.v1;

	if (s.uvrot && (s.u1 - s.u0 < 0 || s.v1 - s.v0 < 0))
	{
		u0 = s.u0, v0 = s.v0;
		u1 = s.u0, v1 = s.v1;
		u2 = s.u1, v2 = s.v1;
		u3 = s.u1, v3 = s.v0;
	}

	this.vbo.set(i + 0, mat3mulx(m,   0,   0), mat3muly(m,   0,   0), u0, v0, s.r, s.g, s.b, s.a);
	this.vbo.set(i + 1, mat3mulx(m, s.w,   0), mat3muly(m, s.w,   0), u1, v1, s.r, s.g, s.b, s.a);
	this.vbo.set(i + 2, mat3mulx(m, s.w, s.h), mat3muly(m, s.w, s.h), u2, v2, s.r, s.g, s.b, s.a);
	this.vbo.set(i + 3, mat3mulx(m,   0, s.h), mat3muly(m,   0, s.h), u3, v3, s.r, s.g, s.b, s.a);

	this.size++;
}

SpriteBatch.prototype.clear = function()
{
	this.size = 0;
}

SpriteBatch.prototype.upload = function()
{
	this.vbo.upload();
}

SpriteBatch.prototype.draw = function()
{
	if (this.size === 0)
		return;

	if (this.texture !== null)
		bind(this.texture);

	draw(this.vbo, iboSpriteBatch, 0, this.size * 6);
}

// -----------------------------------------------------------------------------
// LineBatch
// -----------------------------------------------------------------------------

function LineBatch()
{
	this.vbos = [];
	this.ibo = null;
	this.size = 0;
	this.strips = [];
	this.lineWidth = 1;
	this.currentColor = { r: 0, g: 0, b: 0, a: 1 };
	this.startPoint = { x: 0, y: 0, r: 0, g: 0, b: 0, a: 1, w: 1 };
	this.startNew = true;
}

LineBatch.prototype.draw = function()
{
	if (this.size === 0)
		return;

	bind(lineTexture);

	for (var i = 0; i < this.size; i++)
		draw(this.vbos[i].vbo, this.ibo, this.vbos[i].offset, this.vbos[i].size);
}

LineBatch.prototype.clear = function()
{
	this.strips = [];
}

LineBatch.prototype.color = function(r, g, b, a)
{
	this.currentColor.r = r;
	this.currentColor.g = g;
	this.currentColor.b = b;
	this.currentColor.a = a;
}

LineBatch.prototype.width = function(lineWidth)
{
	this.lineWidth = lineWidth;
}

LineBatch.prototype.moveTo = function(x, y)
{
	this.startNew = true;
	this.startPoint.x = x;
	this.startPoint.y = y;
	this.startPoint.r = this.currentColor.r;
	this.startPoint.g = this.currentColor.g;
	this.startPoint.b = this.currentColor.b;
	this.startPoint.a = this.currentColor.a;
	this.startPoint.w = this.lineWidth;
}

LineBatch.prototype.lineTo = function(x, y)
{
	var strip = null;

	if (this.startNew)
	{
		this.startNew = false;

		strip = [{
			x: this.startPoint.x,
			y: this.startPoint.y,
			r: this.startPoint.r,
			g: this.startPoint.g,
			b: this.startPoint.b,
			a: this.startPoint.a,
			w: this.startPoint.w
		}];

		this.strips.push(strip);
	}
	else
	{
		strip = this.strips[this.strips.length - 1];
	}

	strip.push({
		x: x,
		y: y,
		r: this.currentColor.r,
		g: this.currentColor.g,
		b: this.currentColor.b,
		a: this.currentColor.a,
		w: this.lineWidth
	});
}

LineBatch.prototype.upload = function()
{
	// calculate vertex/index counts

	var limit = 65536;

	var info = [{
		vcount: 0,
		icount: 0,
		offset: 0
	}];

	var icount = 0;
	var ivbo = 0;

	for (var i = 0; i < this.strips.length; i++)
	{
		// add the first line (3 connected quads = 8 vertices)

		if (info[ivbo].vcount + 8 > limit)
		{
			info.push({
				vcount: 0,
				icount: 0,
				offset: icount
			});

			ivbo++;
		}

		info[ivbo].vcount += 8;
		info[ivbo].icount += 18;

		icount += 18; // 6 triangles * 3 vertices

		// add the rest of the lines (each is 2 connected quads = 6 vertices)

		var n = this.strips[i].length - 2;

		while (info[ivbo].vcount + n * 6 > limit)
		{
			var m = Math.floor((limit - info[ivbo].vcount) / 6);

			info[ivbo].vcount += m * 6;
			info[ivbo].icount += m * 12;

			icount += m * 12;

			info.push({
				vcount: 0,
				icount: 0,
				offset: icount
			});

			ivbo++;
			n -= m;
		}

		info[ivbo].vcount += n * 6;
		info[ivbo].icount += n * 12;

		icount += n * 12;
	}

	this.size = icount > 0 ? info.length : 0;

	if (icount === 0)
		return;

	// update buffer sizes

	if (!this.ibo)
		this.ibo = new IBO(icount, gfx.Static);
	else if (this.ibo.size < icount)
		this.ibo.resize(icount, gfx.Static);

	while (this.vbos.length < info.length)
	{
		this.vbos.push({
			vbo: null,
			offset: 0,
			size: 0
		});
	}

	for (var i = 0; i < info.length; i++)
	{
		if (!this.vbos[i].vbo)
			this.vbos[i].vbo = new VBO(info[i].vcount, gfx.Static);
		else if (this.vbos[i].vbo.size < info[i].vcount)
			this.vbos[i].vbo.resize(info[i].vcount, gfx.Static);

		this.vbos[i].offset = info[i].offset;
		this.vbos[i].size = info[i].icount;
	}

	// update vertices/indices

	var vbase = 0;
	var ibase = 0;

	ivbo = 0;

	var vbo = this.vbos[ivbo].vbo;
	var ibo = this.ibo;

	for (var i = 0; i < this.strips.length; i++)
	{
		var strip = this.strips[i];

		// update first 2 vertices

		var a = strip[0];
		var b = strip[1];

		var dx = b.x - a.x;
		var dy = b.y - a.y;
		var L  = Math.sqrt(dx*dx + dy*dy);
		var c  = dx / L;
		var s  = dy / L;

		var d = a.w / 2;

		// x = c * x - s * y;
		// y = s * x + c * y;

		var x1 = c * (-d) - s * (-d) + a.x;
		var y1 = s * (-d) + c * (-d) + a.y;
		var x2 = c * (-d) - s * d + a.x;
		var y2 = s * (-d) + c * d + a.y;

		if (vbase + 8 > info[ivbo].vcount)
		{
			vbase = 0;
			ivbo++;
			vbo = this.vbos[ivbo].vbo;
		}

		ibo.set(ibase++, vbase + 0);
		ibo.set(ibase++, vbase + 1);
		ibo.set(ibase++, vbase + 2);

		ibo.set(ibase++, vbase + 1);
		ibo.set(ibase++, vbase + 2);
		ibo.set(ibase++, vbase + 3);

		vbo.set(vbase++, x1, y1, 0, 0, a.r, a.g, a.b, a.a);
		vbo.set(vbase++, x2, y2, 0, 1, a.r, a.g, a.b, a.a);

		// update the rest

		for (var j = 0; j < strip.length - 1; j++)
		{
			var a = strip[j + 0];
			var b = strip[j + 1];

			var dx = b.x - a.x;
			var dy = b.y - a.y;
			var L  = Math.sqrt(dx*dx + dy*dy);
			var c  = dx / L;
			var s  = dy / L;

			var da = a.w / 2;
			var db = b.w / 2;

			var x1 = -s * (-da) + a.x;
			var y1 =  c * (-da) + a.y;
			var x2 = -s *   da  + a.x;
			var y2 =  c *   da  + a.y;

			var x3 = -s * (-db) + b.x;
			var y3 =  c * (-db) + b.y;
			var x4 = -s *   db  + b.x;
			var y4 =  c *   db  + b.y;

			var x5 = c * db - s * (-db) + b.x;
			var y5 = s * db + c * (-db) + b.y;
			var x6 = c * db - s *   db  + b.x;
			var y6 = s * db + c *   db  + b.y;

			if (vbase + 6 > info[ivbo].vcount)
			{
				vbase = 0;
				ivbo++;
				vbo = this.vbos[ivbo].vbo;
			}

			ibo.set(ibase++, vbase + 0);
			ibo.set(ibase++, vbase + 1);
			ibo.set(ibase++, vbase + 2);

			ibo.set(ibase++, vbase + 1);
			ibo.set(ibase++, vbase + 2);
			ibo.set(ibase++, vbase + 3);

			ibo.set(ibase++, vbase + 2);
			ibo.set(ibase++, vbase + 3);
			ibo.set(ibase++, vbase + 4);

			ibo.set(ibase++, vbase + 3);
			ibo.set(ibase++, vbase + 4);
			ibo.set(ibase++, vbase + 5);

			vbo.set(vbase++, x1, y1, 0.5, 0, a.r, a.g, a.b, a.a);
			vbo.set(vbase++, x2, y2, 0.5, 1, a.r, a.g, a.b, a.a);
			vbo.set(vbase++, x3, y3, 0.5, 0, b.r, b.g, b.b, b.a);
			vbo.set(vbase++, x4, y4, 0.5, 1, b.r, b.g, b.b, b.a);
			vbo.set(vbase++, x5, y5,   1, 0, b.r, b.g, b.b, b.a);
			vbo.set(vbase++, x6, y6,   1, 1, b.r, b.g, b.b, b.a);
		}
	}

	ibo.upload();

	for (var i = 0; i < info.length; i++)
		this.vbos[i].vbo.upload();
}

// -----------------------------------------------------------------------------
// shader functions
// -----------------------------------------------------------------------------

function shader_create(vs, fs)
{
	var program = gl.createProgram();

	gl.attachShader(program, shader_compile(vs, gl.VERTEX_SHADER));
	gl.attachShader(program, shader_compile(fs, gl.FRAGMENT_SHADER));
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS))
		console.log("Error linking shader program.");

	gl.useProgram(program);

	return program;
}

function shader_compile(source, type)
{
	var shader = gl.createShader(type);

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
		console.log("Shader error: " + gl.getShaderInfoLog(shader));

	return shader;
}

// -----------------------------------------------------------------------------
// mat3 functions
// -----------------------------------------------------------------------------

function mat3()
{
	return new Float32Array(3 * 3);
}

function mat3copy(src, dest)
{
	dest.set(src);

	return dest;
}

function mat3identity(out)
{
	out[0] = 1;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 1;
	out[5] = 0;
	out[6] = 0;
	out[7] = 0;
	out[8] = 1;

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

function mat3mulx(m, x, y)
{
	return m[0] * x + m[3] * y + m[6];
}

function mat3muly(m, x, y)
{
	return m[1] * x + m[4] * y + m[7];
}

function mat3translate(x, y, out)
{
	out[0] = 1;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 1;
	out[5] = 0;
	out[6] = x;
	out[7] = y;
	out[8] = 1;

	return out;
}

function mat3scale(x, y, out)
{
	out[0] = x;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = y;
	out[5] = 0;
	out[6] = 0;
	out[7] = 0;
	out[8] = 1;

	return out;
}

function mat3skew(x, y, out)
{
	out[0] = 1;
	out[1] = x;
	out[2] = 0;
	out[3] = y;
	out[4] = 1;
	out[5] = 0;
	out[6] = 0;
	out[7] = 0;
	out[8] = 1;

	return out;
}

function mat3rotate(rot, out)
{
	var c = Math.cos(rot);
	var s = Math.sin(rot);

	out[0] = c;
	out[1] = s;
	out[2] = 0;
	out[3] = -s;
	out[4] = c;
	out[5] = 0;
	out[6] = 0;
	out[7] = 0;
	out[8] = 1;

	return out;
}

function mat3ortho(left, right, bottom, top, out)
{
	var w = right - left;
	var h = top - bottom;

	out[0] = 2 / w;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 2 / h;
	out[5] = 0;
	out[6] = -(right + left) / w;
	out[7] = -(top + bottom) / h;
	out[8] =  1;

	return out;
}

function mat3transform(x, y, rot, sx, sy, cx, cy, kx, ky, out)
{
	var c = Math.cos(rot);
	var s = Math.sin(rot);

	out[0] = c * sx - kx * s * sy;
	out[1] = s * sx + c * kx * sy;
	out[2] = 0;
	out[3] = c * ky * sx - s * sy;
	out[4] = ky * s * sx + c * sy;
	out[5] = 0;
	out[6] = x - cx * out[0] - cy * out[3];
	out[7] = y - cx * out[1] - cy * out[4];
	out[8] = 1;

	return out;
}

// -----------------------------------------------------------------------------
// exports
// -----------------------------------------------------------------------------

gfx.initialize    = initialize;
gfx.viewport      = viewport;
gfx.bgcolor       = bgcolor;
gfx.clear         = clear;
gfx.blend         = blend;
gfx.blendEquation = blendEquation;
gfx.blendColor    = blendColor;
gfx.lineWidth     = lineWidth;
gfx.pointSize     = pointSize;
gfx.pixelAlign    = pixelAlign;
gfx.bind          = bind;
gfx.target        = target;
gfx.scissor       = scissor;
gfx.draw          = draw;
gfx.transform     = transform;
gfx.identity      = identity;
gfx.translate     = translate;
gfx.rotate        = rotate;
gfx.scale         = scale;
gfx.skew          = skew;

gfx.VBO         = VBO;
gfx.IBO         = IBO;
gfx.Texture     = Texture;
gfx.LineBatch   = LineBatch;
gfx.Sprite      = Sprite;
gfx.SpriteBatch = SpriteBatch;
gfx.Framebuffer = Framebuffer;

window.gfx = gfx;

window.mat3 = {
	create:    mat3,
	copy:      mat3copy,
	identity:  mat3identity,
	mul:       mat3mul,
	mulx:      mat3mulx,
	muly:      mat3muly,
	translate: mat3translate,
	scale:     mat3scale,
	skew:      mat3skew,
	rotate:    mat3rotate,
	ortho:     mat3ortho,
	transform: mat3transform
};

})();
