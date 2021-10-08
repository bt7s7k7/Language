export namespace CharClass {
    export function isWhitespace(c: string) {
        return c == " " || c == "\t" || c == "\n" || c == "\r"
    }

    const [CODE_ZERO, CODE_NINE, CODE_A, CODE_Z, CODE_AA, CODE_ZZ, CODE_F, CODE_FF] = "09azAZfF".split("").map(v => v.charCodeAt(0))

    export function isHexDigit(c: string) {
        const code = c.charCodeAt(0)
        return isNumeric(c) ||
            (code >= CODE_A && code <= CODE_F) ||
            (code >= CODE_AA && code <= CODE_FF)
    }

    export function isNumeric(c: string) {
        const code = c.charCodeAt(0)
        return code >= CODE_ZERO && code <= CODE_NINE
    }

    export function isAlpha(c: string) {
        const code = c.charCodeAt(0)
        return (
            (code >= CODE_A && code <= CODE_Z) ||
            (code >= CODE_AA && code <= CODE_ZZ)
        )
    }

    export function isAlphanumeric(c: string) {
        return isAlpha(c) || isNumeric(c)
    }

    export function isWord(c: string) {
        return isAlphanumeric(c) || c == "_" || c == "$" || c == "@"
    }
}