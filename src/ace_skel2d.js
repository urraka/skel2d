(function() {

// --- regex ---

var re = {};

re.num = /-?\d+(?:\.\d+)?/;
re.string = /"\S+"/;
re.color = /(?:[\da-fA-F]{3}|[\da-fA-F]{6})(?:,\d+(?:\.\d+)?)?/;
re.bone = /(^\t)([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*)/;
re.slot = /(^\t\t)(@(?:[a-zA-Z_\-][\w\-]*)?(?:\[[a-zA-Z_\-][\w\-]*\])?)/;
re.bone_invalid = /^\t(?:[a-zA-Z_\-][\w\-]*\.)*skeleton(?:\.[a-zA-Z_\-][\w\-]*)*/;
re.slot_invalid = /^\t\t@skeleton(?:\[[a-zA-Z_\-][\w\-]*\])?/;
re.atth_invalid = /^\t\t@(?:[a-zA-Z_\-][\w\-]*)?\[skeleton\]/;
re.cmd_switch_bone = /(:)(\s+)([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*)/;
re.cmd_switch = /(:)(\s+.+)/;
re.cmdval = /(-?\d+(?:\.\d+)?)(,)(-?\d+(?:\.\d+)?)((?::(?:[a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*))?)/;
re.anim_options_full  = /(?:\d+(?:\.\d+)?)?:(?:\d+(?:\.\d+)?)?:(?:[a-zA-Z_](?:[\w\-]*[a-zA-Z_])?)?/;
re.anim_options_short = /(?:\d+(?:\.\d+)?)?:(?:\d+(?:\.\d+)?|[a-zA-Z_](?:[\w\-]*[a-zA-Z_])?)?/;
re.tl_opt_full = /(?:\+?\d+(?:\.\d+)?)?:(?:\d+(?:\.\d+)?)?:(?:[a-zA-Z_](?:[\w\-]*[a-zA-Z_])?)?/;
re.tl_opt_left = /\+?\d+(?:\.\d+)?:(?:\d+(?:\.\d+)?)?/;
re.tl_opt_mid = /(?:\+?\d+(?:\.\d+)?)?:\d+(?:\.\d+)?/;
re.tl_opt_right = /(?:\d+(?:\.\d+)?)?:[a-zA-Z_](?:[\w\-]*[a-zA-Z_])?/;
re.tl_bone = /(^\t)([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*)/;
re.tl_slot = /(^\t)(@[a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*)/;
re.sk_item = /(^\t)(@[a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*(?:\[[a-zA-Z_\-][\w\-]*\])?)/;

for (var i in re)
	re[i] = re[i].source;

// --- rules ---

var skel2d_rules = [
	comment_state(),
	line_state("invalid", null, []),

	body_state("start", "start", 0, [
		item("keyword", "^skeleton", "skel-header", "skel-body"),
		item("keyword", "^anim", "anim-header", "anim-body"),
		item("keyword", "^skin", "skin-header", "skin-body"),
		item("keyword", "^order", "invalid", "order-body", true)
	]),

	// skel

	line_state("skel-header", "skel-body", [
		rule(["property", "value"], "(#)(" + re.color + ")")
	]),

	body_state("skel-body", "start", 1, [
		item("text", re.bone_invalid, "skel-bone"),
		item("text", re.slot_invalid, "skel-slot"),
		item("text", re.atth_invalid, "skel-slot"),
		item("bone", re.bone, "skel-bone"),
		item("slot", re.slot, "skel-slot")
	]),

	line_state("skel-bone", "skel-body", [
		rule(["property", "value"], "([xyrijl])(" + re.num + ")"),
		rule(["property", "value"], "(#)(" + re.color + ")"),
		rule("property", "(?:no-rot|no-scale|flip-x|flip-y)")
	]),

	line_state("skel-slot", "skel-body", [
		rule(["property", "value"], "(#)(" + re.color + ")"),
		item("attachment-type", "(?::)(?:sprite|rect|circle|ellipse)", "skel-attachment"),
		item("attachment-type", ":path", "skel-attachment-path", "skel-path-commands")
	]),

	line_state("skel-attachment", "skel-body", [
		rule(["property", "value"], "([xyrijdtwhm])(" + re.num + ")"),
		rule(["property", "value"], "([fs])(#" + re.color + ")"),
		rule("property", "(?:(?:miter|bevel|round)-join|(?:butt|square|round)-cap)"),
		rule("string", re.string)
	]),

	line_state("skel-attachment-path", "skel-path-commands", [
		rule(["property", "value"], "([xyrijtm])(" + re.num + ")"),
		rule(["property", "value"], "([fs])(#" + re.color + ")"),
		rule("property", "(?:(?:miter|bevel|round)-join|(?:butt|square|round)-cap)")
	]),

	body_state("skel-path-commands", "skel-body", 3, [
		rule(["text", "command", "text", "bone"], "(^\\t\\t\\t)" + re.cmd_switch_bone),
		rule(["text", "command", "text"], "(^\\t\\t\\t)" + re.cmd_switch),
		item("command", "(^\\t\\t\\t)(M|L|Q|B|C)", "skel-path-command")
	]),

	line_state("skel-path-command", "skel-path-commands", [
		rule(["value", "text", "value", "bone"], re.cmdval)
	]),

	// anim

	line_state("anim-header", "anim-body", [
		rule("string", re.string),
		rule("anim-timing", "\\d+fps"),
		rule("anim-timing", re.anim_options_full),
		rule("anim-timing", re.anim_options_short)
	]),

	body_state("anim-body", "start", 1, [
		item("bone", re.tl_bone, "anim-item", "anim-bone-timelines", true),
		item("slot", re.tl_slot, "anim-item", "anim-slot-timelines", true)
	]),

	line_state("anim-item", null, [
		rule("anim-timing", re.anim_options_full),
		rule("anim-timing", re.anim_options_short)
	]),

	body_state("anim-bone-timelines", "anim-body", 2, [
		item("property", "(^\\t\\t)([xyrij])", ["anim-timeline-num", "anim-bone-timelines"]),
		item("property", "(^\\t\\t)([st])", ["anim-timeline-flip", "anim-bone-timelines"])
	]),

	body_state("anim-slot-timelines", "anim-body", 2, [
		item("property", "(^\\t\\t)([rgba])", ["anim-timeline-num", "anim-slot-timelines"]),
		item("property", "(^\\t\\t)(@)", ["anim-timeline-attachment", "anim-slot-timelines"]),
		item("property", "(^\\t\\t)(c)", ["anim-timeline-color", "anim-slot-timelines"])
	]),

	timeline_state("num", ["operator", "value"], "([+*]?)(" + re.num + ")"),
	timeline_state("color", "value", "#" + re.color),
	timeline_state("attachment", "slot", "[a-zA-Z_\\-][\\w\\-]*"),
	timeline_state("flip", "keyword", "(?:true|false)"),

	// skin

	line_state("skin-header", "skin-body", [
		rule("string", re.string)
	]),

	body_state("skin-body", "start", 1, [
		item("slot", re.sk_item, "skin-item")
	]),

	line_state("skin-item", "skin-body", [
		item("attachment-type", "(?::)(?:sprite|rect|circle|ellipse)", "skin-attachment"),
		item("attachment-type", ":path", "skin-attachment-path", "skin-path-commands")
	]),

	line_state("skin-attachment", "skin-body", [
		rule(["property", "value"], "([xyrijdtwhm])(" + re.num + ")"),
		rule(["property", "value"], "([fs])(#" + re.color + ")"),
		rule("property", "(?:(?:miter|bevel|round)-join|(?:butt|square|round)-cap)"),
		rule("string", re.string)
	]),

	line_state("skin-attachment-path", "skin-path-commands", [
		rule(["property", "value"], "([xyrijtm])(" + re.num + ")"),
		rule(["property", "value"], "([fs])(#" + re.color + ")"),
		rule("property", "(?:(?:miter|bevel|round)-join|(?:butt|square|round)-cap)")
	]),

	body_state("skin-path-commands", "skin-body", 2, [
		rule(["text", "command", "text", "bone"], "(^\\t\\t)" + re.cmd_switch_bone),
		rule(["text", "command", "text"], "(^\\t\\t)" + re.cmd_switch),
		item("command", "(^\\t\\t)(M|L|Q|B|C)", "skin-path-command")
	]),

	line_state("skin-path-command", "skin-path-commands", [
		rule(["value", "text", "value", "bone"], re.cmdval)
	]),

	// order

	body_state("order-body", "start", 1, [
		rule(["text", "slot"], re.tl_slot)
	])
];

// --- helpers ---

function double_jump(state, next_state)
{
	return function(s, stack) {
		stack.unshift(state, next_state);
		return state;
	};
}

function jump_to_next(state, stack)
{
	stack.shift();
	return stack.shift();
}

function timeline_state(name, token, regex)
{
	return line_state("anim-timeline-" + name, null, [
		rule(token, regex),
		rule("operator", "(?:\\{|\\}(?:\\[\\d+\\])?|-*>)"),
		rule(["anim-timing", "operator"], "(" + re.tl_opt_full  + ")" + "(-*>)"),
		rule(["anim-timing", "operator"], "(" + re.tl_opt_left  + ")" + "(-*>)"),
		rule(["anim-timing", "operator"], "(" + re.tl_opt_mid   + ")" + "(-*>)"),
		rule(["anim-timing", "operator"], "(" + re.tl_opt_right + ")" + "(-*>)")
	]);
}

function comment_state()
{
	var state = line_state("comment", null, []);

	state.rules = state.rules.filter(function(rule) { return rule.token !== "comment"; });
	state.rules.forEach(function(rule) { rule.token = "comment"; });

	return state;
}

function body_state(name, owner, level, rules)
{
	var tabs = level > 1 ? "\\t{0," + (level - 1) + "}" : "";

	if (level > 0)
	{
		rules.push({token: "text", regex: "^\\s*$"});
		rules.push.apply(rules, item(["text", "comment"], "(^\\s*)(#)", ["comment", name]));
		rules.push({token: "text", regex: "^(?=" + tabs + "[^\\t])", next: owner});
	}

	rules.push({token: "text", regex: "\\\\$", next: ["invalid", name]});
	rules.push({token: "comment", regex: "#$"});
	rules.push({token: "comment", regex: "#(?=\\s|\\\\$)", next: ["comment", name]});
	rules.push({token: "text", regex: "\\s+"});
	rules.push({token: "text", regex: "\\S+(?=\\s|\\\\$)"});
	rules.push({token: "text", regex: "\\S+$"});
	rules.push({token: "text", regex: "", next: name});

	return {name: name, rules: rules};
}

function line_state(name, body, rules)
{
	var next = body || jump_to_next;

	rules.push({token: "comment", regex: "#$", next: next});
	rules.push({token: "comment", regex: "#(?=\\s|\\\\$)", next: body ? ["comment", body] : "comment"});

	rules.push({token: "text", regex: "\\\\$", next: name});
	rules.push({token: "text", regex: "\\s+"});
	rules.push({token: "text", regex: "\\S+(?=\\s|\\\\$)"});
	rules.push({token: "text", regex: "\\S+(?=$)", next: next});
	rules.push({token: "text", regex: "", next: next});

	return {name: name, rules: rules};
}

function item(token, regex, item_state, item_body, item_state_shared)
{
	regex instanceof RegExp && (regex = regex.source);
	token instanceof String && regex.lastIndexOf("(^\\t", 0) === 0 && (token = ["text", token]);

	var rules = [
		{token: token, regex: regex + "(?=\\s|\\\\$)", next: item_state},
		{token: token, regex: regex + "(?=$)"}
	];

	if (item_body)
	{
		rules[0].next = item_state_shared ? [item_state, item_body] : item_state;
		rules[1].next = item_body;
	}

	return rules;
}

function rule(token, regex)
{
	return {token: token, regex: regex + "(?=\\s|\\\\$|$)"};
}

function flatten(rules)
{
	var result = {};

	for (var i = 0, n = rules.length; i < n; i++)
	{
		var list = result[rules[i].name] = Array.prototype.concat.apply([], rules[i].rules);

		for (var j = 0, m = list.length; j < m; j++)
			if ("next" in list[j] && list[j].next instanceof Array)
				list[j].next = double_jump(list[j].next[0], list[j].next[1]);
	}

	return result;
}

// --- exports ---

define(
	"ace/mode/skel2d",
	["require", "exports", "module", "ace/lib/oop", "ace/mode/text", "ace/mode/text_highlight_rules"],

	function(require, exports, module)
	{
		var oop = require("../lib/oop");
		var TextMode = require("./text").Mode;
		var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

		function Mode() { this.HighlightRules = HighlightRules; }
		function HighlightRules() { this.$rules = flatten(skel2d_rules); }

		oop.inherits(HighlightRules, TextHighlightRules);
		oop.inherits(Mode, TextMode);

		Mode.prototype.$id = "ace/mode/skel2d";
		exports.Mode = Mode;
	}
);

}());
