(function() {

// --- enums/constants ---

var Pi = Math.PI;
var Pi2 = Pi / 2;
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

var AttachmentNone    = 0;
var AttachmentSprite  = 1;
var AttachmentRect    = 2;
var AttachmentEllipse = 3;
var AttachmentCircle  = 4;
var AttachmentPath    = 5;

var Butt   = 0;
var Round  = 1;
var Square = 2;
var Bevel  = 3;
var Miter  = 4;

// --- Skeleton ---

function load_bones(bones)
{
	var n = bones.length;

	for (var i = 0; i < n; i++)
	{
		var bone = new Bone();
		var data = bones[i];

		bone.name = data.name.toString();
		bone.skeleton = this;
		bone.length = ("length" in data ? to_number(data.length, 0) : 0);
		bone.inherit_rotation = ("inhrot" in data ? !!data.inhrot : true);
		bone.inherit_scale = ("inhscale" in data ? !!data.inhscale : true);
		bone.initial_state.x = ("x" in data ? to_number(data.x, 0) : 0);
		bone.initial_state.y = ("y" in data ? to_number(data.y, 0) : 0);
		bone.initial_state.sx = ("sx" in data ? to_number(data.sx, 1) : 1);
		bone.initial_state.sy = ("sy" in data ? to_number(data.sy, 1) : 1);
		bone.initial_state.flipx = ("flipx" in data ? !!data.flipx : false);
		bone.initial_state.flipy = ("flipy" in data ? !!data.flipy : false);
		bone.initial_state.rot = ("rot" in data ? to_number(data.rot, 0) : 0);
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
}

function load_slots(slots)
{
	var n = slots.length;

	for (var i = 0; i < n; i++)
	{
		var slot = new Slot();
		var data = slots[i];

		var name = "name" in data ? data.name.toString() : "";
		var bone_name = name.split(".");

		bone_name.pop();
		bone_name = bone_name.join(".");

		var bone_index = this.find_bone(bone_name);

		slot.name = name;
		slot.bone = bone_index >= 0 ? this.bones[bone_index] : null;

		if ("color" in data)
			parse_color(data.color.toString(), slot.initial_state);

		this.slots.push(slot);
		this.order.push(i);
	}
}

function load_attachment(data)
{
	var attachment = null;
	var type = "type" in data ? data.type.toString() : "none";
	var name = "name" in data ? data.name.toString() : "";
	var slot_name = name.split(".");

	slot_name.pop();
	slot_name = slot_name.join(".");

	var slot_index = this.find_slot(slot_name);

	if (slot_index === -1)
		return null;

	switch (type)
	{
		case "sprite":
			attachment = new SpriteAttachment();
			attachment.image = "image" in data ? data.image.toString() : null;
			break;

		case "rect":
			attachment = new RectAttachment();
			attachment.width = "width" in data ? to_number(data.width, 0) : 0;
			attachment.height = "height" in data ? to_number(data.height, 0) : 0;
			attachment.border_radius = "border_radius" in data ? to_number(data.border_radius, 0) : 0;
			break;

		case "ellipse":
			attachment = new EllipseAttachment();
			attachment.rx = "rx" in data ? to_number(data.rx, 0) : 0;
			attachment.ry = "ry" in data ? to_number(data.ry, 0) : 0;
			break;

		case "circle":
			attachment = new CircleAttachment();
			attachment.radius = "radius" in data ? to_number(data.radius, 0) : 0;
			break;

		case "path":
		{
			attachment = new PathAttachment();

			if ("line_cap" in data)
			{
				switch (data.line_cap)
				{
					case "butt":   attachment.line_cap = Butt;   break;
					case "square": attachment.line_cap = Square; break;
					case "round":  attachment.line_cap = Round;  break;
				}
			}

			if ("commands" in data && data.commands instanceof Array)
			{
				var commands = data.commands;
				var ncommands = commands.length;
				var def_bone = this.find_bone(this.slots[slot_index].bone.name);

				var i = 0;

				while (i < ncommands)
				{
					var command = commands[i++];
					var npoints = 0;

					switch (command)
					{
						case "M": npoints = 1; break;
						case "L": npoints = 1; break;
						case "B": npoints = 3; break;
						case "Q": npoints = 2; break;
						case "C": npoints = 0; break;
						default: npoints = -1; break;
					}

					if (npoints >= 0)
						attachment.commands.push(command);

					for (var j = 0; j < npoints; j++)
					{
						var x = to_number(commands[i++], 0);
						var y = to_number(commands[i++], 0);
						var bone = this.find_bone(commands[i++]);

						if (bone === -1)
							bone = def_bone;

						attachment.points.push(new BoundPoint(bone, x, y));
					}
				}
			}
		}
		break;

		default:
			attachment = new Attachment();
			break;
	}

	attachment.name = name;
	attachment.slot = slot_index;
	attachment.x = "x" in data ? to_number(data.x, 0) : 0;
	attachment.y = "y" in data ? to_number(data.y, 0) : 0;
	attachment.sx = "sx" in data ? to_number(data.sx, 1) : 1;
	attachment.sy = "sy" in data ? to_number(data.sy, 1) : 1;
	attachment.rot = "rot" in data ? to_number(data.rot, 0) : 0;
	attachment.rot = normalize_angle(to_radians(attachment.rot));

	var c = Math.cos(attachment.rot);
	var s = Math.sin(attachment.rot);

	attachment.transform[0] =  c * attachment.sx;
	attachment.transform[1] =  s * attachment.sx;
	attachment.transform[2] = -s * attachment.sy;
	attachment.transform[3] =  c * attachment.sy;
	attachment.transform[4] = attachment.x;
	attachment.transform[5] = attachment.y;

	var type = attachment.type;

	if (type === AttachmentPath || type === AttachmentRect ||
		type === AttachmentEllipse || type === AttachmentCircle)
	{
		attachment.line_width = "line_width" in data ? to_number(data.line_width, 1) : 1;

		if ("line_color" in data)
			parse_color(data.line_color.toString(), attachment.line_color);

		if ("fill_color" in data)
			parse_color(data.fill_color.toString(), attachment.fill_color);

		if ("line_join" in data)
		{
			switch (data.line_join)
			{
				case "miter": attachment.line_join = Miter; break;
				case "bevel": attachment.line_join = Bevel; break;
				case "round": attachment.line_join = Round; break;
			}
		}
	}

	return attachment;
}

function load_skins(skins)
{
	// load default/base skin

	var data = skins["default"];
	var default_skin = this.skins[0];

	if (!data)
		return;

	for (var i = 0, n = data.length; i < n; i++)
	{
		var attachment = load_attachment.call(this, data[i]);

		if (attachment !== null)
			default_skin.attachments.push(attachment);
	}

	// load other skins

	for (var skin_name in skins)
	{
		if (skin_name !== "default")
		{
			var data = skins[skin_name];
			var skin = new Skin();

			skin.name = skin_name;

			for (var i = 0, n = default_skin.length; i < n; i++)
				skin.attachments.push(default_skin.attachments[i]);

			for (var i = 0, n = data.length; i < n; i++)
			{
				var attachment = load_attachment.call(this, data[i]);

				if (attachment !== null)
				{
					var index = default_skin.find_attachment(attachment.name);

					if (index >= 0)
						skin.attachments[index] = attachment;
				}
			}
		}
	}
}

function Skeleton(data)
{
	this.bones = [];
	this.slots = [];
	this.order = [];
	this.skins = [new Skin()];
	this.transform = mat2d();

	if (data)
	{
		if ("bones" in data)
			load_bones.call(this, data.bones);

		if ("slots" in data)
			load_slots.call(this, data.slots);

		if ("skins" in data)
			load_skins.call(this, data.skins);

		// update attachments in slots now that they are loaded

		if ("slots" in data)
		{
			for (var i = 0, n = data.slots.length; i < n; i++)
			{
				if ("attachment" in data.slots[i])
				{
					var attch_name = this.slots[i].name + "." + data.slots[i].attachment.toString();
					this.slots[i].initial_state.attachment = this.skins[0].find_attachment(attch_name);
				}
			}
		}

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

Skeleton.prototype.find_slot = function(name)
{
	var slots = this.slots;

	for (var i = 0, n = slots.length; i < n; i++)
	{
		if (slots[i].name === name)
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
	var slots = this.slots;

	for (var i = 0, n = bones.length; i < n; i++)
		bones[i].reset();

	for (var i = 0, n = slots.length; i < n; i++)
		slots[i].reset();
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

	var state = this.current_state;
	var parent = this.parent;
	var parent_transform = parent !== null ? parent.world_transform : this.skeleton.transform;
	var world_transform = this.world_transform;

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

		if (this.inherit_scale)
		{
			this.accum_sx *= parent.accum_sx;
			this.accum_sy *= parent.accum_sy;
		}
	}

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

// --- SlotState ---

function SlotState()
{
	this.r = 1.0;
	this.g = 1.0;
	this.b = 1.0;
	this.a = 1.0;
	this.attachment = -1;
}

SlotState.prototype.set = function(state)
{
	this.r = state.r;
	this.g = state.g;
	this.b = state.b;
	this.a = state.a;
	this.attachment = state.attachment;
}

// --- Slot ---

function Slot()
{
	this.name = null;
	this.bone = null;
	this.initial_state = new SlotState();
	this.current_state = new SlotState();
}

Slot.prototype.reset = function()
{
	this.current_state.set(this.initial_state);
}

// --- Skin ---

function Skin()
{
	this.name = "default";
	this.attachments = [];
}

Skin.prototype.find_attachment = function(name)
{
	var attachments = this.attachments;

	for (var i = 0, n = attachments.length; i < n; i++)
	{
		if (attachments[i].name === name)
			return i;
	}

	return -1;
}

// --- Attachment ---

function BoundPoint(bone, x, y)
{
	this.bone = bone;
	this.x = x;
	this.y = y;
}

function Color(r, g, b, a)
{
	this.r = r;
	this.g = g;
	this.b = b;
	this.a = a;
}

function Attachment()
{
	this.name = null;
	this.type = AttachmentNone;
	this.slot = -1;
	this.data = null;

	this.x = 0;
	this.y = 0;
	this.sx = 1;
	this.sy = 1;
	this.rot = 0;

	this.transform = mat2d();
}

function SpriteAttachment()
{
	Attachment.call(this);

	this.type = AttachmentSprite;
	this.image = null;
}

function ShapeAttachment()
{
	Attachment.call(this);

	this.line_join = Miter;
	this.line_width = 0;
	this.line_color = new Color(0, 0, 0, 1);
	this.fill_color = new Color(0, 0, 0, 1);
}

function RectAttachment()
{
	ShapeAttachment.call(this);

	this.type = AttachmentRect;
	this.width = 0;
	this.height = 0;
	this.border_radius = 0;
}

function EllipseAttachment()
{
	ShapeAttachment.call(this);

	this.type = AttachmentEllipse;
	this.rx = 0;
	this.ry = 0;
}

function CircleAttachment()
{
	ShapeAttachment.call(this);

	this.type = AttachmentCircle;
	this.radius = 0;
}

function PathAttachment()
{
	ShapeAttachment.call(this);

	this.type = AttachmentPath;
	this.commands = [];
	this.points = [];
	this.line_cap = Butt;
}

// --- Easing ---

function Easing() {}

Easing.linear = function(x) { return x };
Easing.sin_in = function(x) { return 1 - Math.sin(Pi2 + x * Pi2); };
Easing.sin_out = function(x) { return Math.sin(x * Pi2); };
Easing.sin_in_out = function(x) { return 0.5 + 0.5 * Math.sin(x * Pi - Pi2); };

// --- Animation ---

function load_timelines(skeleton, type, data)
{
	for (var name in data)
	{
		var index = -1;

		switch (type)
		{
			case TimelineBone: index = skeleton.find_bone(name); break;
			case TimelineSlot: index = skeleton.find_slot(name); break;
		}

		if (index >= 0)
		{
			var timelines = data[name];

			for (var prop in timelines)
			{
				var timeline = new Timeline();
				var keyframes = timelines[prop];

				timeline.type = type;
				timeline.index = index;

				switch (type)
				{
					case TimelineBone:
					{
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
					}
					break;

					case TimelineSlot:
					{
						switch (prop)
						{
							case "r": timeline.property = PropSlotColorR; break;
							case "g": timeline.property = PropSlotColorG; break;
							case "b": timeline.property = PropSlotColorB; break;
							case "a": timeline.property = PropSlotColorA; break;
							case "@": timeline.property = PropSlotAttachment; break;
						}
					}
					break;
				}

				for (var i = 0, n = keyframes.length; i < n; i++)
				{
					var keyframe = new Keyframe();

					keyframe.time = keyframes[i].time;
					keyframe.value = keyframes[i].value;

					if ("easing" in keyframes[i] && keyframes[i].easing in Easing)
						keyframe.easing = Easing[keyframes[i].easing];

					if (type === TimelineBone && timeline.property === PropBoneRot)
						keyframe.value = normalize_angle(to_radians(keyframe.value));

					if (type === TimelineSlot && timeline.property === PropSlotAttachment)
					{
						var name = skeleton.slots[index].name + "." + keyframe.value;
						keyframe.value = skeleton.skins[0].find_attachment(name);
					}

					timeline.keyframes.push(keyframe);
				}

				this.timelines.push(timeline);
			}
		}
	}
}

function Animation(skeleton, data)
{
	this.timelines = [];

	if (data)
	{
		if ("bones" in data)
			load_timelines.call(this, skeleton, TimelineBone, data.bones);

		if ("slots" in data)
			load_timelines.call(this, skeleton, TimelineSlot, data.slots);
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

		case TimelineSlot:
		{
			if (t1 >= begin || prop === PropSlotAttachment)
				this.apply_timeline_slot(timeline, skeleton, t0, t1, percent);
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
		case PropBoneFlipX:  cur.flipx = tl.val_discrete(t0, t1, cur.flipx); break;
		case PropBoneFlipY:  cur.flipy = tl.val_discrete(t0, t1, cur.flipy); break;
	}
}

Animation.prototype.apply_timeline_slot = function(tl, skeleton, t0, t1, p)
{
	var slot = skeleton.slots[tl.index];
	var cur = slot.current_state;

	switch (tl.property)
	{
		case PropSlotColorR: cur.r = lerp(cur.r, tl.val(t1), p); break;
		case PropSlotColorG: cur.g = lerp(cur.g, tl.val(t1), p); break;
		case PropSlotColorB: cur.b = lerp(cur.b, tl.val(t1), p); break;
		case PropSlotColorA: cur.a = lerp(cur.a, tl.val(t1), p); break;
		case PropSlotAttachment: cur.attachment = tl.val_discrete(t0, t1, cur.attachment); break;
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

Timeline.prototype.val_discrete = function(t0, t1, def)
{
	var keyframes = this.keyframes;
	var n = keyframes.length;

	if (t1 < keyframes[0].time)
	{
		if (t0 > t1)
		{
			var end = keyframes[n - 1].time;
			return this.val_discrete(Math.min(t0, end), end, def);
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

// --- functions ---

function mat2d() { return [1, 0, 0, 1, 0, 0]; }
function mat2d_mulx(m, x, y) { return m[0] * x + m[2] * y + m[4] }
function mat2d_muly(m, x, y) { return m[1] * x + m[3] * y + m[5]; }

function mat2d_identity(m)
{
	m[0] = 1; m [2] = 0; m [4] = 0;
	m[1] = 0; m [3] = 1; m [5] = 0;
	return m;
}

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

function mat2d_inverse(m, result)
{
	var det = m[0] * m[3] - m[2] * m[1];

	if (det > -1e-6 && det < 1e-6)
		return mat2d_identity(result);

	var invdet = 1 / det;

	result[0] =  m[3] * invdet;
	result[1] = -m[1] * invdet;
	result[2] = -m[2] * invdet;
	result[3] =  m[0] * invdet;
	result[4] = (m[2] * m[5] - m[3] * m[4]) * invdet;
	result[5] = (m[1] * m[4] - m[0] * m[5]) * invdet;

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

function is_hex(str)
{
	for (var i = 0, n = str.length; i < n; i++)
	{
		var code = str.charCodeAt(i);

		if ((code < 97 || code > 102) && (code < 65 || code > 70) && (code < 48 || code > 57))
			return false;
	}

	return true;
}

function to_number(x, def)
{
	x = Number(x);
	return isNaN(x) ? def : x;
}

function parse_color(str, result)
{
	if (str.length === 8 && is_hex(str))
	{
		result.r = parseInt(str.substr(0, 2), 16) / 255;
		result.g = parseInt(str.substr(2, 2), 16) / 255;
		result.b = parseInt(str.substr(4, 2), 16) / 255;
		result.a = parseInt(str.substr(6, 2), 16) / 255;
	}
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

sk2.AttachmentNone    = AttachmentNone;
sk2.AttachmentSprite  = AttachmentSprite;
sk2.AttachmentRect    = AttachmentRect;
sk2.AttachmentEllipse = AttachmentEllipse;
sk2.AttachmentCircle  = AttachmentCircle;
sk2.AttachmentPath    = AttachmentPath;

sk2.Butt   = Butt;
sk2.Round  = Round;
sk2.Square = Square;
sk2.Bevel  = Bevel;
sk2.Miter  = Miter;

sk2.Skeleton = Skeleton;
sk2.BoneState = BoneState;
sk2.Bone = Bone;
sk2.SlotState = SlotState;
sk2.Slot = Slot;
sk2.Skin = Skin;
sk2.Attachment = Attachment;
sk2.SpriteAttachment = SpriteAttachment;
sk2.Easing = Easing;
sk2.Animation = Animation;
sk2.Timeline = Timeline;
sk2.Keyframe = Keyframe;

sk2.mat2d = mat2d;
sk2.mat2d_mul = mat2d_mul;
sk2.mat2d_mulx = mat2d_mulx;
sk2.mat2d_muly = mat2d_muly;
sk2.mat2d_identity = mat2d_identity;
sk2.mat2d_inverse = mat2d_inverse;

}());
