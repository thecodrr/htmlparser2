import { decodeHTML5 } from "entities";
export class Attributes {
    static get(text, name) {
        const start = text.indexOf(name);
        if (start === -1)
            return;
        const isWithoutValue = text[start + name.length] !== "=";
        if (isWithoutValue)
            return "";
        const quote = text[start + name.length + 1];
        const isUnquoted = quote !== "'" && quote !== '"';
        if (isUnquoted)
            text = text.replace(/\s+/gm, (a) => " ".repeat(a.length));
        const valueStart = start + name.length + 1 + (isUnquoted ? 0 : 1);
        let valueEnd = text.indexOf(isUnquoted ? " " : quote, valueStart);
        if (valueEnd === -1)
            valueEnd = text.length;
        return text.substring(valueStart, valueEnd);
    }
    static set(text, name, value) {
        const start = text.indexOf(name);
        if (start === -1) {
            return `${text} ${name}="${value}"`;
        }
        const isWithoutValue = text[start + name.length] !== "=";
        if (isWithoutValue) {
            const before = text.slice(0, start + name.length);
            const after = text.slice(start + name.length);
            return `${before}="${value}"${after}`;
        }
        const quote = text[start + name.length + 1];
        const isUnquoted = quote !== "'" && quote !== '"';
        if (isUnquoted)
            text = text.replace(/\s+/gm, (a) => " ".repeat(a.length));
        const valueStart = start + name.length;
        let valueEnd = text.indexOf(isUnquoted ? " " : quote, valueStart + 2);
        if (valueEnd === -1)
            valueEnd = text.length;
        const before = text.slice(0, valueStart);
        const after = text.slice(valueEnd + 1);
        return `${before}="${value}"${after}`;
    }
    static toJSON(text, lowerCaseAttributeNames = false) {
        const attributes = {};
        let key = "";
        let openingQuote = "";
        let value = "";
        let isParsingValue = false;
        const store = () => {
            attributes[lowerCaseAttributeNames ? key.toLowerCase() : key] =
                decodeHTML5(value);
            key = "";
            value = "";
            isParsingValue = false;
            openingQuote = "";
        };
        for (let i = 0; i < text.length; ++i) {
            const char = text[i];
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
                const quote = text[i + 1];
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
    }
    static toString(attr) {
        const attrs = [];
        for (const key in attr) {
            const value = attr[key];
            let str = key;
            if (!value || value === true) {
                attrs.push(str);
                continue;
            }
            const quote = value.includes('"') ? "'" : '"';
            str += `=${quote}${value}${quote}`;
            attrs.push(str);
        }
        return attrs.join(" ");
    }
}
const WHITESPACE_CHARS = ["\n", "\r", "\t", " ", "\v"];
function isWhitespace(char) {
    return WHITESPACE_CHARS.includes(char);
}
//# sourceMappingURL=Attributes.js.map