import { htmlDecodeTree, xmlDecodeTree, BinTrieFlags, determineBranch, replaceCodePoint, } from "entities/lib/decode.js";
var CharCodes;
(function (CharCodes) {
    CharCodes[CharCodes["Tab"] = 9] = "Tab";
    CharCodes[CharCodes["NewLine"] = 10] = "NewLine";
    CharCodes[CharCodes["FormFeed"] = 12] = "FormFeed";
    CharCodes[CharCodes["CarriageReturn"] = 13] = "CarriageReturn";
    CharCodes[CharCodes["Space"] = 32] = "Space";
    CharCodes[CharCodes["ExclamationMark"] = 33] = "ExclamationMark";
    CharCodes[CharCodes["Num"] = 35] = "Num";
    CharCodes[CharCodes["Amp"] = 38] = "Amp";
    CharCodes[CharCodes["SingleQuote"] = 39] = "SingleQuote";
    CharCodes[CharCodes["DoubleQuote"] = 34] = "DoubleQuote";
    CharCodes[CharCodes["Dash"] = 45] = "Dash";
    CharCodes[CharCodes["Slash"] = 47] = "Slash";
    CharCodes[CharCodes["Zero"] = 48] = "Zero";
    CharCodes[CharCodes["Nine"] = 57] = "Nine";
    CharCodes[CharCodes["Semi"] = 59] = "Semi";
    CharCodes[CharCodes["Lt"] = 60] = "Lt";
    CharCodes[CharCodes["Eq"] = 61] = "Eq";
    CharCodes[CharCodes["Gt"] = 62] = "Gt";
    CharCodes[CharCodes["Questionmark"] = 63] = "Questionmark";
    CharCodes[CharCodes["UpperA"] = 65] = "UpperA";
    CharCodes[CharCodes["LowerA"] = 97] = "LowerA";
    CharCodes[CharCodes["UpperF"] = 70] = "UpperF";
    CharCodes[CharCodes["LowerF"] = 102] = "LowerF";
    CharCodes[CharCodes["UpperZ"] = 90] = "UpperZ";
    CharCodes[CharCodes["LowerZ"] = 122] = "LowerZ";
    CharCodes[CharCodes["LowerX"] = 120] = "LowerX";
    CharCodes[CharCodes["OpeningSquareBracket"] = 91] = "OpeningSquareBracket";
})(CharCodes || (CharCodes = {}));
/** All the states the tokenizer can be in. */
var State;
(function (State) {
    State[State["Text"] = 1] = "Text";
    State[State["BeforeTagName"] = 2] = "BeforeTagName";
    State[State["InTagName"] = 3] = "InTagName";
    State[State["AfterTagName"] = 4] = "AfterTagName";
    State[State["InSelfClosingTag"] = 5] = "InSelfClosingTag";
    State[State["BeforeClosingTagName"] = 6] = "BeforeClosingTagName";
    State[State["InClosingTagName"] = 7] = "InClosingTagName";
    State[State["AfterClosingTagName"] = 8] = "AfterClosingTagName";
    // Declarations
    State[State["BeforeDeclaration"] = 9] = "BeforeDeclaration";
    State[State["InDeclaration"] = 10] = "InDeclaration";
    // Processing instructions
    State[State["InProcessingInstruction"] = 11] = "InProcessingInstruction";
    // Comments & CDATA
    State[State["BeforeComment"] = 12] = "BeforeComment";
    State[State["CDATASequence"] = 13] = "CDATASequence";
    State[State["InSpecialComment"] = 14] = "InSpecialComment";
    State[State["InCommentLike"] = 15] = "InCommentLike";
    // Special tags
    State[State["BeforeSpecialS"] = 16] = "BeforeSpecialS";
    State[State["SpecialStartSequence"] = 17] = "SpecialStartSequence";
    State[State["InSpecialTag"] = 18] = "InSpecialTag";
    State[State["BeforeEntity"] = 19] = "BeforeEntity";
    State[State["BeforeNumericEntity"] = 20] = "BeforeNumericEntity";
    State[State["InNamedEntity"] = 21] = "InNamedEntity";
    State[State["InNumericEntity"] = 22] = "InNumericEntity";
    State[State["InHexEntity"] = 23] = "InHexEntity";
})(State || (State = {}));
function isWhitespace(c) {
    return (c === CharCodes.Space ||
        c === CharCodes.NewLine ||
        c === CharCodes.Tab ||
        c === CharCodes.FormFeed ||
        c === CharCodes.CarriageReturn);
}
function isEndOfTagSection(c) {
    return c === CharCodes.Slash || c === CharCodes.Gt || isWhitespace(c);
}
function isNumber(c) {
    return c >= CharCodes.Zero && c <= CharCodes.Nine;
}
function isASCIIAlpha(c) {
    return ((c >= CharCodes.LowerA && c <= CharCodes.LowerZ) ||
        (c >= CharCodes.UpperA && c <= CharCodes.UpperZ));
}
export function isHexDigit(c) {
    return ((c >= CharCodes.UpperA && c <= CharCodes.UpperF) ||
        (c >= CharCodes.LowerA && c <= CharCodes.LowerF));
}
/**
 * Sequences used to match longer strings.
 *
 * We don't have `Script`, `Style`, or `Title` here. Instead, we re-use the *End
 * sequences with an increased offset.
 */
const Sequences = {
    Cdata: new Uint8Array([0x43, 0x44, 0x41, 0x54, 0x41, 0x5b]),
    CdataEnd: new Uint8Array([0x5d, 0x5d, 0x3e]),
    CommentEnd: new Uint8Array([0x2d, 0x2d, 0x3e]),
    ScriptEnd: new Uint8Array([0x3c, 0x2f, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74]),
    StyleEnd: new Uint8Array([0x3c, 0x2f, 0x73, 0x74, 0x79, 0x6c, 0x65]),
    TitleEnd: new Uint8Array([0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65]), // `</title`
};
export default class Tokenizer {
    constructor({ xmlMode = false, decodeEntities = true, }, cbs) {
        this.cbs = cbs;
        /** The current state the tokenizer is in. */
        this.state = State.Text;
        /** The read buffer. */
        this.buffer = "";
        /** The beginning of the section that is currently being read. */
        this.sectionStart = 0;
        /** The index within the buffer that we are currently looking at. */
        this.index = 0;
        /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
        this.baseState = State.Text;
        /** For special parsing behavior inside of script and style tags. */
        this.isSpecial = false;
        /** Indicates whether the tokenizer has been paused. */
        this.running = true;
        /** The offset of the current buffer. */
        this.offset = 0;
        this.sequenceIndex = 0;
        this.trieIndex = 0;
        this.trieCurrent = 0;
        /** For named entities, the index of the value. For numeric entities, the code point. */
        this.entityResult = 0;
        this.entityExcess = 0;
        this.xmlMode = xmlMode;
        this.decodeEntities = decodeEntities;
        this.entityTrie = xmlMode ? xmlDecodeTree : htmlDecodeTree;
    }
    reset() {
        this.state = State.Text;
        this.buffer = "";
        this.sectionStart = 0;
        this.index = 0;
        this.baseState = State.Text;
        this.currentSequence = undefined;
        this.running = true;
        this.offset = 0;
    }
    write(chunk) {
        this.offset += this.buffer.length;
        this.buffer = chunk;
        this.parse();
    }
    end() {
        if (this.running)
            this.finish();
    }
    pause() {
        this.running = false;
    }
    resume() {
        this.running = true;
        if (this.index < this.buffer.length + this.offset) {
            this.parse();
        }
    }
    /**
     * The current index within all of the written data.
     */
    getIndex() {
        return this.index;
    }
    /**
     * The start of the current section.
     */
    getSectionStart() {
        return this.sectionStart;
    }
    stateText(c) {
        if (c === CharCodes.Lt ||
            (!this.decodeEntities && this.fastForwardTo(CharCodes.Lt))) {
            if (this.index > this.sectionStart) {
                this.cbs.ontext(this.sectionStart, this.index);
            }
            this.state = State.BeforeTagName;
            this.sectionStart = this.index;
        }
        else if (this.decodeEntities && c === CharCodes.Amp) {
            this.state = State.BeforeEntity;
        }
    }
    stateSpecialStartSequence(c) {
        const isEnd = this.sequenceIndex === this.currentSequence.length;
        const isMatch = isEnd
            ? // If we are at the end of the sequence, make sure the tag name has ended
                isEndOfTagSection(c)
            : // Otherwise, do a case-insensitive comparison
                (c | 0x20) === this.currentSequence[this.sequenceIndex];
        if (!isMatch) {
            this.isSpecial = false;
        }
        else if (!isEnd) {
            this.sequenceIndex++;
            return;
        }
        this.sequenceIndex = 0;
        this.state = State.InTagName;
        this.stateInTagName(c);
    }
    /** Look for an end tag. For <title> tags, also decode entities. */
    stateInSpecialTag(c) {
        if (this.sequenceIndex === this.currentSequence.length) {
            if (c === CharCodes.Gt || isWhitespace(c)) {
                const endOfText = this.index - this.currentSequence.length;
                if (this.sectionStart < endOfText) {
                    // Spoof the index so that reported locations match up.
                    const actualIndex = this.index;
                    this.index = endOfText;
                    this.cbs.ontext(this.sectionStart, endOfText);
                    this.index = actualIndex;
                }
                this.isSpecial = false;
                this.sectionStart = endOfText + 2; // Skip over the `</`
                this.stateInClosingTagName(c);
                return; // We are done; skip the rest of the function.
            }
            this.sequenceIndex = 0;
        }
        if ((c | 0x20) === this.currentSequence[this.sequenceIndex]) {
            this.sequenceIndex += 1;
        }
        else if (this.sequenceIndex === 0) {
            if (this.currentSequence === Sequences.TitleEnd) {
                // We have to parse entities in <title> tags.
                if (this.decodeEntities && c === CharCodes.Amp) {
                    this.state = State.BeforeEntity;
                }
            }
            else if (this.fastForwardTo(CharCodes.Lt)) {
                // Outside of <title> tags, we can fast-forward.
                this.sequenceIndex = 1;
            }
        }
        else {
            // If we see a `<`, set the sequence index to 1; useful for eg. `<</script>`.
            this.sequenceIndex = Number(c === CharCodes.Lt);
        }
    }
    stateCDATASequence(c) {
        if (c === Sequences.Cdata[this.sequenceIndex]) {
            if (++this.sequenceIndex === Sequences.Cdata.length) {
                this.state = State.InCommentLike;
                this.currentSequence = Sequences.CdataEnd;
                this.sequenceIndex = 0;
                this.sectionStart = this.index + 1;
            }
        }
        else {
            this.sequenceIndex = 0;
            this.state = State.InDeclaration;
            this.stateInDeclaration(c); // Reconsume the character
        }
    }
    /**
     * When we wait for one specific character, we can speed things up
     * by skipping through the buffer until we find it.
     *
     * @returns Whether the character was found.
     */
    fastForwardTo(c) {
        const index = this.buffer.indexOf(String.fromCharCode(c), this.index);
        if (index > -1) {
            this.index = index + this.offset;
            return true;
        }
        /*
         * We increment the index at the end of the `parse` loop,
         * so set it to `buffer.length - 1` here.
         *
         * TODO: Refactor `parse` to increment index before calling states.
         */
        this.index = this.buffer.length + this.offset - 1;
        return false;
    }
    /**
     * Comments and CDATA end with `-->` and `]]>`.
     *
     * Their common qualities are:
     * - Their end sequences have a distinct character they start with.
     * - That character is then repeated, so we have to check multiple repeats.
     * - All characters but the start character of the sequence can be skipped.
     */
    stateInCommentLike(c) {
        if (c === this.currentSequence[this.sequenceIndex]) {
            if (++this.sequenceIndex === this.currentSequence.length) {
                if (this.currentSequence === Sequences.CdataEnd) {
                    this.cbs.oncdata(this.sectionStart, this.index, 2);
                }
                else {
                    this.cbs.oncomment(this.sectionStart, this.index, 2);
                }
                this.sequenceIndex = 0;
                this.sectionStart = this.index + 1;
                this.state = State.Text;
            }
        }
        else if (this.sequenceIndex === 0) {
            // Fast-forward to the first character of the sequence
            if (this.fastForwardTo(this.currentSequence[0])) {
                this.sequenceIndex = 1;
            }
        }
        else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
            // Allow long sequences, eg. --->, ]]]>
            this.sequenceIndex = 0;
        }
    }
    /**
     * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
     *
     * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
     * We allow anything that wouldn't end the tag.
     */
    isTagStartChar(c) {
        return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
    }
    startSpecial(sequence, offset) {
        this.isSpecial = true;
        this.currentSequence = sequence;
        this.sequenceIndex = offset;
        this.state = State.SpecialStartSequence;
    }
    stateBeforeTagName(c) {
        if (c === CharCodes.ExclamationMark) {
            this.state = State.BeforeDeclaration;
            this.sectionStart = this.index + 1;
        }
        else if (c === CharCodes.Questionmark) {
            this.state = State.InProcessingInstruction;
            this.sectionStart = this.index + 1;
        }
        else if (this.isTagStartChar(c)) {
            const lower = c | 0x20;
            this.sectionStart = this.index;
            if (!this.xmlMode && lower === Sequences.TitleEnd[2]) {
                this.startSpecial(Sequences.TitleEnd, 3);
            }
            else {
                this.state =
                    !this.xmlMode && lower === Sequences.ScriptEnd[2]
                        ? State.BeforeSpecialS
                        : State.InTagName;
            }
        }
        else if (c === CharCodes.Slash) {
            this.state = State.BeforeClosingTagName;
        }
        else {
            this.state = State.Text;
            this.stateText(c);
        }
    }
    stateInTagName(c) {
        if (isEndOfTagSection(c)) {
            this.cbs.onopentagname(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.state = State.AfterTagName;
            this.stateAfterTagName(c);
        }
    }
    stateBeforeClosingTagName(c) {
        if (isWhitespace(c)) {
            // Ignore
        }
        else if (c === CharCodes.Gt) {
            this.state = State.Text;
        }
        else {
            this.state = this.isTagStartChar(c)
                ? State.InClosingTagName
                : State.InSpecialComment;
            this.sectionStart = this.index;
        }
    }
    stateInClosingTagName(c) {
        if (c === CharCodes.Gt || isWhitespace(c)) {
            this.cbs.onclosetag(this.sectionStart, this.index);
            this.sectionStart = -1;
            this.state = State.AfterClosingTagName;
            this.stateAfterClosingTagName(c);
        }
    }
    stateAfterClosingTagName(c) {
        // Skip everything until ">"
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    stateAfterTagName(c) {
        if (c === CharCodes.Gt) {
            this.cbs.onopentagend(this.index);
            if (this.isSpecial) {
                this.state = State.InSpecialTag;
                this.sequenceIndex = 0;
            }
            else {
                this.state = State.Text;
            }
            this.baseState = this.state;
            this.sectionStart = this.index + 1;
        }
        else if (c === CharCodes.Slash) {
            this.state = State.InSelfClosingTag;
        }
        else if (!isWhitespace(c)) {
            this.sectionStart = this.index;
            if (this.fastForwardTo(CharCodes.Gt)) {
                if (this.buffer.charCodeAt(--this.index) === CharCodes.Slash) {
                    this.state = State.InSelfClosingTag;
                }
                else {
                    this.state = State.AfterTagName;
                }
            }
            this.cbs.onattrib(this.sectionStart, this.index + 1);
            this.sectionStart = -1;
        }
    }
    stateInSelfClosingTag(c) {
        if (c === CharCodes.Gt) {
            this.cbs.onselfclosingtag(this.index);
            this.state = State.Text;
            this.baseState = State.Text;
            this.sectionStart = this.index + 1;
            this.isSpecial = false; // Reset special state, in case of self-closing special tags
        }
    }
    stateBeforeDeclaration(c) {
        if (c === CharCodes.OpeningSquareBracket) {
            this.state = State.CDATASequence;
            this.sequenceIndex = 0;
        }
        else {
            this.state =
                c === CharCodes.Dash
                    ? State.BeforeComment
                    : State.InDeclaration;
        }
    }
    stateInDeclaration(c) {
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.cbs.ondeclaration(this.sectionStart, this.index);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    stateInProcessingInstruction(c) {
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.cbs.onprocessinginstruction(this.sectionStart, this.index);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    stateBeforeComment(c) {
        if (c === CharCodes.Dash) {
            this.state = State.InCommentLike;
            this.currentSequence = Sequences.CommentEnd;
            // Allow short comments (eg. <!-->)
            this.sequenceIndex = 2;
            this.sectionStart = this.index + 1;
        }
        else {
            this.state = State.InDeclaration;
        }
    }
    stateInSpecialComment(c) {
        if (c === CharCodes.Gt || this.fastForwardTo(CharCodes.Gt)) {
            this.cbs.oncomment(this.sectionStart, this.index, 0);
            this.state = State.Text;
            this.sectionStart = this.index + 1;
        }
    }
    stateBeforeSpecialS(c) {
        const lower = c | 0x20;
        if (lower === Sequences.ScriptEnd[3]) {
            this.startSpecial(Sequences.ScriptEnd, 4);
        }
        else if (lower === Sequences.StyleEnd[3]) {
            this.startSpecial(Sequences.StyleEnd, 4);
        }
        else {
            this.state = State.InTagName;
            this.stateInTagName(c); // Consume the token again
        }
    }
    stateBeforeEntity(c) {
        // Start excess with 1 to include the '&'
        this.entityExcess = 1;
        this.entityResult = 0;
        if (c === CharCodes.Num) {
            this.state = State.BeforeNumericEntity;
        }
        else if (c === CharCodes.Amp) {
            // We have two `&` characters in a row. Stay in the current state.
        }
        else {
            this.trieIndex = 0;
            this.trieCurrent = this.entityTrie[0];
            this.state = State.InNamedEntity;
            this.stateInNamedEntity(c);
        }
    }
    stateInNamedEntity(c) {
        this.entityExcess += 1;
        this.trieIndex = determineBranch(this.entityTrie, this.trieCurrent, this.trieIndex + 1, c);
        if (this.trieIndex < 0) {
            this.emitNamedEntity();
            this.index--;
            return;
        }
        this.trieCurrent = this.entityTrie[this.trieIndex];
        const masked = this.trieCurrent & BinTrieFlags.VALUE_LENGTH;
        // If the branch is a value, store it and continue
        if (masked) {
            // The mask is the number of bytes of the value, including the current byte.
            const valueLength = (masked >> 14) - 1;
            // If we have a legacy entity while parsing strictly, just skip the number of bytes
            if (!this.allowLegacyEntity() && c !== CharCodes.Semi) {
                this.trieIndex += valueLength;
            }
            else {
                // Add 1 as we have already incremented the excess
                const entityStart = this.index - this.entityExcess + 1;
                if (entityStart > this.sectionStart) {
                    this.emitPartial(this.sectionStart, entityStart);
                }
                // If this is a surrogate pair, consume the next two bytes
                this.entityResult = this.trieIndex;
                this.trieIndex += valueLength;
                this.entityExcess = 0;
                this.sectionStart = this.index + 1;
                if (valueLength === 0) {
                    this.emitNamedEntity();
                }
            }
        }
    }
    emitNamedEntity() {
        this.state = this.baseState;
        if (this.entityResult === 0) {
            return;
        }
        const valueLength = (this.entityTrie[this.entityResult] & BinTrieFlags.VALUE_LENGTH) >>
            14;
        switch (valueLength) {
            case 1:
                this.emitCodePoint(this.entityTrie[this.entityResult] &
                    ~BinTrieFlags.VALUE_LENGTH);
                break;
            case 2:
                this.emitCodePoint(this.entityTrie[this.entityResult + 1]);
                break;
            case 3: {
                this.emitCodePoint(this.entityTrie[this.entityResult + 1]);
                this.emitCodePoint(this.entityTrie[this.entityResult + 2]);
            }
        }
    }
    stateBeforeNumericEntity(c) {
        if ((c | 0x20) === CharCodes.LowerX) {
            this.entityExcess++;
            this.state = State.InHexEntity;
        }
        else {
            this.state = State.InNumericEntity;
            this.stateInNumericEntity(c);
        }
    }
    emitNumericEntity(strict) {
        const entityStart = this.index - this.entityExcess - 1;
        const numberStart = entityStart + 2 + Number(this.state === State.InHexEntity);
        if (numberStart !== this.index) {
            // Emit leading data if any
            if (entityStart > this.sectionStart) {
                this.emitPartial(this.sectionStart, entityStart);
            }
            this.sectionStart = this.index + Number(strict);
            this.emitCodePoint(replaceCodePoint(this.entityResult));
        }
        this.state = this.baseState;
    }
    stateInNumericEntity(c) {
        if (c === CharCodes.Semi) {
            this.emitNumericEntity(true);
        }
        else if (isNumber(c)) {
            this.entityResult = this.entityResult * 10 + (c - CharCodes.Zero);
            this.entityExcess++;
        }
        else {
            if (this.allowLegacyEntity()) {
                this.emitNumericEntity(false);
            }
            else {
                this.state = this.baseState;
            }
            this.index--;
        }
    }
    stateInHexEntity(c) {
        if (c === CharCodes.Semi) {
            this.emitNumericEntity(true);
        }
        else if (isNumber(c)) {
            this.entityResult = this.entityResult * 16 + (c - CharCodes.Zero);
            this.entityExcess++;
        }
        else if (isHexDigit(c)) {
            this.entityResult =
                this.entityResult * 16 + ((c | 0x20) - CharCodes.LowerA + 10);
            this.entityExcess++;
        }
        else {
            if (this.allowLegacyEntity()) {
                this.emitNumericEntity(false);
            }
            else {
                this.state = this.baseState;
            }
            this.index--;
        }
    }
    allowLegacyEntity() {
        return (!this.xmlMode &&
            (this.baseState === State.Text ||
                this.baseState === State.InSpecialTag));
    }
    /**
     * Remove data that has already been consumed from the buffer.
     */
    cleanup() {
        // If we are inside of text or attributes, emit what we already have.
        if (this.running && this.sectionStart !== this.index) {
            if (this.state === State.Text ||
                (this.state === State.InSpecialTag && this.sequenceIndex === 0)) {
                this.cbs.ontext(this.sectionStart, this.index);
                this.sectionStart = this.index;
            }
        }
    }
    shouldContinue() {
        return this.index < this.buffer.length + this.offset && this.running;
    }
    /**
     * Iterates through the buffer, calling the function corresponding to the current state.
     *
     * States that are more likely to be hit are higher up, as a performance improvement.
     */
    parse() {
        while (this.shouldContinue()) {
            const c = this.buffer.charCodeAt(this.index - this.offset);
            switch (this.state) {
                case State.Text:
                    this.stateText(c);
                    break;
                case State.SpecialStartSequence:
                    this.stateSpecialStartSequence(c);
                    break;
                case State.InSpecialTag:
                    this.stateInSpecialTag(c);
                    break;
                case State.CDATASequence:
                    this.stateCDATASequence(c);
                    break;
                case State.InCommentLike:
                    this.stateInCommentLike(c);
                    break;
                case State.InSpecialComment:
                    this.stateInSpecialComment(c);
                    break;
                case State.InTagName:
                    this.stateInTagName(c);
                    break;
                case State.AfterTagName:
                    this.stateAfterTagName(c);
                    break;
                case State.InClosingTagName:
                    this.stateInClosingTagName(c);
                    break;
                case State.BeforeTagName:
                    this.stateBeforeTagName(c);
                    break;
                case State.BeforeClosingTagName:
                    this.stateBeforeClosingTagName(c);
                    break;
                case State.AfterClosingTagName:
                    this.stateAfterClosingTagName(c);
                    break;
                case State.BeforeSpecialS:
                    this.stateBeforeSpecialS(c);
                    break;
                case State.InSelfClosingTag:
                    this.stateInSelfClosingTag(c);
                    break;
                case State.InDeclaration:
                    this.stateInDeclaration(c);
                    break;
                case State.BeforeDeclaration:
                    this.stateBeforeDeclaration(c);
                    break;
                case State.BeforeComment:
                    this.stateBeforeComment(c);
                    break;
                case State.InProcessingInstruction:
                    this.stateInProcessingInstruction(c);
                    break;
                case State.InNamedEntity:
                    this.stateInNamedEntity(c);
                    break;
                case State.BeforeEntity:
                    this.stateBeforeEntity(c);
                    break;
                case State.InHexEntity:
                    this.stateInHexEntity(c);
                    break;
                case State.InNumericEntity:
                    this.stateInNumericEntity(c);
                    break;
                default:
                    // `this._state === State.BeforeNumericEntity`
                    this.stateBeforeNumericEntity(c);
                    break;
            }
            this.index++;
        }
        this.cleanup();
    }
    finish() {
        if (this.state === State.InNamedEntity) {
            this.emitNamedEntity();
        }
        // If there is remaining data, emit it in a reasonable way
        if (this.sectionStart < this.index) {
            this.handleTrailingData();
        }
        this.cbs.onend();
    }
    /** Handle any trailing data. */
    handleTrailingData() {
        const endIndex = this.buffer.length + this.offset;
        if (this.state === State.InCommentLike) {
            if (this.currentSequence === Sequences.CdataEnd) {
                this.cbs.oncdata(this.sectionStart, endIndex, 0);
            }
            else {
                this.cbs.oncomment(this.sectionStart, endIndex, 0);
            }
        }
        else if (this.state === State.InNumericEntity &&
            this.allowLegacyEntity()) {
            this.emitNumericEntity(false);
            // All trailing data will have been consumed
        }
        else if (this.state === State.InHexEntity &&
            this.allowLegacyEntity()) {
            this.emitNumericEntity(false);
            // All trailing data will have been consumed
        }
        else if (this.state === State.InTagName ||
            this.state === State.AfterTagName ||
            this.state === State.InClosingTagName) {
            /*
             * If we are currently in an opening or closing tag, us not calling the
             * respective callback signals that the tag should be ignored.
             */
        }
        else {
            this.cbs.ontext(this.sectionStart, endIndex);
        }
    }
    emitPartial(start, endIndex) {
        if (this.baseState === State.Text ||
            this.baseState === State.InSpecialTag) {
            this.cbs.ontext(start, endIndex);
        }
    }
    emitCodePoint(cp) {
        if (this.baseState === State.Text ||
            this.baseState === State.InSpecialTag) {
            this.cbs.ontextentity(cp);
        }
    }
}
//# sourceMappingURL=Tokenizer.js.map