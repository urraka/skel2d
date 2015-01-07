(function(scope) {

scope.SkeletonRenderer = SkeletonRenderer;

var path = new Path();
var bone_transforms = [];
var coords = [];
var bone_color = [0.7, 0.7, 0, 0.7];
var matrix_pool = [sk2.mat2d()];

bone_color[0] = (bone_color[3] * bone_color[0] * 255)|0;
bone_color[1] = (bone_color[3] * bone_color[1] * 255)|0;
bone_color[2] = (bone_color[3] * bone_color[2] * 255)|0;
bone_color[3] = (bone_color[3] * 255)|0;

function mat2d_alloc() { return matrix_pool.length > 0 ? matrix_pool.pop() : sk2.mat2d(); }
function mat2d_free(m) { matrix_pool.push(m); }

function SkeletonRenderer(gfx)
{
	this.gfx = gfx;
	this.vbo = gfx.create_vbo(500, gfx.Stream);
	this.ibo = gfx.create_ibo(500, gfx.Stream);
}

SkeletonRenderer.prototype.draw = function(skeleton, scale)
{
	var gfx = this.gfx;
	var vbo = this.vbo;
	var ibo = this.ibo;
	var skin = skeleton.skins[0];

	vbo.clear();
	ibo.clear();

	path.set_pixel_ratio(scale);

	for (var i = 0, n = skeleton.order.length; i < n; i++)
	{
		var slot = skeleton.slots[skeleton.order[i]];
		var attachment_index = slot.current_state.attachment;

		if (attachment_index < 0)
			continue;

		var attachment = skin.attachments[attachment_index];

		switch (attachment.type)
		{
			case sk2.AttachmentRect:    add_rect(slot, attachment, vbo, ibo); break;
			case sk2.AttachmentEllipse: add_ellipse(slot, attachment, vbo, ibo); break;
			case sk2.AttachmentCircle:  add_circle(slot, attachment, vbo, ibo); break;
			case sk2.AttachmentPath:    add_path(skeleton, slot, attachment, vbo, ibo); break;
		}
	}

	var s = 4;
	var nbones = skeleton.bones.length;

	vbo.reserve(vbo.size + nbones * 4);
	ibo.reserve(ibo.size + 3 * nbones * 2);

	for (var i = 0, n = nbones; i < n; i++)
	{
		var bone = skeleton.bones[i];
		var base = vbo.size;

		vbo.push(bone.to_worldx(0, 0), bone.to_worldy(0, 0), 0, 0, bone_color);
		vbo.push(bone.to_worldx(s, s), bone.to_worldy(s, s), 0, 0, bone_color);
		vbo.push(bone.to_worldx(bone.length, 0), bone.to_worldy(bone.length, 0), 0, 0, bone_color);
		vbo.push(bone.to_worldx(s, -s), bone.to_worldy(s, -s), 0, 0, bone_color);

		ibo.push(base + 0, base + 1, base + 2);
		ibo.push(base + 0, base + 2, base + 3);
	}

	for (var i = 0, n = coords.length; i < n; i++)
		coords.pop();

	vbo.upload();
	ibo.upload();

	gfx.draw(gfx.Triangles, vbo, ibo, 0, ibo.size);
}

function add_rect(slot, attachment, vbo, ibo)
{
	var m = sk2.mat2d_mul(slot.bone.world_transform, attachment.transform, mat2d_alloc());

	var x0 = 0, x1 = attachment.width;
	var y0 = 0, y1 = attachment.height;

	x0 = sk2.mat2d_mulx(m, x0, y0);
	y0 = sk2.mat2d_muly(m, x0, y0);
	x1 = sk2.mat2d_mulx(m, x1, y1);
	y1 = sk2.mat2d_muly(m, x1, y1);

	if (attachment.border_radius > 0)
	{
	}
	else
	{
		path.begin(x0, y0);
		path.line_to(x1, y0);
		path.line_to(x1, y1);
		path.line_to(x0, y1);
		path.close();
	}

	stroke_and_fill(slot, attachment, vbo, ibo);

	mat2d_free(m);
}

function add_ellipse(slot, attachment, vbo, ibo)
{
}

function add_circle(slot, attachment, vbo, ibo)
{
}

function add_path(skeleton, slot, attachment, vbo, ibo)
{
	var commands = attachment.commands;
	var ncommands = commands.length;
	var points = attachment.points;
	var nbones = skeleton.bones.length;

	for (var i = 0; i < nbones; i++)
		bone_transforms.push(null);

	for (var i = 0, j = 0; i < ncommands; i++)
	{
		var npoints = 0;
		var path_func = null;

		switch (commands[i])
		{
			case "M": npoints = 1; path_func = path.begin; break;
			case "L": npoints = 1; path_func = path.line_to; break;
			case "B": npoints = 3; path_func = path.bezier_to; break;
			case "Q": npoints = 2; path_func = path.quad_to; break;
			case "C": npoints = 0; path_func = path.close; break;
		}

		for (var k = 0; k < npoints; k++)
		{
			var p = points[j++];
			var bone = skeleton.bones[p.bone];
			var m = bone_transforms[p.bone];

			if (m === null)
			{
				m = mat2d_alloc();
				sk2.mat2d_mul(bone.world_transform, attachment.transform, m);
				bone_transforms[p.bone] = m;
			}

			coords.push(sk2.mat2d_mulx(m, p.x, p.y));
			coords.push(sk2.mat2d_muly(m, p.x, p.y));
		}

		path_func.apply(path, coords);

		for (var k = 0, n = coords.length; k < n; k++)
			coords.pop();
	}

	for (var i = 0; i < nbones; i++)
	{
		var m = bone_transforms.pop();
		if (m) mat2d_free(m);
	}

	path.line_cap = attachment.line_cap;

	stroke_and_fill(slot, attachment, vbo, ibo);
}

function stroke_and_fill(slot, attachment, vbo, ibo)
{
	var w = attachment.line_width;
	var slot_color = slot.current_state;

	path.stroke_width = w;
	path.line_join = attachment.line_join;

	if (w > 0)
	{
		var src = attachment.line_color;
		var dst = path.stroke_color;
		var alpha = slot_color.a * src.a;

		dst[0] = (alpha * slot_color.r * src.r * 255)|0;
		dst[1] = (alpha * slot_color.g * src.g * 255)|0;
		dst[2] = (alpha * slot_color.b * src.b * 255)|0;
		dst[3] = (alpha * 255)|0;

		path.stroke(vbo, ibo);
	}

	if (path.closed)
	{
		var src = attachment.fill_color;
		var alpha = slot_color.a * src.a;

		if (alpha > 0)
		{
			var dst = path.fill_color;

			dst[0] = (alpha * slot_color.r * src.r * 255)|0;
			dst[1] = (alpha * slot_color.g * src.g * 255)|0;
			dst[2] = (alpha * slot_color.b * src.b * 255)|0;
			dst[3] = (alpha * 255)|0;

			path.fill(vbo, ibo);
		}
	}
}

}(this));
