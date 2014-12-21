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

function Skeleton()
{
	this.bones = [];
	this.slots = [];
	this.order = [];
	this.transform = mat2d();
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

// --- Animation ---

function Animation()
{
	this.timelines = [];
}

Animation.prototype.apply = function(skeleton, t0, t1, percent)
{
	for (var i = 0, tls = this.timelines, n = tls.length; i < n; i++)
		this.apply_timeline(tls[i], skeleton, t0, t1, percent);
}

Animation.prototype.apply_timeline = function(timeline, skeleton, t0, t1, percent)
{
	if (t1 < timeline.keyframes[0].time)
		return;

	switch (timeline.type)
	{
		case TimelineBone:
			this.apply_timeline_bone(timeline, skeleton, t0, t1, percent);
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

		case PropBoneFlipX:  cur.flipx = tl.val_flip(t0, t1, def.flipx); break;
		case PropBoneFlipY:  cur.flipy = tl.val_flip(t0, t1, def.flipy); break;
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
	var percent = a.interpolator((t - a.time) / (b.time - a.time));

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
}

// --- Keyframe ---

function Keyframe()
{
	this.time = 0;
	this.value = 0;
	this.interpolator = interpolator_linear;
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
	this.world_rot = 0;
	this.world_sx = 0;
	this.world_sy = 0;
	this.world_flipx = 0;
	this.world_flipy = 0;
}

Bone.prototype.reset = function()
{
	this.current_state.set(this.initial_state);
}

Bone.prototype.update_transform = function()
{
	var state = this.current_state;
	var parent = this.parent;
	var parent_transform = parent !== null ? parent.world_transform : this.skeleton.transform;

	this.world_rot = state.rot;
	this.world_sx = state.sx;
	this.world_sy = state.sy;
	this.world_flipx = state.flipx;
	this.world_flipy = state.flipy;

	var irot = 0; // inverse parent rotation
	var isx = 1;  // inverse parent scale x
	var isy = 1;  // inverse parent scale y

	if (parent !== null)
	{
		irot = -parent.world_rot;
		isx = 1 / parent.world_sx;
		isy = 1 / parent.world_sy;

		this.world_flipx = (parent.world_flipx !== state.flipx);
		this.world_flipy = (parent.world_flipy !== state.flipy);

		if (this.inherit_rotation)
			this.world_rot += parent.world_rot;
		else
			irot = -parent.world_rot;

		if (this.inherit_scale)
		{
			this.world_sx *= parent.world_sx;
			this.world_sy *= parent.world_sy;
		}
		else
		{
			isx = 1 / parent.world_sx;
			isy = 1 / parent.world_sy;
		}
	}

	// world_transform = parent_transform * translate * inv_parent_rot * inv_parent_scale *
	//                   flip_scale * world_rot * world_scale
	//
	// This stuff can be used in Maxima:
	// parent_transform: matrix([a,c,e],[b,d,f],[0,0,1]);
	// translate:        matrix([1,0,x],[0,1,y],[0,0,1]);
	// inv_parent_rot:   matrix([ic,-is,0],[is,ic,0],[0,0,1]);
	// inv_parent_scale: matrix([isx,0,0],[0,isy,0],[0,0,1]);
	// flip:             matrix([fx,0,0],[0,fy,0],[0,0,1]);
	// rotate:           matrix([wc,-ws,0],[ws,wc,0],[0,0,1]);
	// scale:            matrix([sx,0,0],[0,sy,0],[0,0,1]);
	// result: parent_transform . translate . inv_parent_rot . inv_parent_scale . flip . rotate . scale;
	//
	// result.a = a (fx isx sx  ic wc - fy isy sx  is ws) + c (fy isy sx  ic ws + fx isx sx  is wc)
	// result.b = b (fx isx sx  ic wc - fy isy sx  is ws) + d (fy isy sx  ic ws + fx isx sx  is wc)
	// result.c = c (fy isy sy  ic wc - fx isx sy  is ws) - a (fx isx sy  ic ws + fy isy sy  is wc)
	// result.d = d (fy isy sy  ic wc - fx isx sy  is ws) - b (fx isx sy  ic ws + fy isy sy  is wc)
	// result.e = c y + a x + e
	// result.f = d y + b x + f

	var world_transform = this.world_transform;

	var a = parent_transform[0], c = parent_transform[2], e = parent_transform[4];
	var b = parent_transform[1], d = parent_transform[3], f = parent_transform[5];

	var is = Math.sin(irot),             ic = Math.cos(irot);
	var ws = Math.sin(this.world_rot),   wc = Math.cos(this.world_rot);
	var fx = this.world_flipx ? -1 : 1,  fy = this.world_flipy ? -1 : 1;
	var sx = this.world_sx,              sy = this.world_sy;

	// factors from the result to avoid repeating multiplications

	var fsx = fx * isx;
	var fsy = fy * isy;

	var fxx = fsx * sx;
	var fxy = fsx * sy;
	var fyx = fsy * sx;
	var fyy = fsy * sy;

	var cc = ic * wc;
	var ss = is * ws;
	var cs = ic * ws;
	var sc = is * wc;

	var fxxcc = fxx * cc; var fyxss = fyx * ss; var fyxcs = fyx * cs; var fxxsc = fxx * sc;
	var fyycc = fyy * cc; var fxyss = fxy * ss; var fxycs = fxy * cs; var fyysc = fyy * sc;

	world_transform[0] = a * (fxxcc - fyxss) + c * (fyxcs + fxxsc);
	world_transform[1] = b * (fxxcc - fyxss) + d * (fyxcs + fxxsc);
	world_transform[2] = c * (fyycc - fxyss) - a * (fxycs + fyysc);
	world_transform[3] = d * (fyycc - fxyss) - b * (fxycs + fyysc);
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

function interpolator_linear(x)
{
	return x;
}
