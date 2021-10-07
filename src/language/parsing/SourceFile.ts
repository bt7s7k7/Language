import { findNthOccurrence, unreachable, voidValue } from "../../comTypes/util"

export class SourceFile {
    public getLine(number: number) {
        const start = number == 0 ? 0 : ((voidValue(findNthOccurrence(this.content, "\n", number), -1) ?? unreachable()) + 1)
        const end = voidValue(this.content.indexOf("\n", start), -1) ?? this.content.length

        return this.content.slice(start, end)
    }

    constructor(
        public readonly path: string,
        public readonly content: string
    ) { }
}