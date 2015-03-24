(function(exports) {

exports.sk2app = exports.sk2app || {};
exports.sk2app.Viewport = Viewport;

var matrix = mat3();

function Viewport(app)
{
	this.app = app;
	this.dom = this.create_dom();

	this.x = 0;
	this.y = 0;
	this.width = 0;
	this.height = 0;

	this.animation_name = null;
	this.skin_name = "default";

	this.animation = null;
	this.skin = 0;
	this.time = 0;
	this.scale = 1;
	this.translation_x = 0;
	this.translation_y = 0;
	this.bones_visible = true;
	this.label_visible = true;

	this.bind_events();
	this.show_bones(true);
	this.show_label(true);
	this.set_animation(null);
}

Viewport.prototype.create_dom = function()
{
	var elements = {
		root: document.createElement("div"),
		options: document.createElement("div"),
		anim_option: document.createElement("div"),
		skin_option: document.createElement("div"),
		view_option: document.createElement("div"),
		anim_menu: document.createElement("div"),
		skin_menu: document.createElement("div"),
		view_menu: document.createElement("div"),
		show_bones_option: document.createElement("div"),
		show_label_option: document.createElement("div"),
		zoom_to_fit_option: document.createElement("div"),
		label: document.createElement("div"),
		zoom_slider: ui.Slider()
	};

	elements.root.classList.add("sk2-viewport");
	elements.options.classList.add("sk2-options");
	elements.anim_option.classList.add("sk2-option");
	elements.skin_option.classList.add("sk2-option");
	elements.view_option.classList.add("sk2-option");
	elements.anim_menu.classList.add("sk2-option-menu");
	elements.skin_menu.classList.add("sk2-option-menu");
	elements.view_menu.classList.add("sk2-option-menu");
	elements.zoom_slider.classList.add("sk2-zoom");
	elements.label.classList.add("sk2-label");

	elements.root.appendChild(elements.zoom_slider);
	elements.root.appendChild(elements.options);
	elements.root.appendChild(elements.label);

	elements.options.appendChild(elements.anim_option);
	elements.options.appendChild(elements.skin_option);
	elements.options.appendChild(elements.view_option);

	elements.anim_option.appendChild(elements.anim_menu);
	elements.anim_option.appendChild(document.createTextNode("animation"));
	elements.skin_option.appendChild(elements.skin_menu);
	elements.skin_option.appendChild(document.createTextNode("skin"));
	elements.view_option.appendChild(elements.view_menu);
	elements.view_option.appendChild(document.createTextNode("view"));

	elements.view_menu.appendChild(elements.show_bones_option);
	elements.view_menu.appendChild(elements.show_label_option);
	elements.view_menu.appendChild(elements.zoom_to_fit_option);

	elements.zoom_to_fit_option.textContent = "zoom to fit";

	return elements;
}

Viewport.prototype.bind_events = function()
{
	this.dom.root.addEventListener("mousedown", this.on_mousedown.bind(this));
	this.dom.root.addEventListener("dblclick", this.on_double_click.bind(this));
	this.dom.zoom_slider.addEventListener("change", this.on_zoom_change.bind(this));
	this.dom.options.addEventListener("mousedown", this.on_options_mousedown.bind(this));
}

Viewport.prototype.on_attached = function()
{
	// this shit is done because menu border gets bugged on certain non-integer positions

	var options = this.dom.options;
	var option = options.firstChild;

	options.classList.add("active");

	while (option)
	{
		option.style.width = Math.ceil(option.offsetWidth) + "px";
		option = option.nextSibling;
	}

	options.classList.remove("active");
}

Viewport.prototype.on_skeleton_update = function()
{
	var anim_menu = this.dom.anim_menu;
	var skin_menu = this.dom.skin_menu;
	var skins = this.app.skeleton.skins;
	var animations = this.app.skeleton_data.animations;

	while (anim_menu.firstChild)
		anim_menu.removeChild(anim_menu.firstChild);

	while (skin_menu.firstChild)
		skin_menu.removeChild(skin_menu.firstChild);

	anim_menu.appendChild(document.createElement("div"));
	skin_menu.appendChild(document.createElement("div"));

	anim_menu.firstChild.textContent = "none";
	skin_menu.firstChild.textContent = "default";

	for (var i = 0, n = animations.length; i < n; i++)
	{
		anim_menu.appendChild(document.createElement("div"));
		anim_menu.lastChild.textContent = animations[i].name;
	}

	for (var i = 1, n = skins.length; i < n; i++)
	{
		skin_menu.appendChild(document.createElement("div"));
		skin_menu.lastChild.textContent = skins[i].name;
	}
}

Viewport.prototype.on_menu_option_click = function(menu, option, all_viewports)
{
	var dom = this.dom;

	var func = null;
	var args = [];

	switch (menu)
	{
		case dom.anim_menu:
			func = this.set_animation;
			args.push(option === menu.firstChild ? null : option.textContent);
			break;

		case dom.skin_menu:
			func = this.set_skin;
			args.push(option.textContent);
			break;

		case dom.view_menu:
		{
			switch (option)
			{
				case dom.show_bones_option:
					func = this.show_bones;
					args.push(!this.bones_visible);
					break;

				case dom.show_label_option:
					func = this.show_label;
					args.push(!this.label_visible);
					break;

				case dom.zoom_to_fit_option:
					func = this.zoom_to_fit;
					break;
			}
		}
		break;
	}

	if (func)
	{
		if (all_viewports)
			this.app.viewports.forEach(function(viewport) { func.apply(viewport, args); });
		else
			func.apply(this, args);
	}
}

Viewport.prototype.on_options_mousedown = function(event)
{
	var options = this.dom.options;
	var option = event.target;

	// click on an expanded menu option

	if (option.parentNode.classList.contains("sk2-option-menu"))
	{
		event.preventDefault();
		event.stopPropagation();
		this.on_menu_option_click(option.parentNode, option, event.shiftKey);
		return;
	}

	if (!option.classList.contains("sk2-option"))
		return;

	// click on a viewport option

	event.preventDefault();
	event.stopPropagation();

	function on_mousedown(event)
	{
		if (event.target === option.firstChild)
			return;

		if (event.target !== option)
		{
			options.classList.remove("active");
			option.classList.remove("active");
		}

		window.removeEventListener("mousedown", on_mousedown, true);
		options.removeEventListener("mouseover", on_mouseover);
	}

	function on_mouseover(event)
	{
		if (event.target !== option && event.target.classList.contains("sk2-option"))
		{
			option.classList.remove("active");
			option = event.target;
			option.classList.add("active");
		}
	}

	var menu = option.firstChild;

	if (option.classList.contains("active"))
	{
		options.classList.remove("active");
		option.classList.remove("active");
	}
	else if (menu && menu.classList.contains("sk2-option-menu") && menu.childNodes.length > 0)
	{
		options.classList.add("active");
		option.classList.add("active");
		window.addEventListener("mousedown", on_mousedown, true);
		options.addEventListener("mouseover", on_mouseover);
	}
}

Viewport.prototype.on_mousedown = function(event)
{
	event.preventDefault();

	if (event.button !== 0)
		return;

	var self = this;
	var x = event.clientX;
	var y = event.clientY;

	function on_mousemove(event)
	{
		var dx = (event.clientX - x);
		var dy = (y - event.clientY);

		x = event.clientX;
		y = event.clientY;

		self.translation_x += dx / self.scale;
		self.translation_y += dy / self.scale;
		self.app.invalidate();
	}

	function on_mouseup()
	{
		window.removeEventListener("mouseup", on_mouseup);
		window.removeEventListener("mousemove", on_mousemove);
	}

	window.addEventListener("mouseup", on_mouseup);
	window.addEventListener("mousemove", on_mousemove);
}

Viewport.prototype.on_double_click = function(event)
{
	if (event.target !== this.dom.root)
		return;

	event.preventDefault();
	event.stopPropagation();

	if (event.shiftKey)
		this.app.viewports.forEach(function(viewport) { viewport.zoom_to_fit(); });
	else
		this.zoom_to_fit();
}

Viewport.prototype.on_zoom_change = function(event)
{
	var value = this.dom.zoom_slider.value;

	if (event.detail.shiftKey)
	{
		var viewports = this.app.viewports;

		for (var i = 0, n = viewports.length; i < n; i++)
			if (viewports[i] !== this)
				viewports[i].dom.zoom_slider.value = value;
	}

	this.scale = value >= 0.5 ? 6 * (value - 0.5) + 1 : 1 / (6 * (0.5 - value) + 1);
	this.app.invalidate();
}

Viewport.prototype.show_bones = function(visible)
{
	this.bones_visible = visible;
	this.dom.show_bones_option.textContent = visible ? "hide bones" : "show bones";
	this.app.invalidate();
}

Viewport.prototype.show_label = function(visible)
{
	this.label_visible = visible;
	this.dom.root.classList[visible ? "remove" : "add"]("no-labels");
	this.dom.show_label_option.textContent = visible ? "hide label" : "show label";
}

Viewport.prototype.set_skin = function(name)
{
	this.skin = this.app.get_skin(name);
	this.skin_name = name;
	this.app.invalidate();
}

Viewport.prototype.set_animation = function(name)
{
	var animation = name !== null ? this.app.get_animation(name) : null;

	if (name !== this.animation_name)
		this.time = 0;

	if (animation && !this.animation)
		this.app.on_animation_start();
	else if (this.animation && !animation)
		this.app.on_animation_stop();

	this.animation = animation;
	this.animation_name = name;
	this.app.invalidate();

	this.dom.label.textContent = name !== null ? name : "skeleton setup";
}

Viewport.prototype.on_resize = function()
{
	var root = this.dom.root;

	this.width = root.offsetWidth;
	this.height = root.offsetHeight;
	this.x = root.offsetLeft;
	this.y = this.app.dom.canvas.offsetHeight - (root.offsetTop + this.height);
}

Viewport.prototype.zoom_to_fit = function()
{
	var renderer = this.app.renderer;
	var skeleton = this.app.skeleton;

	skeleton.reset();
	skeleton.update_transform();

	renderer.show_bones = true;
	renderer.dont_draw = true;
	renderer.draw(skeleton, 0, 0, 1, this.skin);
	renderer.dont_draw = false;

	this.dom.zoom_slider.value = 0.5;
	this.translation_x = 0;
	this.translation_y = 0;
	this.app.invalidate();

	if (renderer.vbo.size === 0)
		return;

	var vbo = renderer.vbo;
	var buffer = vbo.f32;
	var stride = vbo.vertex_size / buffer.BYTES_PER_ELEMENT;

	var x0 = buffer[0]; var y0 = buffer[1];
	var x1 = buffer[0]; var y1 = buffer[1];

	for (var i = stride, n = vbo.size * stride; i < n; i += stride)
	{
		var x = buffer[i + 0];
		var y = buffer[i + 1];

		x0 = Math.min(x0, x);
		y0 = Math.min(y0, y);
		x1 = Math.max(x1, x);
		y1 = Math.max(y1, y);
	}

	if (x0 === x1 || y0 === y1)
		return;

	var w = x1 - x0;
	var h = y1 - y0;
	var W = this.width;
	var H = this.height;
	var zoom = 1;

	if (w / h > W / H)
		zoom = 0.8 * (W / w);
	else
		zoom = 0.8 * (H / h);

	this.set_scale(zoom);
	this.set_translation(-(x0 + 0.5 * w), -(y0 + 0.5 * h));
}

Viewport.prototype.set_scale = function(scale)
{
	var zoom = scale = scale >= 1 ? 0.5 + (scale - 1) / 6 : 0.5 - ((1 / scale) - 1) / 6;
	this.dom.zoom_slider.value = Math.max(0, Math.min(1, zoom));
	this.app.invalidate();
}

Viewport.prototype.set_translation = function(x, y)
{
	this.translation_x = x;
	this.translation_y = y;
	this.app.invalidate();
}

Viewport.prototype.draw = function(dt)
{
	var gfx = this.app.gfx;
	var renderer = this.app.renderer;
	var skeleton = this.app.skeleton;
	var animation = this.animation;

	var x = this.x;
	var y = this.y;
	var w = this.width;
	var h = this.height;
	var dx = this.translation_x;
	var dy = this.translation_y;

	gfx.viewport(x, y, w, h);
	gfx.scissor(x, y, w, h);
	gfx.projection(mat3ortho(0, w, 0, h, matrix));
	gfx.clear();

	// TODO: draw grid

	if (skeleton)
	{
		skeleton.reset();

		if (animation)
		{
			if (animation.duration > 0)
			{
				var t0 = this.time;
				var t1 = (t0 + dt) % animation.duration;

				animation.apply(skeleton, 0, t1, 1);

				this.time = t1;
			}
			else
				animation.apply(skeleton, 0, 0, 1);
		}

		skeleton.update_transform();

		var s = this.scale;

		renderer.show_bones = this.bones_visible;
		renderer.draw(skeleton, 0.5 * w / s + dx, 0.5 * h / s + dy, s, this.skin);
	}
}

}(this));
