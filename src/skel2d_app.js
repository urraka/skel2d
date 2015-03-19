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

	this.gist_user = null;
	this.gist_document = null;
	this.is_modified = false;
	this.modified_count = 0;
	this.prevent_hashchange = false;
	this.msgbox_timer = null;

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
	this.login();
	this.load();
	this.editor.focus();
}

Application.prototype.show_message = function(text, timeout)
{
	clearTimeout(this.msgbox_timer);

	if (!text)
	{
		this.dom.msgbox.style.display = "none";
	}
	else
	{
		this.dom.msgbox.textContent = text;
		this.dom.msgbox.style.display = "block";

		if (timeout)
			this.msgbox_timer = setTimeout(this.show_message.bind(this, null), timeout);
	}
}

Application.prototype.login = function(token)
{
	if (token)
	{
		var req = new XMLHttpRequest();
		req.open("GET", "https://api.github.com/user");
		req.setRequestHeader("Accept", "application/vnd.github.v3+json");
		req.setRequestHeader("Authorization", "token " + token);

		this.show_message("Performing login...");

		req.onloadend = function()
		{
			var scopes = (req.getResponseHeader("X-OAuth-Scopes") || "").split(",");

			if (req.status === 200 && scopes.some(function(s){return s.trim() === "gist";}))
			{
				var response = JSON.parse(req.responseText);

				localStorage.setItem("sk2-gist-user", JSON.stringify({
					"token": token,
					"user_id": response.id,
					"username": response.login
				}));

				this.dom.login.classList.remove("visible");
				this.login();
				this.show_message("Logged in as " + response.login, 1000);
			}
			else
			{
				this.show_message("Login failed! (see console for more info)");

				console.log({
					status: req.status,
					headers: req.getAllResponseHeaders(),
					response: req.responseText
				});
			}
		}.bind(this);

		req.send();
	}
	else
	{
		var gist_user = localStorage.getItem("sk2-gist-user");

		if (gist_user)
		{
			this.gist_user = JSON.parse(gist_user);
			this.dom.menu_user.textContent = this.gist_user.username;
			this.dom.menu_login.textContent = "(logout)";
			this.dom.gist_token.value = this.gist_user.token;
		}
	}
}

Application.prototype.logout = function()
{
	localStorage.removeItem("sk2-gist-user");

	this.gist_user = null;
	this.dom.menu_user.textContent = "";
	this.dom.menu_login.textContent = "login";
}

Application.prototype.save_session = function()
{
	var session = {
		code: this.editor.getValue(),
		gist_document: this.gist_document,
		is_modified: this.is_modified,
		viewports: {
			cols: this.dom.overlay.firstChild.childNodes.length,
			rows: this.dom.overlay.childNodes.length,
			state: []
		}
	};

	for (var i = 0; i < this.viewports.length; i++)
	{
		var viewport = this.viewports[i];

		session.viewports.state.push({
			animation: viewport.animation_name,
			skin: viewport.skin_name,
			bones: viewport.bones_visible,
			label: viewport.label_visible,
			scale: viewport.scale,
			translation: {x: viewport.translation_x, y: viewport.translation_y}
		});
	}

	localStorage.setItem("sk2-session", JSON.stringify(session));
}

Application.prototype.clear_session = function()
{
	localStorage.removeItem("sk2-session");
}

Application.prototype.load_session = function()
{
	var session = localStorage.getItem("sk2-session");

	if (session)
	{
		var session = JSON.parse(session);

		this.gist_document = session.gist_document;

		if (this.gist_document)
		{
			this.prevent_hashchange = true;
			location.hash = this.gist_document.id;
		}

		this.editor.session.setValue(session.code);
		this.editor.clearSelection(-1);
		this.is_modified = session.is_modified;

		if (this.is_modified)
			this.dom.menu_save.classList.remove("disabled");
		else
			this.dom.menu_save.classList.add("disabled");

		this.update();

		var viewports = session.viewports;

		this.set_viewports(viewports.cols, viewports.rows);

		for (var i = 0; i < viewports.state.length; i++)
		{
			var state = viewports.state[i];
			var viewport = this.viewports[i];

			viewport.set_animation(state.animation);
			viewport.set_skin(state.skin);
			viewport.show_bones(state.bones);
			viewport.show_label(state.label);
			viewport.set_scale(state.scale);
			viewport.set_translation(state.translation.x, state.translation.y);
		}
	}
}

Application.prototype.load_gist = function(id)
{
	this.dom.menu_new.classList.add("disabled");
	this.dom.menu_save.classList.add("disabled");

	var req = new XMLHttpRequest();
	req.open("GET", "https://api.github.com/gists/" + id);
	req.setRequestHeader("Accept", "application/vnd.github.v3+json");

	if (this.gist_user)
		req.setRequestHeader("Authorization", "token " + this.gist_user.token);

	this.show_message("Loading...");

	req.onloadend = function()
	{
		this.dom.menu_new.classList.remove("disabled");

		if (this.is_modified)
			this.dom.menu_save.classList.remove("disabled");

		if (req.status === 200)
		{
			var data = JSON.parse(req.responseText);

			if (data.files && data.files[".skel2d"])
			{
				this.show_message(null);

				this.editor.session.setValue(data.files[".skel2d"].content);
				this.editor.clearSelection(-1);
				this.skeleton_data = null;
				this.skeleton = null;
				this.is_modified = false;
				this.modified_count = 0;
				this.reset_viewports();
				this.dom.menu_save.classList.add("disabled");

				this.gist_document = {
					"id": id,
					"owner_id": data.owner ? data.owner.id : 0
				};

				this.update();

				var animations = this.skeleton_data.animations;
				var viewports = this.viewports;

				for (var i = 0, n = viewports.length; i < n; i++)
				{
					viewports[i].set_skin("default");
					viewports[i].set_animation(null);
					viewports[i].zoom_to_fit();
				}

				var n = Math.min(animations.length, viewports.length - 1);

				for (var i = 0; i < n; i++)
					viewports[i + 1].set_animation(animations[i].name);
			}
			else
			{
				this.show_message("Gist does not have a .skel2d file");

				console.log({
					status: req.status,
					headers: req.getAllResponseHeaders(),
					response: req.responseText
				});
			}
		}
		else
		{
			this.show_message("Failed to load gist " + id + " (see console for more info)");

			console.log({
				status: req.status,
				headers: req.getAllResponseHeaders(),
				response: req.responseText
			});
		}
	}.bind(this);

	req.send();
}

Application.prototype.on_new = function()
{
	if (this.dom.menu_new.classList.contains("disabled"))
		return;

	this.editor.session.setValue("");
	this.skeleton_data = null;
	this.skeleton = null;
	this.is_modified = false;
	this.modified_count = 0;
	this.gist_document = null;
	this.clear_session();
	this.reset_viewports();
	this.prevent_hashchange = true;
	this.dom.menu_save.classList.add("disabled");

	location.hash = "";
}

Application.prototype.on_save = function()
{
	if (this.dom.menu_save.classList.contains("disabled"))
		return;

	this.dom.menu_new.classList.add("disabled");
	this.dom.menu_save.classList.add("disabled");

	var req = new XMLHttpRequest();
	var update_gist = false;

	if (this.gist_user && this.gist_document && this.gist_document.owner_id === this.gist_user.user_id)
		update_gist = true;

	if (update_gist)
		req.open("PATCH", "https://api.github.com/gists/" + this.gist_document.id);
	else
		req.open("POST", "https://api.github.com/gists");

	req.setRequestHeader("Accept", "application/vnd.github.v3+json");

	if (this.gist_user)
		req.setRequestHeader("Authorization", "token " + this.gist_user.token);

	var data = update_gist ?
		{"files": {".skel2d": {"content": this.editor.getValue()}}} :
		{
			"description": "Created through Skel2D https://github.com/urraka/skel2d",
			"public": this.gist_user ? false : true,
			"files": {".skel2d": {"content": this.editor.getValue()}}
		};

	var modified_count = this.modified_count;

	this.show_message("Saving...");

	req.onloadend = function()
	{
		this.dom.menu_new.classList.remove("disabled");
		this.dom.menu_save.classList.remove("disabled");

		if (req.status === 200 || req.status === 201)
		{
			var data = JSON.parse(req.responseText);

			if (this.modified_count === modified_count)
			{
				this.is_modified = false;
				this.dom.menu_save.classList.add("disabled");
			}

			if (!update_gist)
			{
				this.gist_document = {id: data.id, owner_id: data.owner ? data.owner.id : 0};
				this.prevent_hashchange = true;
				location.hash = data.id;
				history.pushState(null, "", "#" + data.id);

				if (this.gist_user)
				{
					var data = {"description": "http://urraka.github.io/skel2d/#" + this.gist_document.id};
					var req2 = new XMLHttpRequest();

					req2.open("PATCH", "https://api.github.com/gists/" + this.gist_document.id);
					req2.setRequestHeader("Accept", "application/vnd.github.v3+json");
					req2.setRequestHeader("Authorization", "token " + this.gist_user.token);
					req2.send(JSON.stringify(data));
				}
			}

			this.show_message("Saving... done!", 1000);
		}
		else
		{
			this.show_message("Failed to save gist! (see console for more info)");

			console.log({
				status: req.status,
				headers: req.getAllResponseHeaders(),
				response: req.responseText
			});
		}
	}.bind(this);

	req.send(JSON.stringify(data));
}

Application.prototype.reset_viewports = function()
{
	this.set_viewports(2, 2);

	for (var i = 0; i < this.viewports.length; i++)
	{
		var viewport = this.viewports[i];

		viewport.set_translation(0, 0);
		viewport.set_scale(1);
		viewport.set_skin("default");
		viewport.set_animation(null);
		viewport.show_bones(true);
		viewport.show_label(true);
	}
}

Application.prototype.create_dom = function(root)
{
	var e, elements = {
		root: root,
		left_panel: ((e = document.createElement("div")),    e.classList.add("sk2-left-panel"), e),
		msgbox:     ((e = document.createElement("div")),    e.classList.add("sk2-msgbox"),     e),
		topbar:     ((e = document.createElement("div")),    e.classList.add("sk2-topbar"),     e),
		ace:        ((e = document.createElement("div")),    e.classList.add("sk2-ace"),        e),
		login:      ((e = document.createElement("div")),    e.classList.add("sk2-login"),      e),
		help:       ((e = document.createElement("div")),    e.classList.add("sk2-help"),       e),
		view_panel: ((e = document.createElement("div")),    e.classList.add("sk2-view-panel"), e),
		overlay:    ((e = document.createElement("div")),    e.classList.add("sk2-overlay"),    e),
		canvas:     ((e = document.createElement("canvas")), e.classList.add("sk2-canvas"),     e),
		menu_new:   ((e = document.createElement("span")),  (e.textContent = "new"),            e),
		menu_save:  ((e = document.createElement("span")),  (e.textContent = "save"),           e),
		menu_login: ((e = document.createElement("span")),  (e.textContent = "login"),          e),
		menu_help:  ((e = document.createElement("a")),     (e.textContent = "help"),           e),
		menu_user:  ((e = document.createElement("b")), e),
		menu_right: ((e = document.createElement("div")), e)
	};

	root.classList.add("sk2-app");
	root.appendChild(elements.left_panel);
	root.appendChild(elements.view_panel);
	root.appendChild(elements.msgbox);

	elements.topbar.appendChild(elements.menu_right);
	elements.topbar.appendChild(elements.menu_new);
	elements.topbar.appendChild(elements.menu_save);
	elements.topbar.appendChild(elements.menu_help);

	elements.menu_right.appendChild(elements.menu_user);
	elements.menu_right.appendChild(elements.menu_login);

	elements.left_panel.appendChild(elements.topbar);
	elements.left_panel.appendChild(elements.login);
	elements.left_panel.appendChild(elements.ace);
	elements.left_panel.appendChild(elements.help);

	elements.view_panel.appendChild(elements.canvas);
	elements.view_panel.appendChild(elements.overlay);

	elements.menu_help.setAttribute("href", "https://github.com/urraka/skel2d");
	elements.menu_help.setAttribute("target", "_blank");

	elements.login.innerHTML = "<ol>" +
			"<li>Generate a GitHub personal access token " +
				"<a href='https://github.com/settings/tokens/new' target='_blank'>" +
					"https://github.com/settings/tokens/new</a><br/>" +
				"(<b><i>gist</i></b> is the only scope required)</li>" +
			"<li>Paste the generated access token here: <input id='sk2-gist-token' type='text' /> " +
				"<span id='sk2-gist-login'>ok</span></li>"
		"</ol>";

	elements.gist_token = document.getElementById("sk2-gist-token");
	elements.gist_login = document.getElementById("sk2-gist-login");

	elements.msgbox.setAttribute("title", "Dismiss");
	elements.menu_save.setAttribute("title", "Ctrl+S");

	return elements;
}

Application.prototype.load = function()
{
	this.dom.menu_save.classList.add("disabled");

	if (location.hash.length > 1)
	{
		var gist_id = location.hash.substr(1);

		if (this.gist_user)
		{
			var session = localStorage.getItem("sk2-session");

			if (session)
			{
				var session = JSON.parse(session);
				var gistdoc = session.gist_document;

				if (gistdoc && gistdoc.id === gist_id && gistdoc.owner_id === this.gist_user.user_id)
				{
					this.load_session();
					return;
				}
			}
		}

		this.load_gist(gist_id);
	}
	else
	{
		this.load_session();
	}
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
		overlay.appendChild(row);

		for (var j = 0; j < cols; j++)
		{
			var index = i * cols + j;

			row.appendChild(viewports[index].dom.root);
			viewports[index].on_attached();
		}
	}

	if (this.skeleton && this.skeleton_data)
	{
		for (var i = 0; i < n; i++)
			viewports[i].on_skeleton_update();
	}

	this.on_resize();
}

Application.prototype.bind_events = function()
{
	var app = this;
	var dom = this.dom;
	var editor = this.editor;

	window.addEventListener("resize", this.on_resize.bind(this));
	window.addEventListener("beforeunload", this.on_beforeunload.bind(this));
	window.addEventListener("hashchange", this.on_hashchange.bind(this));
	editor.addEventListener("change", this.on_editor_change.bind(this));
	editor.renderer.addEventListener("resize", this.on_editor_resize.bind(this));

	dom.menu_new.addEventListener("click", this.on_new.bind(this));
	dom.menu_save.addEventListener("click", this.on_save.bind(this));

	// menu login/logout
	dom.menu_login.addEventListener("click", function()
	{
		if (app.gist_user)
			app.logout();
		else
			dom.login.classList.toggle("visible");
	});

	// login with github token 'ok' button
	dom.gist_login.addEventListener("click", function() {
		dom.gist_token.value && app.login(dom.gist_token.value);
	});

	// dismiss message box
	dom.msgbox.addEventListener("click", function() { app.show_message(null); });

	// keyboard
	window.addEventListener("keydown", function(event)
	{
		if (event.ctrlKey && event.keyCode === 83)
		{
			event.preventDefault();
			app.on_save();
		}
	});
}

Application.prototype.on_hashchange = function()
{
	if (this.prevent_hashchange)
	{
		this.prevent_hashchange = false;
		return;
	}

	location.reload();
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

	if (!this.is_modified && !this.dom.menu_new.classList.contains("disabled"))
		this.dom.menu_save.classList.remove("disabled");

	this.update_timer = setTimeout(this.update_trigger, 1000);
	this.is_modified = true;
	this.modified_count++;
}

Application.prototype.on_beforeunload = function()
{
	this.save_session();
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
	clearTimeout(this.update_timer);
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

	if (this.playing_count > 0)
		requestAnimationFrame(this.frame_callback);
	else
		this.invalidated = false;

	this.time = time;
}

}(this));
