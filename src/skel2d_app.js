(function(exports) {

exports.Skel2dApp = Application;

var matrix = mat3();

function prevent_default(event)
{
	event.preventDefault();
}

function find(list, name)
{
	for (var i = 0, n = list.length; i < n; i++)
		if (list[i].name === name)
			return i;

	return -1;
}

function load_gist(id, filename, on_load)
{
	var script = document.createElement("script");

	window["gist_callback"] = function(data)
	{
		delete window["gist_callback"];
		script.parentNode.removeChild(script);

		if (filename in data.data.files)
			on_load(data.data.files[filename].content);
	};

	script.setAttribute("src", "//api.github.com/gists/" + id + "?callback=gist_callback");
	document.body.appendChild(script);
}

// --- Application ---

function Application(root)
{
	this.dom = this.create_dom(root);
	this.editor = this.create_editor();
	this.viewports = [];
	this.gfx = gfx_create_context(this.dom.canvas);
	this.renderer = new SkeletonRenderer(this.gfx);
	this.skeleton_data = null;
	this.skeleton = null;

	this.time = 0;
	this.invalidated = false;
	this.frame_callback = this.draw.bind(this);
	this.playing_count = 0;

	this.gutter_size = this.editor.renderer.gutterWidth;
	this.update_timer = null;
	this.update_trigger = this.update.bind(this);

	this.set_viewports(2, 2);
	this.bind_events();

	this.gfx.clear_color(1, 1, 1, 1);
	this.gfx.scissor_enable(true);

	this.set_editor_size(82);
	this.load();
	this.editor.focus();
}

Application.prototype.create_dom = function(root)
{
	var x, elements = {
		root: root,
		left_panel: ((x = document.createElement("div")),    x.classList.add("sk2-left-panel"), x),
		topbar:     ((x = document.createElement("div")),    x.classList.add("sk2-topbar"),     x),
		ace:        ((x = document.createElement("div")),    x.classList.add("sk2-ace"),        x),
		view_panel: ((x = document.createElement("div")),    x.classList.add("sk2-view-panel"), x),
		overlay:    ((x = document.createElement("div")),    x.classList.add("sk2-overlay"),    x),
		canvas:     ((x = document.createElement("canvas")), x.classList.add("sk2-canvas"),     x)
	};

	root.classList.add("sk2-app");
	root.appendChild(elements.left_panel);
	root.appendChild(elements.view_panel);

	elements.left_panel.appendChild(elements.topbar);
	elements.left_panel.appendChild(elements.ace);

	elements.view_panel.appendChild(elements.canvas);
	elements.view_panel.appendChild(elements.overlay);

	return elements;
}

Application.prototype.load = function()
{
	if (window.location.hash.length > 1)
	{
		this.load_gist();
	}
	else
	{
		var code = localStorage.getItem("testcode") || "";

		if (code.length > 0)
		{
			this.editor.setValue(code);
			this.editor.clearSelection();
			this.on_load();
		}
	}
}

Application.prototype.load_gist = function()
{
	var hash = window.location.hash;

	if (hash.length > 1)
	{
		var info = hash.substr(1).split(",");

		if (info.length === 2)
		{
			load_gist(info[0], info[1], function(code)
			{
				if (code.length > 0)
				{
					this.editor.setValue(code);
					this.editor.clearSelection();
					this.on_load();
				}
			}.bind(this));
		}

		location.hash = "";
	}
}

Application.prototype.on_load = function()
{
	if (this.update_timer !== null)
	{
		clearTimeout(this.update_timer);
		this.update_timer = null;
	}

	this.update();

	var animations = this.skeleton_data.animations;
	var viewports = this.viewports;

	for (var i = 0, n = viewports.length; i < n; i++)
	{
		viewports[i].set_skin("default");
		viewports[i].set_animation(null);
	}

	var n = Math.min(animations.length, viewports.length - 1);

	for (var i = 0; i < n; i++)
		viewports[i + 1].set_animation(animations[i].name);
}

Application.prototype.create_editor = function()
{
	var editor = ace.edit(this.dom.ace);
	var Range = require("ace/range").Range;

	editor.renderer.$updateScrollBarV = function()
	{
		this.scrollBarV.setScrollHeight(this.layerConfig.maxHeight + this.scrollMargin.v);
		this.scrollBarV.setScrollTop(this.scrollTop + this.scrollMargin.top);
	};

	editor.$updateHighlightActiveLine = function()
	{
		var sess = this.getSession();
		var highlight;

		if (this.$highlightActiveLine) {
			if ((this.$selectionStyle != "line" || this.selection.isEmpty()))
				highlight = this.getCursorPosition();
			if (this.renderer.$maxLines && sess.getLength() === 1 && !(this.renderer.$minLines > 1))
				highlight = false;
		}

		if (sess.$highlightLineMarker && !highlight) {
			sess.removeMarker(sess.$highlightLineMarker.id);
			sess.$highlightLineMarker = null;
		} else if (!sess.$highlightLineMarker && highlight) {
			var range = new Range(highlight.row, highlight.column, highlight.row, Infinity);
			range.id = sess.addMarker(range, "ace_active-line", "screenLine");
			sess.$highlightLineMarker = range;
		} else if (highlight) {
			sess.$highlightLineMarker.start.row = highlight.row;
			sess.$highlightLineMarker.end.row = highlight.row;
			sess.$highlightLineMarker.start.column = highlight.column;
			sess._signal("changeBackMarker");
		}
	};

	editor.$blockScrolling = Infinity;
	editor.session.setTabSize(2);
	editor.session.setUseSoftTabs(false);
	editor.session.setMode(new (require("ace/mode/skel2d").Mode)());
	editor.setOption("showPrintMargin", false);
	editor.setOption("fixedWidthGutter", true);
	editor.setOption("displayIndentGuides", false);
	editor.setOption("scrollPastEnd", 1);
	editor.setOption("dragEnabled", false);
	editor.setOption("vScrollBarAlwaysVisible", true);

	var commands_remove = [
		"showSettingsMenu", "goToNextError", "goToPreviousError", "centerselection",
		"gotoline", "fold", "unfold", "toggleFoldWidget", "toggleParentFoldWidget",
		"foldall", "foldOther", "unfoldall", "findnext", "findprevious",
		"selectOrFindNext", "selectOrFindPrevious", "find", "togglerecording",
		"replaymacro", "jumptomatching", "selecttomatching", "expandToMatching",
		"sortlines", "togglecomment", "toggleBlockComment", "modifyNumberUp",
		"modifyNumberDown", "replace", "copylinesup", "copylinesdown",
		"splitline", "transposeletters", "expandtoline", "selectMoreBefore",
		"selectNextBefore", "selectMoreAfter"
	];

	var commands_remap = [
		"removeline", "movelinesup", "movelinesdown", "joinlines", "splitIntoLines",
		"findAll", "selectNextAfter"
	];

	for (var i = 0, n = commands_remove.length; i < n; i++)
		editor.commands.removeCommand(commands_remove[i]);

	for (var i = 0, n = commands_remap.length; i < n; i++)
		editor.commands.removeCommand(commands_remap[i], true);

	editor.commands.addCommand({
		name: "selectMoreAfter",
		exec: function(editor) { editor.selectMore(1, false, true); },
		scrollIntoView: "cursor",
		readonly: true
	});

	editor.commands.bindKey("ctrl+shift+k",     editor.commands.commands["removeline"]);
	editor.commands.bindKey("ctrl+shift+up",    editor.commands.commands["movelinesup"]);
	editor.commands.bindKey("ctrl+shift+down",  editor.commands.commands["movelinesdown"]);
	editor.commands.bindKey("ctrl+j",           editor.commands.commands["joinlines"]);
	editor.commands.bindKey("ctrl+shift+l",     editor.commands.commands["splitIntoLines"]);
	editor.commands.bindKey("alt+f3",           editor.commands.commands["findAll"]);
	editor.commands.bindKey("ctrl+d",           editor.commands.commands["selectMoreAfter"]);
	editor.commands.bindKey("ctrl+k",           editor.commands.commands["selectNextAfter"]);

	return editor;
}

Application.prototype.set_viewports = function(cols, rows)
{
	var n = cols * rows;
	var overlay = this.dom.overlay;
	var viewports = this.viewports;

	while (viewports.length > n)
		viewports.pop();

	while (viewports.length < n)
		viewports.push(new Viewport(this));

	while (overlay.firstChild)
		overlay.removeChild(overlay.firstChild);

	for (var i = 0; i < rows; i++)
	{
		var row = document.createElement("div");
		row.classList.add("sk2-view-row");

		for (var j = 0; j < cols; j++)
			row.appendChild(viewports[i * cols + j].dom.root);

		overlay.appendChild(row);
	}

	this.on_resize();
}

Application.prototype.bind_events = function()
{
	var editor = this.editor;

	window.addEventListener("resize", this.on_resize.bind(this));
	window.addEventListener("beforeunload", this.on_beforeunload.bind(this));
	window.addEventListener("hashchange", this.load_gist.bind(this));
	editor.addEventListener("change", this.on_editor_change.bind(this));
	editor.renderer.addEventListener("resize", this.on_editor_resize.bind(this));
}

Application.prototype.set_editor_size = function(n)
{
	var x, r = this.editor.renderer;

	r.updateFull(true);
	x = Math.round(r.characterWidth * n + r.$padding + r.gutterWidth + r.scrollBarV.width);

	this.dom.left_panel.style.width = x + "px";
	this.editor.resize();
	this.on_resize();
}

Application.prototype.on_editor_resize = function()
{
	var gutter_width = this.editor.renderer.gutterWidth;

	if (gutter_width !== this.gutter_width)
	{
		this.set_editor_size(82);
		this.gutter_width = gutter_width;
	}
}

Application.prototype.on_editor_change = function()
{
	if (this.update_timer !== null)
		clearTimeout(this.update_timer);

	this.update_timer = setTimeout(this.update_trigger, 1000);
}

Application.prototype.on_beforeunload = function()
{
	var code = this.editor.getValue();

	if (/\S/.test(code))
		localStorage.setItem("testcode", this.editor.getValue());
}

Application.prototype.on_resize = function()
{
	this.dom.canvas.width = this.dom.canvas.offsetWidth;
	this.dom.canvas.height = this.dom.canvas.offsetHeight;

	var viewports = this.viewports;

	for (var i = 0, n = viewports.length; i < n; i++)
		viewports[i].on_resize();

	this.invalidate();
}

Application.prototype.on_animation_start = function()
{
	this.playing_count++;
	this.invalidate();

	if (this.playing_count === 1)
		this.time = performance.now() / 1000;
}

Application.prototype.on_animation_stop = function()
{
	this.playing_count--;
}

Application.prototype.get_animation = function(name)
{
	if (this.skeleton_data === null || this.skeleton === null)
		return null;

	var animations = this.skeleton_data.animations;
	var i = find(animations, name);

	if (i >= 0)
	{
		if (!animations[i].animation)
			animations[i].animation = new sk2.Animation(this.skeleton, animations[i]);

		return animations[i].animation;
	}

	return null;
}

Application.prototype.update = function()
{
	this.update_timer = null;
	this.skeleton_data = skel2d_parse(this.editor.getValue());
	this.skeleton = new sk2.Skeleton(this.skeleton_data.skeleton);

	for (var i = 0, n = this.viewports.length; i < n; i++)
	{
		var viewport = this.viewports[i];

		viewport.set_animation(viewport.animation_name);
		viewport.set_skin(viewport.skin_name);
		viewport.on_skeleton_update();
	}

	this.invalidate();
}

Application.prototype.invalidate = function()
{
	if (!this.invalidated)
	{
		this.invalidated = true;
		requestAnimationFrame(this.frame_callback);
	}
}

Application.prototype.draw = function()
{
	var time = performance.now() / 1000;
	var dt = time - this.time;

	var viewports = this.viewports;

	for (var i = 0, n = viewports.length; i < n; i++)
		viewports[i].draw(dt);

	this.gfx.gl.finish();

	if (this.playing_count > 0)
		requestAnimationFrame(this.frame_callback);
	else
		this.invalidated = false;

	this.time = time;
}

// --- Viewport ---

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
		label: document.createElement("div"),
		zoom_slider: Slider()
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
	elements.options.appendChild(document.createTextNode(" "));
	elements.options.appendChild(elements.skin_option);
	elements.options.appendChild(document.createTextNode(" "));
	elements.options.appendChild(elements.view_option);

	elements.anim_option.appendChild(elements.anim_menu);
	elements.anim_option.appendChild(document.createTextNode("animation"));
	elements.skin_option.appendChild(elements.skin_menu);
	elements.skin_option.appendChild(document.createTextNode("skin"));
	elements.view_option.appendChild(elements.view_menu);
	elements.view_option.appendChild(document.createTextNode("view"));

	elements.view_menu.appendChild(elements.show_bones_option);
	elements.view_menu.appendChild(elements.show_label_option);

	return elements;
}

Viewport.prototype.bind_events = function()
{
	this.dom.root.addEventListener("mousedown", this.on_mousedown.bind(this));
	this.dom.root.addEventListener("dblclick", this.on_double_click.bind(this));
	this.dom.zoom_slider.addEventListener("change", this.on_zoom_change.bind(this));
	this.dom.options.addEventListener("mousedown", this.on_options_mousedown.bind(this));
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

Viewport.prototype.on_options_mousedown = function(event)
{
	var options = this.dom.options;
	var option = event.target;

	// click on an expanded menu option

	if (option.parentNode.classList.contains("sk2-option-menu"))
	{
		var menu = option.parentNode;

		switch (menu)
		{
			case this.dom.anim_menu:
				this.set_animation(option === menu.firstChild ? null : option.textContent);
				break;

			case this.dom.skin_menu:
				this.set_skin(option.textContent);
				break;

			case this.dom.view_menu:
				option === this.dom.show_bones_option && this.show_bones(!this.bones_visible);
				option === this.dom.show_label_option && this.show_label(!this.label_visible);
				break;
		}

		event.preventDefault();
		event.stopPropagation();

		return;
	}

	if (!option.classList.contains("sk2-option"))
		return;

	// click on a viewport option

	event.preventDefault();
	event.stopPropagation();

	function on_mousedown(event)
	{
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

		self.translation_x += dx;
		self.translation_y += dy;
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

	if (this.scale !== 1)
		this.dom.zoom_slider.value = 0.5;
	else
		this.translation_x = this.translation_y = 0;

	this.app.invalidate();
}

Viewport.prototype.on_zoom_change = function()
{
	var zoom = this.dom.zoom_slider.value;

	zoom = zoom >= 0.5 ? 6 * (zoom - 0.5) + 1 : 1 / (6 * (0.5 - zoom) + 1);

	this.scale = zoom;
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
	var skin = 0;

	if (this.app.skeleton !== null)
		skin = find(this.app.skeleton.skins, name);

	this.skin = skin === -1 ? 0 : skin;
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

		renderer.show_bones = this.bones_visible;
		renderer.draw(skeleton, w / 2 + dx, h / 2 + dy, this.scale, this.skin);
	}
}

// --- Slider ---

function Slider()
{
	var slider = document.createElement("div");
	var handle = document.createElement("div");
	var offset = 0;

	function calc_offset(e)
	{
		if (e.target === slider)
			return 0;

		var bounds = handle.getBoundingClientRect();
		return e.clientY - Math.floor(bounds.top + (bounds.bottom - bounds.top) * 0.5);
	}

	function on_change()
	{
		slider.dispatchEvent(new Event("change"));
	}

	function update(mousey)
	{
		var val = handle.style.top;
		var bounds = slider.getBoundingClientRect();
		var y = Math.max(bounds.top, Math.min(bounds.bottom, mousey - offset));

		handle.style.top = 100 * (y - bounds.top) / (bounds.bottom - bounds.top) + "%";

		if (handle.style.top !== val)
			on_change();
	}

	function on_mousemove(e)
	{
		update(e.clientY);
	}

	function on_mouseup()
	{
		slider.classList.remove("active");
		window.removeEventListener("mouseup", on_mouseup);
		window.removeEventListener("mousemove", on_mousemove);
	}

	function on_mousedown(e)
	{
		if (e.button !== 0)
			return;

		slider.classList.add("active");

		window.addEventListener("mouseup", on_mouseup);
		window.addEventListener("mousemove", on_mousemove);

		e.preventDefault();
		e.stopPropagation();

		offset = calc_offset(e);
		update(e.clientY);
	}

	slider.classList.add("ui-slider");
	slider.appendChild(handle);
	slider.addEventListener("mousedown", on_mousedown);

	Object.defineProperty(slider, 'value', {
		get: function() {
			return 1 - parseFloat(handle.style.top) / 100;
		},
		set: function(x) {
			var val = handle.style.top;
			handle.style.top = 100 * (1 - x) + "%";

			if (handle.style.top !== val)
				on_change();
		}
	});

	return slider;
}

}(this));
