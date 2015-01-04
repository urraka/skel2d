(function(scope) {

var Pi = Math.PI;

var PointCorner     = 0x01;
var PointLeft       = 0x02;
var PointBevel      = 0x04;
var PointInnerBevel = 0x08;

var Butt   = 0;
var Round  = 1;
var Square = 2;
var Bevel  = 3;
var Miter  = 4;

var MoveTo   = 0;
var LineTo   = 1;
var BezierTo = 2;
var QuadTo   = 3;
var Close    = 4;

function clamp(x, a, b)
{
	return Math.min(b, Math.max(a, x));
}

function Point()
{
	this.x = 0;
	this.y = 0;
	this.dx = 0;
	this.dy = 0;
	this.dmx = 0;
	this.dmy = 0;
	this.len = 0;
	this.flags = 0;
}

function Path(device_pixel_ratio)
{
	if (device_pixel_ratio === undefined)
		device_pixel_ratio = 1;

	this.stroke_width = 1;
	this.line_cap = Path.Butt;
	this.line_join = Path.Bevel;
	this.miter_limit = 10;
	this.stroke_color = [0, 0, 0, 255];
	this.fill_color = [0, 0, 0, 255];

	this.commands = [];
	this.points = [];
	this.points_pool = [];
	this.fill_list = [];
	this.last_color = [0, 0, 0, 255];
	this.closed = false;

	this.device_pixel_ratio = device_pixel_ratio;
	this.tess_tol = 0.25 / device_pixel_ratio;
	this.dist_tol = 0.01 / device_pixel_ratio;
	this.fringe_width = 1 / device_pixel_ratio;
}

Path.Butt   = Butt;
Path.Round  = Round;
Path.Square = Square;
Path.Bevel  = Bevel;
Path.Miter  = Miter;

Path.prototype.begin = function(x, y)
{
	var points = this.points;
	var points_pool = this.points_pool;
	var commands = this.commands;
	var fill_list = this.fill_list;

	while (points.length > 0)
		points_pool.push(points.pop());

	while (commands.length > 0)
		commands.pop();

	while (fill_list.length > 0)
		fill_list.pop();

	this.closed = false;

	commands.push(MoveTo);
	commands.push(x);
	commands.push(y);
}

Path.prototype.line_to = function(x, y)
{
	var commands = this.commands;

	commands.push(LineTo);
	commands.push(x);
	commands.push(y);
}

Path.prototype.bezier_to = function(c1x, c1y, c2x, c2y, x, y)
{
	var commands = this.commands;

	commands.push(BezierTo);
	commands.push(c1x);
	commands.push(c1y);
	commands.push(c2x);
	commands.push(c2y);
	commands.push(x);
	commands.push(y);
}

Path.prototype.quad_to = function(cx, cy, x, y)
{
	var commands = this.commands;

	commands.push(QuadTo);
	commands.push(cx);
	commands.push(cy);
	commands.push(x);
	commands.push(y);
}

Path.prototype.close = function()
{
	this.commands.push(Close);
}

Path.prototype.fill = function(vbo, ibo)
{
	var fill = this.fill_list;
	var n = fill.length;

	if (n > 0)
	{
		var same_color = true;
		var last_color = this.last_color;
		var fill_color = this.fill_color;

		for (var i = 0; i < 4; i++)
			same_color = (same_color && last_color[i] === fill_color[i]);

		ibo.reserve(ibo.size + 3 * (n - 2));

		if (same_color)
		{
			for (var i = 1; i < n - 1; i++)
				ibo.push(fill[0], fill[i], fill[i + 1]);
		}
		else
		{
			vbo.reserve(vbo.size + n);

			var base = vbo.size;

			for (var i = 0; i < n; i++)
			{
				var vertex = vbo.get(fill[i]);
				vbo.push(vertex.x, vertex.y, 0, 0, fill_color);
			}

			for (var i = 1; i < n - 1; i++)
				ibo.push(base, base + i, base + i + 1);
		}
	}
	else
	{
		flatten(this);

		var base = vbo.size;
		var points = this.points;
		var n = points.length;
		var fill_color = this.fill_color;

		vbo.reserve(base + n);
		ibo.reserve(ibo.size + 3 * (n - 2));

		for (var i = 0; i < n; i++)
			vbo.push(points[i].x, points[i].y, 0, 0, fill_color);

		for (var i = 1; i < n - 1; i++)
			ibo.push(base, base + i, base + i + 1);
	}
}

Path.prototype.stroke = function(vbo, ibo)
{
	flatten(this);

	var points = this.points;
	var npoints = points.length;

	var line_join = this.line_join;
	var line_cap = this.line_cap;
	var mlimit = this.miter_limit;
	var rgba = this.stroke_color;
	var loop = this.closed;

	for (var i = 0; i < 4; i++)
		this.last_color[i] = rgba[i];

	var w = this.stroke_width / 2;
	var iw = w > 0 ? 1.0 / w : 0;

	var ncap = Math.max(2, Math.ceil(Pi / (Math.acos(w / (w + this.tess_tol)) * 2.0)));
	var nbevel = 0;

	// calculate joins

	for (var i = npoints - 1, j = 0; j < npoints; i = j++)
	{
		var p0 = points[i];
		var p1 = points[j];

		var dlx0 =  p0.dy;
		var dly0 = -p0.dx;
		var dlx1 =  p1.dy;
		var dly1 = -p1.dx;

		p1.dmx = (dlx0 + dlx1) * 0.5;
		p1.dmy = (dly0 + dly1) * 0.5;

		var dmr2 = p1.dmx * p1.dmx + p1.dmy * p1.dmy;

		if (dmr2 > 0.000001)
		{
			var scale = 1.0 / dmr2;

			if (scale > 600.0)
				scale = 600.0;

			p1.dmx *= scale;
			p1.dmy *= scale;
		}

		p1.flags = (p1.flags & PointCorner) !== 0 ? PointCorner : 0;

		if (p1.dx * p0.dy - p0.dx * p1.dy > 0)
			p1.flags |= PointLeft;

		var limit = Math.max(1.01, Math.min(p0.len, p1.len) * iw);

		if (dmr2 * limit * limit < 1.0)
			p1.flags |= PointInnerBevel;

		if ((p1.flags & PointCorner) &&
			(dmr2 * mlimit * mlimit < 1.0 || line_join === Path.Bevel || line_join === Path.Round))
			p1.flags |= PointBevel;

		if ((p1.flags & (PointBevel | PointInnerBevel)) !== 0)
			nbevel++;
	}

	// calculate max vertex count

	var nvertices = 2 * (npoints + (loop ? 1 : 0));
	var nindices = 3 * (2 * (npoints - (loop ? 0 : 1)));

	if (line_join === Path.Round)
	{
		nvertices += nbevel * (6 + ncap - 2);
		nindices += 3 * (nbevel * (5 + ncap - 2));
	}
	else
	{
		nvertices += nbevel * 4;
		nindices += 3 * (nbevel * 2);
	}

	if (!loop && line_cap === Path.Round)
	{
		nvertices += 2 * (2 + ncap - 2);
		nindices += 2 * (3 * (2 + ncap - 2));
	}

	vbo.reserve(vbo.size + nvertices);
	ibo.reserve(ibo.size + nindices);

	// start doing real stuff

	if (loop)
	{
		var start = vbo.size;
		var fill_list = this.fill_list;

		for (var i = npoints - 1, j = 0; j < npoints; i = j++)
			add_join(vbo, ibo, points[i], points[j], w, ncap, line_join, rgba, fill_list);

		vbo.pushv(vbo.get(start + 0));
		vbo.pushv(vbo.get(start + 1));
	}
	else
	{
		var p = points[0];
		add_cap_start(vbo, ibo, p, p.dx, p.dy, w, ncap, line_cap, rgba);

		for (var i = 0, j = 1; j < npoints - 1; i = j++)
			add_join(vbo, ibo, points[i], points[j], w, ncap, line_join, rgba);

		var p = points[npoints - 2];
		add_cap_end(vbo, ibo, points[npoints - 1], p.dx, p.dy, w, ncap, line_cap, rgba);
	}
}

function point_equals(x1, y1, x2, y2, tol)
{
	var dx = x2 - x1;
	var dy = y2 - y1;

	return dx * dx + dy * dy < tol * tol;
}

function add_point(path, x, y, flags)
{
	var points = path.points;
	var npoints = points.length;

	if (npoints > 0)
	{
		var last = points[npoints - 1];

		if (point_equals(last.x, last.y, x, y, path.dist_tol))
		{
			last.flags |= flags;
			return;
		}
	}

	var pool = path.points_pool;
	var point = pool.length > 0 ? pool.pop() : new Point();

	point.x = x;
	point.y = y;
	point.flags = flags;

	points.push(point);
}

function flatten_bezier(path, x1, y1, x2, y2, x3, y3, x4, y4, level, type)
{
	if (level > 10)
		return;

	var dx = x4 - x1;
	var dy = y4 - y1;
	var d2 = Math.abs(((x2 - x4) * dy - (y2 - y4) * dx));
	var d3 = Math.abs(((x3 - x4) * dy - (y3 - y4) * dx));

	if ((d2 + d3) * (d2 + d3) < path.tess_tol * (dx * dx + dy * dy))
	{
		add_point(path, x4, y4, type);
		return;
	}

	var x12   = 0.5 * (x1 + x2);
	var y12   = 0.5 * (y1 + y2);
	var x23   = 0.5 * (x2 + x3);
	var y23   = 0.5 * (y2 + y3);
	var x34   = 0.5 * (x3 + x4);
	var y34   = 0.5 * (y3 + y4);
	var x123  = 0.5 * (x12 + x23);
	var y123  = 0.5 * (y12 + y23);
	var x234  = 0.5 * (x23 + x34);
	var y234  = 0.5 * (y23 + y34);
	var x1234 = 0.5 * (x123 + x234);
	var y1234 = 0.5 * (y123 + y234);

	flatten_bezier(path, x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1, 0);
	flatten_bezier(path, x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1, type);
}

function flatten_quad(path, x1, y1, x2, y2, x3, y3, level, type)
{
	if (level > 10)
		return;

	var dx = x3 - x1;
	var dy = y3 - y1;
	var d = Math.abs(((x2 - x3) * dy - (y2 - y3) * dx));

	if (d * d < path.tess_tol * (dx * dx + dy * dy))
	{
		add_point(path, x3, y3, type);
		return;
	}

	var x12  = 0.5 * (x1 + x2);
	var y12  = 0.5 * (y1 + y2);
	var x23  = 0.5 * (x2 + x3);
	var y23  = 0.5 * (y2 + y3);
	var x123 = 0.5 * (x12 + x23);
	var y123 = 0.5 * (y12 + y23);

	flatten_quad(path, x1, y1, x12, y12, x123, y123, level + 1, 0);
	flatten_quad(path, x123, y123, x23, y23, x3, y3, level + 1, type);
}

function flatten(path)
{
	var points = path.points;
	var commands = path.commands;
	var ncommands = commands.length;

	if (points > 0)
		return;

	for_loop: for (var i = 0; i < ncommands; i++)
	{
		switch (commands[i])
		{
			case MoveTo:
			case LineTo:
			{
				var x = commands[++i];
				var y = commands[++i];

				add_point(path, x, y, PointCorner);
			}
			break;

			case BezierTo:
			{
				var prev = points[points.length - 1];
				var c1x = commands[++i];
				var c1y = commands[++i];
				var c2x = commands[++i];
				var c2y = commands[++i];
				var x = commands[++i];
				var y = commands[++i];

				flatten_bezier(path, prev.x, prev.y, c1x, c1y, c2x, c2y, x, y, 0, PointCorner);
			}
			break;

			case QuadTo:
			{
				var prev = points[points.length - 1];
				var cx = commands[++i];
				var cy = commands[++i];
				var x = commands[++i];
				var y = commands[++i];

				flatten_quad(path, prev.x, prev.y, cx, cy, x, y, 0, PointCorner);
			}
			break;

			case Close:
				path.closed = true;
				break for_loop;
		}
	}

	var npoints = points.length;

	var p0 = points[npoints - 1];
	var p1 = points[0];

	if (point_equals(p0.x, p0.y, p1.x, p1.y, path.dist_tol))
	{
		npoints--;
		path.points_pool.push(points.pop());
		path.closed = true;
	}

	for (var i = npoints - 1, j = 0; j < npoints; i = j++)
	{
		var p0 = points[i];
		var p1 = points[j];

		var dx = p1.x - p0.x;
		var dy = p1.y - p0.y;
		var len = Math.sqrt(dx * dx + dy * dy);

		p0.dx = dx / len;
		p0.dy = dy / len;
		p0.len = len;
	}
}

function add_join(vbo, ibo, p0, p1, w, ncap, line_join, rgba, fill)
{
	var index = vbo.size;
	var is_left = ((p1.flags & PointLeft) !== 0);

	if ((p1.flags & (PointBevel | PointInnerBevel)) !== 0)
	{
		var dlx0 =  p0.dy;
		var dly0 = -p0.dx;
		var dlx1 =  p1.dy;
		var dly1 = -p1.dx;

		var bw = is_left ? w : -w;

		var x0, y0, x1, y1;

		if ((p1.flags & PointInnerBevel) !== 0)
		{
			x0 = p1.x + dlx0 * bw;
			y0 = p1.y + dly0 * bw;
			x1 = p1.x + dlx1 * bw;
			y1 = p1.y + dly1 * bw;
		}
		else
		{
			x0 = x1 = p1.x + p1.dmx * bw;
			y0 = y1 = p1.y + p1.dmy * bw;
		}

		if (line_join === Path.Round)
		{
			if (is_left)
			{
				var a0 = Math.atan2(-dly0, -dlx0);
				var a1 = Math.atan2(-dly1, -dlx1);

				if (a1 > a0)
					a1 -= 2 * Pi;

				var n = 1 + clamp(Math.ceil(((a0 - a1) / Pi) * ncap), 2, ncap);
				var center = index + 2 + (n - 2);

				vbo.push(x0, y0, 0, 0, rgba);
				vbo.push(p1.x - dlx0 * w, p1.y - dly0 * w, 0, 0, rgba);

				ibo.push(index + 0, index + 1, center);

				for (var i = 0; i < n - 2; i++)
				{
					var u = (i + 1) / (n - 1);
					var a = a0 + u * (a1 - a0);
					var x = p1.x + Math.cos(a) * w;
					var y = p1.y + Math.sin(a) * w;

					var idx = vbo.push(x, y, 0, 0, rgba);
					ibo.push(center, idx - 1, idx);
				}

				vbo.push(p1.x, p1.y, 0, 0, rgba); // center
				vbo.push(x1, y1, 0, 0, rgba);
				vbo.push(p1.x - dlx1 * w, p1.y - dly1 * w, 0, 0, rgba);

				ibo.push(center, center - 1, center + 2);
				ibo.push(center, center + 1, center + 2);

				if (fill) fill.push(index);
			}
			else
			{
				var a0 = Math.atan2(dly0, dlx0);
				var a1 = Math.atan2(dly1, dlx1);

				if (a1 < a0)
					a1 += 2 * Pi;

				var n = 1 + clamp(Math.ceil(((a1 - a0) / Pi) * ncap), 2, ncap);
				var center = index + 2;

				vbo.push(p1.x + dlx0 * w, p1.y + dly0 * w, 0, 0, rgba);
				vbo.push(x0, y0, 0, 0, rgba);
				vbo.push(p1.x, p1.y, 0, 0, rgba); // center

				ibo.push(index + 0, index + 1, center);
				ibo.push(center, index + 0, center + 1);

				for (i = 0; i < n - 2; i++)
				{
					var u = (i + 1) / (n - 1);
					var a = a0 + u * (a1 - a0);
					var x = p1.x + Math.cos(a) * w;
					var y = p1.y + Math.sin(a) * w;

					var idx = vbo.push(x, y, 0, 0, rgba);
					ibo.push(center, idx, idx + 1);
				}

				vbo.push(p1.x + dlx1 * w, p1.y + dly1 * w, 0, 0, rgba);
				vbo.push(x1, y1, 0, 0, rgba);

				ibo.push(center, center + (n - 1), center + n);

				if (fill) fill.push(index + 1);
			}
		}
		else
		{
			if (is_left)
			{
				vbo.push(x0, y0, 0, 0, rgba);
				vbo.push(p1.x - dlx0 * w, p1.y - dly0 * w, 0, 0, rgba);

				if (p1.flags & PointBevel)
				{
					ibo.push(index + 0, index + 1, index + 3);
				}
				else
				{
					vbo.push(p1.x, p1.y, 0, 0, rgba);
					vbo.push(p1.x - p1.dmx * w, p1.y - p1.dmy * w, 0, 0, rgba);
					ibo.push(index + 2, index + 1, index + 3);
					ibo.push(index + 2, index + 3, index + 5);
				}

				vbo.push(x1, y1, 0, 0, rgba);
				vbo.push(p1.x - dlx1 * w, p1.y - dly1 * w, 0, 0, rgba);

				if (fill) fill.push(index);
			}
			else
			{
				vbo.push(p1.x + dlx0 * w, p1.y + dly0 * w, 0, 0, rgba);
				vbo.push(x0, y0, 0, 0, rgba);

				if (p1.flags & PointBevel)
				{
					ibo.push(index + 0, index + 1, index + 2);
				}
				else
				{
					vbo.push(p1.x, p1.y, 0, 0, rgba);
					vbo.push(p1.x + p1.dmx * w, p1.y + p1.dmy * w, 0, 0, rgba);
					ibo.push(index + 2, index + 0, index + 3);
					ibo.push(index + 2, index + 3, index + 4);
				}

				vbo.push(p1.x + dlx1 * w, p1.y + dly1 * w, 0, 0, rgba);
				vbo.push(x1, y1, 0, 0, rgba);

				if (fill) fill.push(index + 1);
			}
		}
	}
	else
	{
		vbo.push(p1.x + (p1.dmx * w), p1.y + (p1.dmy * w), 0, 0, rgba);
		vbo.push(p1.x - (p1.dmx * w), p1.y - (p1.dmy * w), 0, 0, rgba);

		if (fill) fill.push(is_left ? index : index + 1);
	}

	index = vbo.size;

	ibo.push(index - 2, index - 1, index + 0);
	ibo.push(index - 1, index + 0, index + 1);
}

function add_cap_start(vbo, ibo, p, dx, dy, w, ncap, line_cap, rgba)
{
	var index = vbo.size;
	var dlx = dy;
	var dly = -dx;

	if (line_cap === Round)
	{
		var x = p.x;
		var y = p.y;

		vbo.push(x, y, 0, 0, rgba); // center
		ibo.push(index, index + ncap + 1, index + 1);

		for (var i = 0; i < ncap - 1; i++)
		{
			var a = (i + 1) / ncap * Pi;
			var ax = Math.cos(a) * w;
			var ay = Math.sin(a) * w;

			vbo.push(x - dlx * ax - dx * ay, y - dly * ax - dy * ay, 0, 0, rgba);
			ibo.push(index, index + 1 + i, index + 1 + (i + 1));
		}

		vbo.push(x + dlx * w, y + dly * w, 0, 0, rgba);
		vbo.push(x - dlx * w, y - dly * w, 0, 0, rgba);
		ibo.push(index + ncap + 0, index + ncap + 1, index + ncap + 2);
		ibo.push(index + ncap + 1, index + ncap + 2, index + ncap + 3);
	}
	else
	{
		var d = line_cap === Square ? w : 0;
		var x = p.x - dx * d;
		var y = p.y - dy * d;

		vbo.push(x + dlx * w, y + dly * w, 0, 0, rgba);
		vbo.push(x - dlx * w, y - dly * w, 0, 0, rgba);
		ibo.push(index + 0, index + 1, index + 2);
		ibo.push(index + 1, index + 2, index + 3);
	}
}

function add_cap_end(vbo, ibo, p, dx, dy, w, ncap, line_cap, rgba)
{
	var index = vbo.size;
	var dlx = dy;
	var dly = -dx;

	if (line_cap === Round)
	{
		var x = p.x;
		var y = p.y;

		vbo.push(x + dlx * w, y + dly * w, 0, 0, rgba);
		vbo.push(x - dlx * w, y - dly * w, 0, 0, rgba);

		for (var i = 0; i < ncap - 1; i++)
		{
			var a = (i + 1) / ncap * Pi;
			var ax = Math.cos(a) * w;
			var ay = Math.sin(a) * w;

			vbo.push(x - dlx * ax + dx * ay, y - dly * ax + dy * ay, 0, 0, rgba);
			ibo.push(index + ncap + 1, index + 2 + (i - 1), index + 2 + i);
		}

		vbo.push(x, y, 0, 0, rgba); // center
		ibo.push(index + ncap + 1, index + ncap, index + 0);
	}
	else
	{
		var d = line_cap === Square ? w : 0;
		var x = p.x + dx * d;
		var y = p.y + dy * d;

		vbo.push(x + dlx * w, y + dly * w, 0, 0, rgba);
		vbo.push(x - dlx * w, y - dly * w, 0, 0, rgba);
	}
}

scope.Path = Path;

}(this));
