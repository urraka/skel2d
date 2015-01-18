(function(exports) {

function key(win, mac) { return {win: win, mac: mac}; }

exports.ace_keybinds = [
	{
		name: "selectall",
		bindKey: key("Ctrl-A", "Command-A"),
		exec: function(editor) { editor.selectAll(); },
		readOnly: true
	},
	{
		name: "overwrite",
		bindKey: "Insert",
		exec: function(editor) { editor.toggleOverwrite(); },
		readOnly: true
	},

	// moving around and selecting

	{
		name: "gotostart",
		bindKey: key("Ctrl-Home", "Command-Home|Command-Up"),
		exec: function(editor) { editor.navigateFileStart(); },
		multiSelectAction: "forEach",
		readOnly: true,
		scrollIntoView: "animate",
		aceCommandGroup: "fileJump"
	},
	{
		name: "gotoend",
		bindKey: key("Ctrl-End", "Command-End|Command-Down"),
		exec: function(editor) { editor.navigateFileEnd(); },
		multiSelectAction: "forEach",
		readOnly: true,
		scrollIntoView: "animate",
		aceCommandGroup: "fileJump"
	},
	{
		name: "selecttostart",
		bindKey: key("Ctrl-Shift-Home", "Command-Shift-Up"),
		exec: function(editor) { editor.getSelection().selectFileStart(); },
		multiSelectAction: "forEach",
		readOnly: true,
		scrollIntoView: "animate",
		aceCommandGroup: "fileJump"
	},
	{
		name: "selecttoend",
		bindKey: key("Ctrl-Shift-End", "Command-Shift-Down"),
		exec: function(editor) { editor.getSelection().selectFileEnd(); },
		multiSelectAction: "forEach",
		readOnly: true,
		scrollIntoView: "animate",
		aceCommandGroup: "fileJump"
	},
	{
		name: "gotoleft",
		bindKey: key("Left", "Left|Ctrl-B"),
		exec: function(editor, args) { editor.navigateLeft(args.times); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "gotoright",
		bindKey: key("Right", "Right|Ctrl-F"),
		exec: function(editor, args) { editor.navigateRight(args.times); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "selectleft",
		bindKey: key("Shift-Left", "Shift-Left"),
		exec: function(editor) { editor.getSelection().selectLeft(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "selectright",
		bindKey: key("Shift-Right", "Shift-Right"),
		exec: function(editor) { editor.getSelection().selectRight(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "gotowordleft",
		bindKey: key("Ctrl-Left", "Option-Left"),
		exec: function(editor) { editor.navigateWordLeft(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "gotowordright",
		bindKey: key("Ctrl-Right", "Option-Right"),
		exec: function(editor) { editor.navigateWordRight(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "selectwordleft",
		bindKey: key("Ctrl-Shift-Left", "Option-Shift-Left"),
		exec: function(editor) { editor.getSelection().selectWordLeft(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "selectwordright",
		bindKey: key("Ctrl-Shift-Right", "Option-Shift-Right"),
		exec: function(editor) { editor.getSelection().selectWordRight(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "gotolinestart",
		bindKey: key("Home", "Command-Left|Home|Ctrl-A"),
		exec: function(editor) { editor.navigateLineStart(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "gotolineend",
		bindKey: key("End", "Command-Right|End|Ctrl-E"),
		exec: function(editor) { editor.navigateLineEnd(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "selectlinestart",
		bindKey: "Shift-Home",
		exec: function(editor) { editor.getSelection().selectLineStart(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "selectlineend",
		bindKey: "Shift-End",
		exec: function(editor) { editor.getSelection().selectLineEnd(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "golinedown",
		bindKey: key("Down", "Down|Ctrl-N"),
		exec: function(editor, args) { editor.navigateDown(args.times); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "golineup",
		bindKey: key("Up", "Up|Ctrl-P"),
		exec: function(editor, args) { editor.navigateUp(args.times); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "selectdown",
		bindKey: key("Shift-Down", "Shift-Down"),
		exec: function(editor) { editor.getSelection().selectDown(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "selectup",
		bindKey: key("Shift-Up", "Shift-Up"),
		exec: function(editor) { editor.getSelection().selectUp(); },
		multiSelectAction: "forEach",
		scrollIntoView: "cursor",
		readOnly: true
	},
	{
		name: "selectpagedown",
		bindKey: "Shift-PageDown",
		exec: function(editor) { editor.selectPageDown(); },
		readOnly: true
	},
	{
		name: "selectpageup",
		bindKey: "Shift-PageUp",
		exec: function(editor) { editor.selectPageUp(); },
		readOnly: true
	},
	{
		name: "pagedown",
		bindKey: key(null, "Option-PageDown"),
		exec: function(editor) { editor.scrollPageDown(); },
		readOnly: true
	},
	{
		name: "pageup",
		bindKey: key(null, "Option-PageUp"),
		exec: function(editor) { editor.scrollPageUp(); },
		readOnly: true
	},
	{
		name: "gotopagedown",
		bindKey: key("PageDown", "PageDown|Ctrl-V"),
		exec: function(editor) { editor.gotoPageDown(); },
		readOnly: true
	},
	{
		name: "gotopageup",
		bindKey: "PageUp",
		exec: function(editor) { editor.gotoPageUp(); },
		readOnly: true
	},
	{
		name: "scrolldown",
		bindKey: key("Ctrl-Down", null),
		exec: function(e) { e.renderer.scrollBy(0, 2 * e.renderer.layerConfig.lineHeight); },
		readOnly: true
	},
	{
		name: "scrollup",
		bindKey: key("Ctrl-Up", null),
		exec: function(e) { e.renderer.scrollBy(0, -2 * e.renderer.layerConfig.lineHeight); },
		readOnly: true
	},

	// other

	{
		name: "passKeysToBrowser",
		bindKey: key("null", "null"),
		exec: function() {},
		passEvent: true,
		readOnly: true
	},

	// editing


];

}(this));
