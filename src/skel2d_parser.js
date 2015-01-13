(function(scope) {

scope.skel2d_parse = parse;

var StateNone     = 0;
var StateSkeleton = 1;
var StateSkin     = 2;
var StateOrder    = 3;
var StateAnim     = 4;

function parse(source)
{
	var state = StateNone;
	var lines = source.match(/[^\r\n]+/g);
	var nlines = lines.length;

	var data = {
		bones: [],
		slots: [],
		attachments: []
	};

	var current_bone = null;
	var current_attachment = null;

	for (var i = 0; i < nlines; i++)
	{
		var line = lines[i];

		if (/^\s*$/.test(line))
			continue;

		while (line.charAt(line.length - 1) === "\\" && i + 1 < nlines)
			line = line.substr(0, line.length - 1) + lines[++i];

		switch (state)
		{
			case StateNone:
			{
				if (/^skeleton($| )/.test(line))
				{
					state = StateSkeleton;
				}
				else if (/^skin($| )/.test(line))
				{
				}
				else if (/^order($| )/.test(line))
				{
				}
				else if (/^anim($| )/.test(line))
				{
				}
			}
			break;

			case StateSkeleton:
			{
				if (/^[^\t]+/.test(line))
				{
					// end of skeleton

					state = StateNone;
					i--;
				}
				else if (/^\t[a-zA-Z_\-][\w\-]*(\.[a-zA-Z_\-][\w\-]*)*($|\s)/.test(line))
				{
					// bone

					var tokens = line.match(/\S+/g);

					current_bone = parse_bone(data.bones, tokens);
					current_attachment = null;

					if (current_bone !== null)
						data.bones.push(current_bone);
				}
				else if (/^\t\t@([a-zA-Z_\-][\w\-]*)?(\[[a-zA-Z_\-][\w\-]*\])*($|\s)/.test(line))
				{
					// slot/attachment

					if (current_bone !== null)
					{
						var tokens = line.match(/\S+/g);
						var slot = parse_slot(data.slots, current_bone, tokens);
						var attachment = parse_attachment(data.attachments, current_bone, tokens);

						if (slot !== null)
							data.slots.push(slot);

						if (attachment !== null)
						{
							data.attachments.push(attachment);

							if (attachment.type === "path")
								current_attachment = attachment;
						}

					}
				}
				else if (/^\t\t\t((M|Q|:|B|L)\s+|C($|\s+))/.test(line))
				{
					// path command

					if (current_attachment !== null && current_attachment.type === "path")
					{
						var tokens = line.match(/\S+/g);
						var command = parse_path_command(tokens);

						if (command !== null)
							Array.prototype.push.apply(current_attachment.commands, command);
					}
				}
				else if (/^\t[^\t]+/.test(line))
				{
					current_bone = null;
					current_attachment = null;
				}
				else if (/^\t\t[^\t]+/.test(line))
				{
					current_attachment = null;
				}
			}
			break;
		}
	}

	var bones = data.bones;
	var nbones = bones.length;
	var slots = data.slots;
	var nslots = slots.length;
	var attachments = data.attachments;
	var nattachments = attachments.length;

	for (var i = 0; i < nattachments; i++)
	{
		var attachment = attachments[i];

		if (attachment.type === "path")
		{
			var src_commands = attachment.commands;
			var dst_commands = attachment.commands = [];

			var name = attachment.name;
			var def = name.substring(0, name.lastIndexOf(".", name.lastIndexOf(".") - 1));

			for (var j = 0, n = src_commands.length; j < n; j++)
			{
				var cmd = src_commands[j];

				if (cmd === ":")
				{
					def = find_name(bones, src_commands[++j], def);
				}
				else
				{
					var count = 0;

					switch (cmd)
					{
						case "C": count = 0; break;
						case "M": count = 1; break;
						case "L": count = 1; break;
						case "Q": count = 2; break;
						case "B": count = 3; break;
					}

					dst_commands.push(cmd);

					for (var k = 0; k < count; k++)
					{
						var x = src_commands[++j];
						var y = src_commands[++j];
						var b = src_commands[++j];

						dst_commands.push(isNaN(x) ? 0 : x);
						dst_commands.push(isNaN(y) ? 0 : y);
						dst_commands.push(b ? find_name(bones, b, def) : def);
					}
				}
			}
		}
	}

	for (var i = 0; i < nslots; i++)
	{
		var sname = slots[i].name;
		var slen = sname.length;

		for (var j = 0; j < nattachments; j++)
		{
			var aname = attachments[j].name;
			var alen = aname.length;

			if (aname.lastIndexOf(sname, alen - slen) !== -1)
			{
				slots[i].attachment = aname.substr(aname.lastIndexOf(".") + 1);
				break;
			}
		}
	}

	data.skins = {"default": attachments};
	delete data.attachments;

	return data;
}

function find_name(list, name, def)
{
	var result = def;
	var macthes = 0;
	var len = name.length;

	for (var i = 0, n = list.length; i < n; i++)
	{
		var item_name = list[i].name;
		var full_name = "skeleton." + item_name;

		if (full_name.indexOf(name, full_name.length - len) !== -1)
		{
			macthes++;
			result = item_name;
		}
	}

	return macthes > 1 ? def : result;
}

function parse_bone(bones, tokens)
{
	var name = tokens[0];

	if (/(?:^|\.)skeleton(?:$|\.)/.test(name))
		return null;

	for (var i = 0, n = bones.length; i < n; i++)
	{
		if (bones[i].name === name)
			return null;
	}

	var bone = { name: name };

	for (var i = 1, n = tokens.length; i < n; i++)
	{
		var tok = tokens[i];

		switch (tok)
		{
			case "no-rot":   bone.inhrot   = false; break;
			case "no-scale": bone.inhscale = false; break;
			case "flip-x":   bone.flipx    = true;  break;
			case "flip-y":   bone.flipy    = true;  break;

			default:
			{
				if (/^[xyrijl]-?\d+($|\.\d+$)/.test(tok))
				{
					var value = parseFloat(tok.substr(1));

					if (!isNaN(value))
					{
						var first = tok.charAt(0);

						switch (first)
						{
							case 'x': bone.x      = value; break;
							case 'y': bone.y      = value; break;
							case 'r': bone.rot    = value; break;
							case 'i': bone.sx     = value; break;
							case 'j': bone.sy     = value; break;
							case 'l': bone.length = value; break;
						}
					}
				}
				else if (/^#([\da-fA-F]{3}|[\da-fA-F]{6})(,\d+(\.\d+)?)?$/.test(tok))
					bone.color = parse_color(tok);
			}
			break;
		}
	}

	return bone;
}

function parse_slot(slots, bone, tokens)
{
	var name = tokens[0];

	if (name.charAt(name.length - 1) === "]")
		name = name.substr(0, name.indexOf("["));

	if (name === "@skeleton")
		return null;

	if (name === "@")
		name = "@" + bone.name.split(".").pop();

	name = bone.name + "." + name.substr(1);

	var slot = null;

	for (var i = 0, n = slots.length; i < n; i++)
	{
		if (slots[i].name === name)
		{
			slot = slots[i];
			break;
		}
	}

	var result = null;

	if (slot === null)
		slot = result = {name: name};

	for (var i = 1, n = tokens.length; i < n; i++)
	{
		var tok = tokens[i];

		if (tok.charAt(0) === ":")
			break;

		if (/^#([\da-fA-F]{3}|[\da-fA-F]{6})(,\d+(\.\d+)?)?$/.test(tok))
			slot.color = parse_color(tok);
	}

	return result;
}

function parse_attachment(attachments, bone, tokens)
{
	var name = tokens[0];
	var i = name.indexOf("[");

	var slot_name;
	var atth_name;

	if (i >= 0)
	{
		slot_name = name.substring(1, i);
		atth_name = name.substring(i + 1, name.length - 1);
	}
	else
	{
		slot_name = name.substr(1);
		atth_name = slot_name;
	}

	if (slot_name === "skeleton" || atth_name === "skeleton")
		return null;

	if (slot_name.length === 0)
		slot_name = bone.name.split(".").pop();

	if (atth_name.length === 0)
		atth_name = slot_name;

	name = bone.name + "." + slot_name + "." + atth_name;

	for (var i = 0, n = attachments.length; i < n; i++)
	{
		if (attachments[i].name === name)
			return null;
	}

	var attachment = {name: name, type: "none"};
	var ntokens = tokens.length;
	var start = -1;

	for (var i = 1; i < ntokens; i++)
	{
		if (tokens[i].charAt(0) === ":")
		{
			start = i + 1;
			attachment.type = tokens[i].substr(1);
			break;
		}
	}

	if (start < 0 || start === ntokens)
		return attachment;

	var is_sprite = attachment.type === "sprite";
	var is_rect = attachment.type === "rect";
	var is_circle = attachment.type === "circle";
	var is_ellipse = attachment.type === "ellipse";
	var is_path = attachment.type === "path";
	var is_shape = is_rect || is_circle || is_ellipse || is_path;

	for (var i = start; i < ntokens; i++)
	{
		var tok = tokens[i];
		var ch = tok.charAt(0);

		if (ch === '"')
		{
			if (is_sprite && tok.charAt(tok.length - 1) === '"')
				attachment.image = tok.substring(1, tok.length - 1);
		}
		else if (/^[wh]-?\d+(\.\d+)?$/.test(tok))
		{
			if (is_sprite || is_rect || is_ellipse)
			{
				var value = parseFloat(tok.substr(1));

				if (!isNaN(value))
				{
					var is_width = ch === "w";

					if (is_ellipse)
					{
						value /= 2;

						if (is_width)
							attachment.rx = value;
						else
							attachment.ry = value;
					}
					else
					{
						if (is_width)
							attachment.width = value;
						else
							attachment.height = value;
					}
				}
			}
		}
		else if (/^[xyrij]-?\d+(\.\d+)?$/.test(tok))
		{
			var value = parseFloat(tok.substr(1));

			if (!isNaN(value))
			{
				switch (ch)
				{
					case 'x': attachment.x   = value; break;
					case 'y': attachment.y   = value; break;
					case 'r': attachment.rot = value; break;
					case 'i': attachment.sx  = value; break;
					case 'j': attachment.sy  = value; break;
				}
			}
		}
		else if (is_shape)
		{
			if (/^(miter|bevel|round)-join$/.test(tok))
			{
				attachment.line_join = tok.split("-")[0];
			}
			else if (/^(square|butt|round)-cap$/.test(tok))
			{
				attachment.line_cap = tok.split("-")[0];
			}
			else if (/^[fs]#([\da-fA-F]{3}|[\da-fA-F]{6})(,\d+(\.\d+)?)?$/.test(tok))
			{
				if (ch === "f")
					attachment.fill_color = parse_color(tok.substr(1));
				else
					attachment.line_color = parse_color(tok.substr(1));
			}
			else if (/^[tm]\d+(\.\d+)?$/.test(tok))
			{
				var value = parseFloat(tok.substr(1));

				if (!isNaN(value))
				{
					if (ch === "t")
						attachment.line_width = parseFloat(value);
					else
						attachment.miter_limit = parseFloat(value);
				}
			}
			else if (is_circle && /^d\d+(\.\d+)?$/.test(tok))
			{
				var value = parseFloat(tok.substr(1));

				if (!isNaN(value))
					attachment.radius = value / 2;
			}
		}
	}

	if (is_path)
		attachment.commands = [];

	return attachment;
}

function parse_path_command(tokens)
{
	var ch = tokens[0].charAt(0);
	var re = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?::([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*))?$/;

	var m1 = null;
	var m2 = null;
	var m3 = null;

	var tk = tokens;
	var n = tk.length;

	switch (ch)
	{
		case "M":
		case "L":
			if (n >= 2 && (m1 = tk[1].match(re)))
				return [ch,
					m1[1], m1[2], m1[3] || null
				];
			break;

		case "Q":
			if (n >= 3 && (m1 = tk[1].match(re)) && (m2 = tk[2].match(re)))
				return [ch,
					m1[1], m1[2], m1[3] || null,
					m2[1], m2[2], m2[3] || null
				];
			break;

		case "B":
			if (n >= 3 && (m1 = tk[1].match(re)) && (m2 = tk[2].match(re)) && (m3 = tk[3].match(re)))
				return [ch,
					m1[1], m1[2], m1[3] || null,
					m2[1], m2[2], m2[3] || null,
					m3[1], m3[2], m3[3] || null
				];
			break;

		case "C":
			return [ch];

		case ":":
			if (n >= 2 && /^[a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*$/.test(tk[1]))
				return [ch, tk[1]];
	}

	return null;
}

function parse_color(str)
{
	var tokens = str.split(",");
	var result = tokens[0].substr(1);

	if (result.length === 3)
	{
		var r = result.charAt(0);
		var g = result.charAt(1);
		var b = result.charAt(2);

		result = r + r + g + g + b + b;
	}

	var alpha = tokens.length === 2 ? parseFloat(tokens[1]) : 1;
	alpha = Math.min(255 * (isNaN(alpha) ? 1 : alpha), 255)|0;

	result += alpha < 16 ? "0" + alpha.toString(16) : alpha.toString(16);

	return result.toLowerCase();
}

}(this));
