(function(scope) {

scope.SkeletonRenderer = SkeletonRenderer;

var path = new Path();
var coords = [];
var bone_color = [0, 0, 0, 0];
var matrix_pool = [sk2.mat2d()];
var view_transform = mat3();
var kappa90 = 0.5522847493;

bone_color[0] = (bone_color[3] * bone_color[0] * 255)|0;
bone_color[1] = (bone_color[3] * bone_color[1] * 255)|0;
bone_color[2] = (bone_color[3] * bone_color[2] * 255)|0;
bone_color[3] = (bone_color[3] * 255)|0;

function mat2d_alloc() { return matrix_pool.length > 0 ? matrix_pool.pop() : sk2.mat2d(); }
function mat2d_free(m) { matrix_pool.push(m); }

function clear_coords()
{
	for (var i = 0, n = coords.length; i < n; i++)
		coords.pop();
}

function SkeletonRenderer(gfx)
{
	this.gfx = gfx;
	this.vbo = gfx.create_vbo(500, gfx.Stream);
	this.ibo = gfx.create_ibo(500, gfx.Stream);
	this.show_bones = true;
}

SkeletonRenderer.prototype.draw = function(skeleton, x, y, scale)
{
	var gfx = this.gfx;
	var vbo = this.vbo;
	var ibo = this.ibo;
	var skin = skeleton.skins[0];

	var m = view_transform;
	var s = scale;

	m[0] = s; m[3] = 0; m[6] = x;
	m[1] = 0; m[4] = s; m[7] = y;
	m[2] = 0; m[5] = 0; m[8] = 1;

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
			case sk2.AttachmentCircle:  add_ellipse(slot, attachment, vbo, ibo); break;
			case sk2.AttachmentPath:    add_path(skeleton, slot, attachment, vbo, ibo); break;
		}
	}

	var count = ibo.size;
	var lines_offset = vbo.size;

	if (this.show_bones)
	{
		add_bones(skeleton, vbo, ibo);

		count = ibo.size;
		lines_offset = vbo.size;

		add_bone_marks(skeleton, vbo, ibo);
	}

	vbo.upload();
	ibo.upload();

	gfx.transform(m);
	gfx.draw(gfx.Triangles, vbo, ibo, 0, count);

	if (this.show_bones)
	{
		m[0] = m[4] = 1;
		m[6] = m[7] = 0;

		gfx.transform(m);
		gfx.draw(gfx.Lines, vbo, null, lines_offset, 4 * skeleton.bones.length);
	}
}

function add_bones(skeleton, vbo, ibo)
{
	var s = 5;
	var nbones = skeleton.bones.length;

	vbo.reserve(vbo.size + nbones * 4 * 2);
	ibo.reserve(ibo.size + 3 * nbones * 2);

	for (var i = 0, n = nbones; i < n; i++)
	{
		var bone = skeleton.bones[i];

		if (bone.length >= 2 * s)
		{
			var base = vbo.size;
			var l = bone.length;

			bone_color[0] = (bone.color.r * 255)|0;
			bone_color[1] = (bone.color.g * 255)|0;
			bone_color[2] = (bone.color.b * 255)|0;
			bone_color[3] = (0.7 * bone.color.a * 255)|0;

			vbo.push(bone.to_worldx(-s,  0), bone.to_worldy(-s,  0), 0, 0, bone_color);
			vbo.push(bone.to_worldx( 0,  s), bone.to_worldy( 0,  s), 0, 0, bone_color);
			vbo.push(bone.to_worldx( l,  0), bone.to_worldy( l,  0), 0, 0, bone_color);
			vbo.push(bone.to_worldx( 0, -s), bone.to_worldy( 0, -s), 0, 0, bone_color);

			ibo.push(base + 0, base + 1, base + 2);
			ibo.push(base + 0, base + 2, base + 3);
		}
	}
}

function add_bone_marks(skeleton, vbo, ibo)
{
	var nbones = skeleton.bones.length;
	var m = view_transform;
	var s = 3;

	bone_color[0] = 0;
	bone_color[1] = 0;
	bone_color[2] = 0;
	bone_color[3] = 255;

	for (var i = 0, n = nbones; i < n; i++)
	{
		var bone = skeleton.bones[i];
		var base = vbo.size;
		var px = bone.to_worldx(0, 0);
		var py = bone.to_worldy(0, 0);
		var x = 0.5 + Math.floor(mat3mulx(m, px, py));
		var y = 0.5 + Math.floor(mat3muly(m, px, py));

		vbo.push(x - s, y, 0, 0, bone_color);
		vbo.push(x + s, y, 0, 0, bone_color);
		vbo.push(x, y - s, 0, 0, bone_color);
		vbo.push(x, y + s, 0, 0, bone_color);
	}
}

function add_rect(slot, attachment, vbo, ibo)
{
	var m = sk2.mat2d_mul(slot.bone.world_transform, attachment.transform, mat2d_alloc());
	var r = attachment.border_radius;
	var w = attachment.width;
	var h = attachment.height;

	if (r > path.dist_tol)
	{
		var rx = Math.min(r, Math.abs(w) * 0.5) * (w > 0 ? 1 : -1);
		var ry = Math.min(r, Math.abs(h) * 0.5) * (h > 0 ? 1 : -1);

		var k = 1 - kappa90;

		coords.push(0, ry);
		coords.push(0, h - ry);
		coords.push(0, h - ry * k, rx * k, h, rx, h);
		coords.push(w - rx, h);
		coords.push(w - rx * k, h, w, h - ry * k, w, h - ry);
		coords.push(w, ry);
		coords.push(w, ry * k, w - rx * k, 0, w - rx, 0);
		coords.push(rx, 0);
		coords.push(rx * k, 0, 0, ry * k, 0, ry);

		var cx = w / 2;
		var cy = h / 2;

		for (var i = 0, n = coords.length; i < n; i += 2)
		{
			var x = coords[i + 0] - cx;
			var y = coords[i + 1] - cy;
			coords[i + 0] = sk2.mat2d_mulx(m, x, y);
			coords[i + 1] = sk2.mat2d_muly(m, x, y);
		}

		path.begin(coords[0], coords[1]);

		for (var i = 0, j = 2, p = coords; i < 4; i++, j += 8)
		{
			path.line_to(p[j + 0], p[j + 1]);
			path.bezier_to(p[j + 2], p[j + 3], p[j + 4], p[j + 5], p[j + 6], p[j + 7]);
		}

		path.close();
		clear_coords();
	}
	else
	{
		var cx = w / 2;
		var cy = h / 2;

		path.begin(  sk2.mat2d_mulx(m, 0 - cx, 0 - cy), sk2.mat2d_muly(m, 0 - cx, 0 - cy));
		path.line_to(sk2.mat2d_mulx(m, w - cx, 0 - cy), sk2.mat2d_muly(m, w - cx, 0 - cy));
		path.line_to(sk2.mat2d_mulx(m, w - cx, h - cy), sk2.mat2d_muly(m, w - cx, h - cy));
		path.line_to(sk2.mat2d_mulx(m, 0 - cx, h - cy), sk2.mat2d_muly(m, 0 - cx, h - cy));
		path.close();
	}

	stroke_and_fill(slot, attachment, true, vbo, ibo);
	mat2d_free(m);
}

function add_ellipse(slot, attachment, vbo, ibo)
{
	var m = sk2.mat2d_mul(slot.bone.world_transform, attachment.transform, mat2d_alloc());
	var rx = 0;
	var ry = 0;

	if (attachment.type === sk2.AttachmentEllipse)
	{
		rx = attachment.rx;
		ry = attachment.ry;
	}
	else
	{
		rx = attachment.radius;
		ry = attachment.radius;
	}

	var k = kappa90;
	var p = coords;

	p.push(-rx, 0);
	p.push(-rx, ry * k, -rx * k, ry, 0, ry);
	p.push(rx * k, ry, rx, ry * k, rx, 0);
	p.push(rx, -ry * k, rx * k, -ry, 0, -ry);
	p.push(-rx * k, -ry, -rx, -ry * k, -rx, 0);

	for (var i = 0, n = p.length; i < n; i += 2)
	{
		var x = p[i + 0];
		var y = p[i + 1];
		p[i + 0] = sk2.mat2d_mulx(m, x, y);
		p[i + 1] = sk2.mat2d_muly(m, x, y);
	}

	path.begin(p[0], p[1]);

	for (var i = 0, j = 2; i < 4; i++, j += 6)
		path.bezier_to(p[j + 0], p[j + 1], p[j + 2], p[j + 3], p[j + 4], p[j + 5]);

	path.close();
	clear_coords();
	stroke_and_fill(slot, attachment, true, vbo, ibo);
	mat2d_free(m);
}

function add_path(skeleton, slot, attachment, vbo, ibo)
{
	var commands = attachment.commands;
	var ncommands = commands.length;
	var points = attachment.points;
	var slot_bone = slot.bone;

	if (ncommands === 0)
		return;

	var m = sk2.mat2d_mul(slot_bone.world_transform, attachment.transform, mat2d_alloc());
	var im = sk2.mat2d_inverse(slot_bone.world_transform, mat2d_alloc());

	var closed = false;

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
			var x = p.x;
			var y = p.y;

			if (bone !== slot_bone)
			{
				var wx = bone.to_worldx(x, y);
				var wy = bone.to_worldy(x, y);
				x = sk2.mat2d_mulx(im, wx, wy);
				y = sk2.mat2d_muly(im, wx, wy);
			}

			coords.push(sk2.mat2d_mulx(m, x, y));
			coords.push(sk2.mat2d_muly(m, x, y));
		}

		path_func.apply(path, coords);
		clear_coords();

		if (path_func === path.close)
		{
			closed = true;
			break;
		}
	}

	path.line_cap = attachment.line_cap;
	stroke_and_fill(slot, attachment, closed, vbo, ibo);

	mat2d_free(m);
	mat2d_free(im);
}

function stroke_and_fill(slot, attachment, closed, vbo, ibo)
{
	var w = attachment.line_width;
	var slot_color = slot.current_state;

	path.stroke_width = w;
	path.line_join = attachment.line_join;
	path.miter_limit = attachment.miter_limit;

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

	if (closed)
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
