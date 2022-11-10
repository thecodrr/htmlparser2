"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Attributes = void 0;
var entities_1 = require("entities");
var Attributes = /** @class */ (function () {
    function Attributes() {
    }
    Attributes.get = function (text, name) {
        var start = text.indexOf(name);
        if (start === -1)
            return;
        var isWithoutValue = text[start + name.length] !== "=";
        if (isWithoutValue)
            return "";
        var quote = text[start + name.length + 1];
        var isUnquoted = quote !== "'" && quote !== '"';
        if (isUnquoted)
            text = text.replace(/\s+/gm, function (a) { return " ".repeat(a.length); });
        var valueStart = start + name.length + 1 + (isUnquoted ? 0 : 1);
        var valueEnd = text.indexOf(isUnquoted ? " " : quote, valueStart);
        if (valueEnd === -1)
            valueEnd = text.length;
        return text.substring(valueStart, valueEnd);
    };
    Attributes.set = function (text, name, value) {
        var start = text.indexOf(name);
        if (start === -1) {
            return "".concat(text, " ").concat(name, "=\"").concat(value, "\"");
        }
        var isWithoutValue = text[start + name.length] !== "=";
        if (isWithoutValue) {
            var before_1 = text.slice(0, start + name.length);
            var after_1 = text.slice(start + name.length);
            return "".concat(before_1, "=\"").concat(value, "\"").concat(after_1);
        }
        var quote = text[start + name.length + 1];
        var isUnquoted = quote !== "'" && quote !== '"';
        if (isUnquoted)
            text = text.replace(/\s+/gm, function (a) { return " ".repeat(a.length); });
        var valueStart = start + name.length;
        var valueEnd = text.indexOf(isUnquoted ? " " : quote, valueStart + 2);
        if (valueEnd === -1)
            valueEnd = text.length;
        var before = text.slice(0, valueStart);
        var after = text.slice(valueEnd + 1);
        return "".concat(before, "=\"").concat(value, "\"").concat(after);
    };
    Attributes.toJSON = function (text, lowerCaseAttributeNames) {
        if (lowerCaseAttributeNames === void 0) { lowerCaseAttributeNames = false; }
        var attributes = {};
        var key = "";
        var openingQuote = "";
        var value = "";
        var isParsingValue = false;
        var store = function () {
            attributes[lowerCaseAttributeNames ? key.toLowerCase() : key] =
                (0, entities_1.decodeHTML5)(value);
            key = "";
            value = "";
            isParsingValue = false;
            openingQuote = "";
        };
        for (var i = 0; i < text.length; ++i) {
            var char = text[i];
            /*
             * We skip all whitespaces unless they are a part of the value.
             * Whitespaces usually indicate end of an attribute & start of
             * the next one; hence this is one of the checkpoints for storing
             * the parsed attribute as key/value.
             */
            if (isWhitespace(char)) {
                /*
                 * Only unquoted attributes end with whitespace. Other
                 * attributes end when a matching quote is found.
                 */
                if (key && openingQuote === "") {
                    store();
                }
                // We also need to allow whitespaces inside values.
                else if (isParsingValue)
                    value += char;
                continue;
            }
            if (isParsingValue &&
                // Opening & closing quote must match
                text[i] === openingQuote &&
                // And the closing quote must not be escaped
                text[i - 1] !== "\\") {
                store();
                continue;
            }
            /**
             * We found this equal sign which indicates start of the value
             * and end of the key. However, this can also be part of the value
             * so we need to check that.
             */
            if (char === "=" && !isParsingValue) {
                isParsingValue = true;
                /**
                 * Check if the value is quoted & what quote it is using. We'll
                 * use this value to check if the value has ended or not.
                 */
                var quote = text[i + 1];
                openingQuote = quote === "'" || quote === '"' ? quote : "";
                /*
                 * We only skip ahead if there is an opening quote
                 */
                if (openingQuote)
                    ++i;
            }
            else if (isParsingValue) {
                value += char;
            }
            else {
                key += char;
            }
        }
        if (key)
            attributes[key] = value;
        return attributes;
    };
    Attributes.toString = function (attr) {
        var attrs = [];
        for (var key in attr) {
            var value = attr[key];
            var str = key;
            if (!value || value === true) {
                attrs.push(str);
                continue;
            }
            var quote = value.includes('"') ? "'" : '"';
            str += "=".concat(quote).concat(value).concat(quote);
            attrs.push(str);
        }
        return attrs.join(" ");
    };
    return Attributes;
}());
exports.Attributes = Attributes;
var WHITESPACE_CHARS = ["\n", "\r", "\t", " ", "\v"];
function isWhitespace(char) {
    return WHITESPACE_CHARS.includes(char);
}
//# sourceMappingURL=Attributes.js.map