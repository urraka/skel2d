(function() {

// --- enums/constants ---

var Pi = Math.PI;
var Tau = 2 * Pi;

var TimelineBone      = 0;
var TimelineSlot      = 1;
var TimelineDrawOrder = 2;
var TimelineEvents    = 3;

var PropBoneX      = 0;
var PropBoneY      = 1;
var PropBoneRot    = 2;
var PropBoneScaleX = 3;
var PropBoneScaleY = 4;
var PropBoneFlipX  = 5;
var PropBoneFlipY  = 6;

var PropSlotColorR     = 0;
var PropSlotColorG     = 1;
var PropSlotColorB     = 2;
var PropSlotColorA     = 3;
var PropSlotAttachment = 4;

// --- Skeleton ---

function Skeleton(data)
{
	this.bones = [];
	this.slots = [];
	this.order = [];
	this.transform = mat2d();

	if (data)
	{
		var bones = data.bones;
		var n = bones.length;

		for (var i = 0; i < n; i++)
		{
			var bone = new Bone();
			var bone_data = bones[i];

			bone.name = bone_data.name.toString();
			bone.skeleton = this;
			bone.length = ("length" in bone_data ? Number(bone_data.length) : 0);
			bone.inherit_rotation = ("inhrot" in bone_data ? !!bone_data.inhrot : true);
			bone.inherit_scale = ("inhscale" in bone_data ? !!bone_data.inhscale : true);
			bone.initial_state.x = ("x" in bone_data ? Number(bone_data.x) : 0);
			bone.initial_state.y = ("y" in bone_data ? Number(bone_data.y) : 0);
			bone.initial_state.sx = ("sx" in bone_data ? Number(bone_data.sx) : 1);
			bone.initial_state.sy = ("sy" in bone_data ? Number(bone_data.sy) : 1);
			bone.initial_state.rot = ("rot" in bone_data ? Number(bone_data.rot) : 0);
			bone.initial_state.flipx = ("flipx" in bone_data ? !!bone_data.flipx : false);
			bone.initial_state.flipy = ("flipy" in bone_data ? !!bone_data.flipy : false);

			if (isNaN(bone.length)) bone.length = 0;
			if (isNaN(bone.initial_state.x)) bone.initial_state.x = 0;
			if (isNaN(bone.initial_state.y)) bone.initial_state.y = 0;
			if (isNaN(bone.initial_state.sx)) bone.initial_state.sx = 1;
			if (isNaN(bone.initial_state.sy)) bone.initial_state.sy = 1;
			if (isNaN(bone.initial_state.rot)) bone.initial_state.rot = 0;

			bone.initial_state.rot = normalize_angle(to_radians(bone.initial_state.rot));

			this.bones.push(bone);
		}

		for (var i = 0; i < n; i++)
		{
			var parent_name = this.bones[i].name.split(".");

			parent_name.pop();
			parent_name = parent_name.join(".");

			if (parent_name.length > 0)
			{
				var index = this.find_bone(parent_name);

				if (index >= 0)
					this.bones[i].parent = this.bones[index];
			}
		}

		this.bones.sort(function(a, b)
		{
			var a_depth = 0;
			var b_depth = 0;

			while (a.parent !== null)
			{
				a = a.parent;
				a_depth++;
			}

			while (b.parent !== null)
			{
				b = b.parent;
				b_depth++;
			}

			return a_depth - b_depth;
		});

		this.reset();
		this.update_transform();
	}
}

Skeleton.prototype.find_bone = function(name)
{
	var bones = this.bones;

	for (var i = 0, n = bones.length; i < n; i++)
	{
		if (bones[i].name === name)
			return i;
	}

	return -1;
}

Skeleton.prototype.update_transform = function()
{
	var bones = this.bones;

	for (var i = 0, n = bones.length; i < n; i++)
		bones[i].update_transform();
}

Skeleton.prototype.reset = function()
{
	var bones = this.bones;

	for (var i = 0, n = bones.length; i < n; i++)
		bones[i].reset();
}

// --- Easing ---

function Easing() {}

Easing.linear = function(x) { return x };
Easing.sin_in = function(x) { return Math.sin(x * Pi/2); };
Easing.sin_out = function(x) { return 1 - Math.sin(Pi/2 + x * Pi/2); };

// --- Animation ---

function Animation(skeleton, data)
{
	this.timelines = [];

	if (data)
	{
		for (var bone_name in data.bones)
		{
			var bone_index = skeleton.find_bone(bone_name);

			if (bone_index >= 0)
			{
				var timelines = data.bones[bone_name];

				for (var prop in timelines)
				{
					var timeline = new Timeline();
					var keyframes = timelines[prop];

					timeline.type = TimelineBone;
					timeline.index = bone_index;

					switch (prop)
					{
						case "x":     timeline.property = PropBoneX;      break;
						case "y":     timeline.property = PropBoneY;      break;
						case "rot":   timeline.property = PropBoneRot;    break;
						case "sx":    timeline.property = PropBoneScaleX; break;
						case "sy":    timeline.property = PropBoneScaleY; break;
						case "flipx": timeline.property = PropBoneFlipX;  break;
						case "flipy": timeline.property = PropBoneFlipY;  break;
					}

					for (var i = 0, n = keyframes.length; i < n; i++)
					{
						var keyframe = new Keyframe();

						keyframe.time = keyframes[i].time;
						keyframe.value = keyframes[i].value;

						if ("easing" in keyframes[i] && keyframes[i].easing in Easing)
							keyframe.easing = Easing[keyframes[i].easing];

						if (timeline.property === PropBoneRot)
							keyframe.value = normalize_angle(to_radians(keyframe.value));

						timeline.keyframes.push(keyframe);
					}

					this.timelines.push(timeline);
				}
			}
		}
	}
}

Animation.prototype.apply = function(skeleton, t0, t1, percent)
{
	for (var i = 0, tls = this.timelines, n = tls.length; i < n; i++)
		this.apply_timeline(tls[i], skeleton, t0, t1, percent);
}

Animation.prototype.apply_timeline = function(timeline, skeleton, t0, t1, percent)
{
	var begin = timeline.keyframes[0].time;
	var prop = timeline.property;

	switch (timeline.type)
	{
		case TimelineBone:
		{
			if (t1 >= begin || prop === PropBoneFlipX || prop === PropBoneFlipY)
				this.apply_timeline_bone(timeline, skeleton, t0, t1, percent);
		}
		break;
	}
}

Animation.prototype.apply_timeline_bone = function(tl, skeleton, t0, t1, p)
{
	var bone = skeleton.bones[tl.index];
	var cur = bone.current_state;
	var def = bone.initial_state;

	switch (tl.property)
	{
		case PropBoneRot:    cur.rot = lerp_angle(cur.rot, def.rot + tl.val_rot(t1), p); break;
		case PropBoneX:      cur.x   = lerp(cur.x,  def.x  + tl.val(t1), p); break;
		case PropBoneY:      cur.y   = lerp(cur.y,  def.y  + tl.val(t1), p); break;
		case PropBoneScaleX: cur.sx  = lerp(cur.sx, def.sx + tl.val(t1), p); break;
		case PropBoneScaleY: cur.sy  = lerp(cur.sy, def.sy + tl.val(t1), p); break;
		case PropBoneFlipX:  cur.flipx = tl.val_flip(t0, t1, cur.flipx); break;
		case PropBoneFlipY:  cur.flipy = tl.val_flip(t0, t1, cur.flipy); break;
	}
}

// --- Timeline ---

function Timeline()
{
	this.type = TimelineBone;
	this.index = null;
	this.property = null;
	this.keyframes = [];
}

Timeline.prototype.find = function(t)
{
	var list = this.keyframes;
	var a = 0;
	var b = list.length - 1;

	while (a < b)
	{
		var i = (a + b) >>> 1;

		if (list[i].time < t)
			a = i + 1;
		else
			b = i;
	}

	return list[a].time <= t ? a : a - 1;
}

Timeline.prototype.val_lerp = function(t, lerp_func)
{
	var keyframes = this.keyframes;
	var n = keyframes.length;

	if (t >= keyframes[n - 1].time)
		return keyframes[n - 1].value;

	var i = this.find(t);
	var a = keyframes[i];
	var b = keyframes[i + 1];
	var percent = a.easing((t - a.time) / (b.time - a.time));

	return lerp_func(a.value, b.value, percent);
}

Timeline.prototype.val = function(t)
{
	return this.val_lerp(t, lerp);
}

Timeline.prototype.val_rot = function(t)
{
	return this.val_lerp(t, lerp_angle);
}

Timeline.prototype.val_flip = function(t0, t1, def)
{
	var keyframes = this.keyframes;
	var n = keyframes.length;

	if (t1 < keyframes[0].time)
	{
		if (t0 > t1)
		{
			var end = keyframes[n - 1].time;
			return this.val_flip(Math.min(t0, end), end, def);
		}
	}
	else
	{
		if (t0 > t1)
			t0 = -1;

		var i = this.find(t1);

		if (keyframes[i].time > t0)
			return keyframes[i].value;
	}

	return def;
}

// --- Keyframe ---

function Keyframe()
{
	this.time = 0;
	this.value = 0;
	this.easing = Easing.linear;
}

// --- BoneState ---

function BoneState()
{
	this.x     = 0;
	this.y     = 0;
	this.rot   = 0;
	this.sx    = 1;
	this.sy    = 1;
	this.flipx = false;
	this.flipy = false;
}

BoneState.prototype.set = function(state)
{
	this.x     = state.x;
	this.y     = state.y;
	this.rot   = state.rot;
	this.sx    = state.sx;
	this.sy    = state.sy;
	this.flipx = state.flipx;
	this.flipy = state.flipy;
}

// --- Bone ---

function Bone()
{
	this.name = null;
	this.skeleton = null;
	this.parent = null;
	this.length = 0;
	this.inherit_rotation = true;
	this.inherit_scale = true;
	this.initial_state = new BoneState();
	this.current_state = new BoneState();

	this.world_transform = mat2d();
	this.accum_rot = 0;
	this.accum_sx = 0;
	this.accum_sy = 0;
}

Bone.prototype.reset = function()
{
	this.current_state.set(this.initial_state);
}

Bone.prototype.to_worldx = function(x, y)
{
	return mat2d_mulx(this.world_transform, x, y);
}

Bone.prototype.to_worldy = function(x, y)
{
	return mat2d_muly(this.world_transform, x, y);
}

Bone.prototype.update_transform = function()
{
	var state = this.current_state;
	var parent = this.parent;
	var parent_transform = parent !== null ? parent.world_transform : this.skeleton.transform;

	this.accum_rot = state.rot;
	this.accum_sx = state.sx;
	this.accum_sy = state.sy;

	var irot = 0; // inverse parent rotation
	var isx = 1;  // inverse parent scale x
	var isy = 1;  // inverse parent scale y

	if (parent !== null)
	{
		irot = -parent.accum_rot;
		isx = 1 / parent.accum_sx;
		isy = 1 / parent.accum_sy;

		if (this.inherit_rotation)
			this.accum_rot += parent.accum_rot;
		else
			irot = -parent.accum_rot;

		if (this.inherit_scale)
		{
			this.accum_sx *= parent.accum_sx;
			this.accum_sy *= parent.accum_sy;
		}
		else
		{
			isx = 1 / parent.accum_sx;
			isy = 1 / parent.accum_sy;
		}
	}

	// world_transform = parent_transform * translate * inv_parent_scale * inv_parent_rot *
	//                   flip_scale * accum_rot * accum_scale
	//
	// This stuff can be used in Maxima:
	// parent_transform: matrix([a,c,e],[b,d,f],[0,0,1]);
	// translate:        matrix([1,0,x],[0,1,y],[0,0,1]);
	// inv_parent_scale: matrix([isx,0,0],[0,isy,0],[0,0,1]);
	// inv_parent_rot:   matrix([ic,-is,0],[is,ic,0],[0,0,1]);
	// flip:             matrix([fx,0,0],[0,fy,0],[0,0,1]);
	// rotate:           matrix([wc,-ws,0],[ws,wc,0],[0,0,1]);
	// scale:            matrix([sx,0,0],[0,sy,0],[0,0,1]);
	// result: parent_transform . translate . inv_parent_scale . inv_parent_rot . flip . rotate . scale;
	//
	// result.a = a isx (fx sx ic wc - fy sx is ws) + c isy (fy sx ic ws + fx sx is wc)
	// result.b = b isx (fx sx ic wc - fy sx is ws) + d isy (fy sx ic ws + fx sx is wc)
	// result.c = c isy (fy sy ic wc - fx sy is ws) - a isx (fx sy ic ws + fy sy is wc)
	// result.d = d isy (fy sy ic wc - fx sy is ws) - b isx (fx sy ic ws + fy sy is wc)
	// result.e = c y + a x + e
	// result.f = d y + b x + f

	var world_transform = this.world_transform;

	var a = parent_transform[0], c = parent_transform[2], e = parent_transform[4];
	var b = parent_transform[1], d = parent_transform[3], f = parent_transform[5];

	var is = Math.sin(irot),             ic = Math.cos(irot);
	var ws = Math.sin(this.accum_rot),   wc = Math.cos(this.accum_rot);
	var fx = state.flipx ? -1 : 1,       fy = state.flipy ? -1 : 1;
	var sx = this.accum_sx,              sy = this.accum_sy;

	// factors from the result to avoid repeating multiplications

	var ax = a * isx;
	var bx = b * isx;
	var cy = c * isy;
	var dy = d * isy;

	var fxx = fx * sx;
	var fxy = fx * sy;
	var fyx = fy * sx;
	var fyy = fy * sy;

	var cc = ic * wc;
	var ss = is * ws;
	var cs = ic * ws;
	var sc = is * wc;

	var fxxcc = fxx * cc; var fyxss = fyx * ss; var fyxcs = fyx * cs; var fxxsc = fxx * sc;
	var fyycc = fyy * cc; var fxyss = fxy * ss; var fxycs = fxy * cs; var fyysc = fyy * sc;

	world_transform[0] = ax * (fxxcc - fyxss) + cy * (fyxcs + fxxsc);
	world_transform[1] = bx * (fxxcc - fyxss) + dy * (fyxcs + fxxsc);
	world_transform[2] = cy * (fyycc - fxyss) - ax * (fxycs + fyysc);
	world_transform[3] = dy * (fyycc - fxyss) - bx * (fxycs + fyysc);
	world_transform[4] = c * state.y + a * state.x + e;
	world_transform[5] = d * state.y + b * state.x + f;
}

// --- functions ---

function mat2d() { return [1, 0, 0, 1, 0, 0]; }
function mat2d_mulx(m, x, y) { return m[0] * x + m[2] * y + m[4] }
function mat2d_muly(m, x, y) { return m[1] * x + m[3] * y + m[5]; }

function mat2d_mul(m, n, result)
{
	result[0] = m[0] * n[0] + m[2] * n[1];
	result[1] = m[1] * n[0] + m[3] * n[1];
	result[2] = m[0] * n[2] + m[2] * n[3];
	result[3] = m[1] * n[2] + m[3] * n[3];
	result[4] = m[0] * n[4] + m[2] * n[5] + m[4];
	result[5] = m[1] * n[4] + m[3] * n[5] + m[5];
	return result;
}

function normalize_angle(theta)
{
	while (theta > Pi) theta -= Tau;
	while (theta < -Pi) theta += Tau;
	return theta;
}

function to_radians(x)
{
	return x / 180 * Pi;
}

function lerp(a, b, p)
{
	return a + (b - a) * p;
}

function lerp_angle(a, b, p)
{
	a = normalize_angle(a);
	b = normalize_angle(b);

	if (Math.abs(a - b) < Pi)
		return lerp(a, b, p);

	if (a < b)
		a += Tau;
	else
		b += Tau;

	return normalize_angle(lerp(a, b, p));
}

// --- export ---

sk2 = {};

sk2.Pi = Pi;
sk2.Tau = Tau;

sk2.TimelineBone      = TimelineBone;
sk2.TimelineSlot      = TimelineSlot;
sk2.TimelineDrawOrder = TimelineDrawOrder;
sk2.TimelineEvents    = TimelineEvents;

sk2.PropBoneX      = PropBoneX;
sk2.PropBoneY      = PropBoneY;
sk2.PropBoneRot    = PropBoneRot;
sk2.PropBoneScaleX = PropBoneScaleX;
sk2.PropBoneScaleY = PropBoneScaleY;
sk2.PropBoneFlipX  = PropBoneFlipX;
sk2.PropBoneFlipY  = PropBoneFlipY;

sk2.PropSlotColorR     = PropSlotColorR;
sk2.PropSlotColorG     = PropSlotColorG;
sk2.PropSlotColorB     = PropSlotColorB;
sk2.PropSlotColorA     = PropSlotColorA;
sk2.PropSlotAttachment = PropSlotAttachment;

sk2.Skeleton = Skeleton;
sk2.Easing = Easing;
sk2.Animation = Animation;
sk2.Timeline = Timeline;
sk2.Keyframe = Keyframe;
sk2.BoneState = BoneState;
sk2.Bone = Bone;

sk2.mat2d = mat2d;
sk2.mat2d_mul = mat2d_mul;
sk2.mat2d_mulx = mat2d_mulx;
sk2.mat2d_muly = mat2d_muly;

}());
