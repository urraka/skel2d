(function(exports) {

exports.sk2app = exports.sk2app || {};
exports.sk2app.Application = Application;

// --- helper functions ---

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
		viewports.push(new sk2app.Viewport(this));

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

Application.prototype.get_skin = function(name)
{
	var index = this.skeleton !== null ? find(this.skeleton.skins, name) : 0;
	return index === -1 ? 0 : index;
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

}(this));
