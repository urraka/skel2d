define("ace/mode/skel2d",["require","exports","module","ace/lib/oop","ace/mode/text",
"ace/mode/text_highlight_rules"], function(require, exports, module) {

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

oop.inherits(HighlightRules, TextHighlightRules);

function HighlightRules()
{
	this.$rules = {
		"start": [
			{
				token: "keyword",
				regex: /(^skeleton)(?=\s|$)/,
				next: function(state, stack) {
					stack.unshift("skeleton");
					return "skeleton";
				}
			},
			{
				token: "text",
				regex: /.+/
			}
		],
		"skeleton": [
			{
				token: "text",
				regex: /^\s+$/
			},
			{
				token: "text",
				regex: /^(?=[^\t])/,
				next: function(state, stack) {
					stack.shift();
					return "start";
				}
			},
			{
				token: ["text", "bone"],
				regex: /(^\t)([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*)(?=\s|$)/,
				next: "bone"
			},
			{
				token: ["text", "slot"],
				regex: /(^\t\t)(@(?:[a-zA-Z_\-][\w\-]*)?(?:\[[a-zA-Z_\-][\w\-]*\])*)(?=\s|$)/,
				next: "slot"
			},
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: "invalid",
				regex: /.+/
			},
			{
				regex: "",
				next: "start"
			}
		],
		"bone": [
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: ["property", "value"],
				regex: /([xyrijl])(-?\d+(?:\.\d+)?)(?=\s|$)/
			},
			{
				token: ["property", "value"],
				regex: /(#)([\da-fA-F]{3}|[\da-fA-F]{6})(?:,\d+(?:\.\d+)?)?(?=\s|$)/
			},
			{
				token: "invalid",
				regex: /\S+/
			},
			{
				regex: "",
				next: "skeleton"
			}
		],
		"slot": [
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: ["property", "value"],
				regex: /(#)([\da-fA-F]{3}|[\da-fA-F]{6})(?:,\d+(?:\.\d+)?)?(?=\s|$)/
			},
			{
				token: "attachment-type",
				regex: /(?::)(?:sprite|rect|circle|ellipse|path)(?=\s|$)/,
				next: "attachment"
			},
			{
				token: "invalid",
				regex: /\S+/
			},
			{
				regex: "",
				next: "skeleton"
			}
		],
		"attachment": [
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: ["property", "value"],
				regex: /([xyrijdtwhm])(-?\d+(?:\.\d+)?)(?=\s|$)/
			},
			{
				token: ["property", "value"],
				regex: /([fs])(#[\da-fA-F]{3}|[\da-fA-F]{6})(?:,\d+(?:\.\d+)?)?(?=\s|$)/
			},
			{
				token: "property",
				regex: /(?:(?:miter|bevel|round)-join|(?:butt|square|round)-cap)(?=\s|$)/
			},
			{
				token: "invalid",
				regex: /\S+/
			},
			{
				regex: "",
				next: "skeleton"
			}
		]
	};
}

oop.inherits(Mode, TextMode);

function Mode()
{
	this.HighlightRules = HighlightRules;
}

exports.Mode = Mode;

});
