define("ace/mode/skel2d",["require","exports","module","ace/lib/oop","ace/mode/text",
"ace/mode/text_highlight_rules"], function(require, exports, module) {

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

function start_crap(next_state)
{
	return function(state, stack) {
		stack.unshift("crap", next_state);
		return "crap";
	}
}

oop.inherits(HighlightRules, TextHighlightRules);

function HighlightRules()
{
	this.$rules = {
		"start": [
			{
				token: "text",
				regex: /\\$/,
				next: start_crap("start")
			},
			{
				token: "keyword",
				regex: /^skeleton$/,
				next: "skeleton"
			},
			{
				token: "keyword",
				regex: /(^skeleton)(?=\s|\\$)/,
				next: start_crap("skeleton")
			},
			{
				token: "text",
				regex: /.+(?=\\$)/
			},
			{
				token: "text",
				regex: /.+/
			}
		],
		"crap": [
			{
				token: "text",
				regex: /\\$/,
				next: "crap"
			},
			{
				token: "text",
				regex: /.+(?=\\$)/
			},
			{
				token: "text",
				regex: /.+/
			},
			{
				regex: "",
				next: function(state, stack) {
					stack.shift();
					return stack.shift();
				}
			}
		],
		"skeleton": [
			// invalid bone (with 'skeleton' in name)
			{
				token: ["text", "text"],
				regex: /(^\t)((?:[a-zA-Z_\-][\w\-]*\.)*skeleton(?:\.[a-zA-Z_\-][\w\-]*)*)(?=\s|\\$)/,
				next: "bone"
			},
			{
				token: ["text", "text"],
				regex: /(^\t)((?:[a-zA-Z_\-][\w\-]*\.)*skeleton(?:\.[a-zA-Z_\-][\w\-]*)*$)/
			},

			// bone
			{
				token: ["text", "bone"],
				regex: /(^\t)([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*)(?=\s|\\$)/,
				next: "bone"
			},
			{
				token: ["text", "bone"],
				regex: /(^\t)([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*$)/
			},

			// invalid slot (with 'skeleton' in name)
			{
				token: ["text", "text"],
				regex: /(^\t\t)(@skeleton(?:\[[a-zA-Z_\-][\w\-]*\])?)(?=\s|\\$)/,
				next: "slot"
			},
			{
				token: ["text", "text"],
				regex: /(^\t\t)(@skeleton(?:\[[a-zA-Z_\-][\w\-]*\])?$)/
			},
			{
				token: ["text", "text"],
				regex: /(^\t\t)(@(?:[a-zA-Z_\-][\w\-]*)?\[skeleton\])(?=\s|\\$)/,
				next: "slot"
			},
			{
				token: ["text", "text"],
				regex: /(^\t\t)(@(?:[a-zA-Z_\-][\w\-]*)?\[skeleton\]$)/
			},

			// slot
			{
				token: ["text", "slot"],
				regex: /(^\t\t)(@(?:[a-zA-Z_\-][\w\-]*)?(?:\[[a-zA-Z_\-][\w\-]*\])?)(?=\s|\\$)/,
				next: "slot"
			},
			{
				token: ["text", "slot"],
				regex: /(^\t\t)(@(?:[a-zA-Z_\-][\w\-]*)?(?:\[[a-zA-Z_\-][\w\-]*\])?$)/
			},

			// other
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
				token: "text",
				regex: /\\$/,
				next: start_crap("skeleton")
			},
			{
				token: "text",
				regex: /.+(?=\\$)/
			},
			{
				token: "text",
				regex: /.+/
			},
			{
				regex: "",
				next: "skeleton"
			}
		],
		"bone": [
			{
				token: ["property", "value"],
				regex: /([xyrijl])(-?\d+(?:\.\d+)?)(?=\s|\\$|$)/
			},
			{
				token: ["property", "value"],
				regex: /(#)([\da-fA-F]{3}|[\da-fA-F]{6})(?:,\d+(?:\.\d+)?)?(?=\s|\\$|$)/
			},
			{
				token: "text",
				regex: /\\$/,
				next: "bone"
			},
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: "text",
				regex: /\S+(?=\\$|\s)/
			},
			{
				regex: "",
				next: "skeleton"
			}
		],
		"slot": [
			{
				token: ["property", "value"],
				regex: /(#)([\da-fA-F]{3}|[\da-fA-F]{6})(?:,\d+(?:\.\d+)?)?(?=\s|\\$|$)/
			},
			{
				token: "attachment-type",
				regex: /(?::)(?:sprite|rect|circle|ellipse)(?=$)/
			},
			{
				token: "attachment-type",
				regex: /(?::)(?:sprite|rect|circle|ellipse)(?=\s|\\$)/,
				next: "attachment"
			},
			{
				token: "attachment-type",
				regex: /:path$/,
				next: "commands"
			},
			{
				token: "attachment-type",
				regex: /:path(?=\s|\\$)/,
				next: "attachment-path"
			},
			{
				token: "text",
				regex: /\\$/,
				next: "slot"
			},
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: "text",
				regex: /\S+(?=\\$|\s)/
			},
			{
				regex: "",
				next: "skeleton"
			}
		],
		"attachment": [
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
				token: "text",
				regex: /\\$/,
				next: "attachment"
			},
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: "text",
				regex: /\S+(?=\\$|\s)/
			},
			{
				regex: "",
				next: "skeleton"
			}
		],
		"attachment-path": [
			{
				token: ["property", "value"],
				regex: /([xyrijtm])(-?\d+(?:\.\d+)?)(?=\s|\\$|$)/
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
				token: "text",
				regex: /\\$/,
				next: "attachment"
			},
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: "text",
				regex: /\S+(?=\\$|\s)/
			},
			{
				regex: "",
				next: "commands"
			}
		],
		"commands": [
			{
				token: "text",
				regex: /^\s*$/
			},
			{
				token: ["text", "command", "text", "bone"],
				regex: /(^\t\t\t)(:)(\s+)([a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*)(?=\s|\\$|$)/
			},
			{
				token: ["text", "command", "text"],
				regex: /(^\t\t\t)(:)(\s+.+)(?=\s|\\$|$)/
			},
			{
				token: ["text", "command"],
				regex: /(^\t\t\t)(M|L|Q|B|C)(?=\s|\\$)/,
				next: "command"
			},
			{
				token: ["text", "command"],
				regex: /(^\t\t\t)(M|L|Q|B|C$)/
			},
			{
				token: "text",
				regex: /^(?=\t{0,2}[^\t])/,
				next: "skeleton"
			},
			{
				token: "text",
				regex: /\\$/,
				next: start_crap("commands")
			},
			{
				token: "text",
				regex: /.+(?=\\$)/
			},
			{
				token: "text",
				regex: /.+/
			},
			{
				regex: "",
				next: "commands"
			}
		],
		"command": [
			{
				token: "text",
				regex: /\s+/
			},
			{
				token: ["value", "text", "value", "bone"],
				regex: /(-?\d+(?:\.\d+)?)(,)(-?\d+(?:\.\d+)?)((?::(?:[a-zA-Z_\-][\w\-]*(?:\.[a-zA-Z_\-][\w\-]*)*))?)(?=\s|\\$|$)/
			},
			{
				token: "text",
				regex: /\\$/,
				next: "command"
			},
			{
				token: "text",
				regex: /\S+(?=\\$|\s)/
			},
			{
				regex: "",
				next: "commands"
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
