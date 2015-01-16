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
				next: "skeleton"
			},
			{
				token: "text",
				regex: /.+/
			}
		],
		"skeleton": [
			{
				token: "text",
				regex: /^\s*$/
			},
			{
				token: "text",
				regex: /^(?=[^\t])/,
				next: "start"
			},
			{
				token: ["text", "invalid"],
				regex: /(^\t)((?:[a-zA-Z_\-][\w\-]*\.)*skeleton(?:\.[a-zA-Z_\-][\w\-]*)*)(?=\s|$)/
			},
			{
				token: ["text", "bone"],
				regex: /(^\t)([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*)(?=\s)/,
				next: "bone"
			},
			{
				token: ["text", "bone"],
				regex: /(^\t)([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*$)/
			},
			{
				token: ["text", "invalid"],
				regex: /(^\t\t)(@skeleton(?:\[[a-zA-Z_\-][\w\-]*\])?)(?=\s|$)/
			},
			{
				token: ["text", "invalid"],
				regex: /(^\t\t)(@(?:[a-zA-Z_\-][\w\-]*)?\[skeleton\])(?=\s|$)/
			},
			{
				token: ["text", "slot"],
				regex: /(^\t\t)(@(?:[a-zA-Z_\-][\w\-]*)?(?:\[[a-zA-Z_\-][\w\-]*\])?)(?=\s)/,
				next: "slot"
			},
			{
				token: ["text", "slot"],
				regex: /(^\t\t)(@(?:[a-zA-Z_\-][\w\-]*)?(?:\[[a-zA-Z_\-][\w\-]*\])?$)/
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
				next: "skeleton"
			}
		],
		"bone": [
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: "text",
				regex: /\\$/,
				next: "bone"
			},
			{
				token: ["property", "value"],
				regex: /([xyrijl])(-?\d+(?:\.\d+)?)(?=\s|\\$|$)/
			},
			{
				token: ["property", "value"],
				regex: /(#)([\da-fA-F]{3}|[\da-fA-F]{6})(?:,\d+(?:\.\d+)?)?(?=\s|\\$|$)/
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
				token: "text",
				regex: /\\$/,
				next: "slot"
			},
			{
				token: ["property", "value"],
				regex: /(#)([\da-fA-F]{3}|[\da-fA-F]{6})(?:,\d+(?:\.\d+)?)?(?=\s|\\$|$)/
			},
			{
				token: "attachment-type",
				regex: /(?::)(?:sprite|rect|circle|ellipse|path)(?=$)/
			},
			{
				token: "attachment-type",
				regex: /(?::)(?:sprite|rect|circle|ellipse|path)(?=\s|\\$)/,
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
				token: "text",
				regex: /\\$/,
				next: "attachment"
			},
			{
				token: ["property", "value"],
				regex: /([xyrijdtwhm])(-?\d+(?:\.\d+)?)(?=\s|\\$|$)/
			},
			{
				token: ["property", "value"],
				regex: /([fs])(#(?:[\da-fA-F]{3}|[\da-fA-F]{6})(?:,\d+(?:\.\d+)?)?)(?=\s|\\$|$)/
			},
			{
				token: "property",
				regex: /(?:(?:miter|bevel|round)-join|(?:butt|square|round)-cap)(?=\s|\\$|$)/
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
