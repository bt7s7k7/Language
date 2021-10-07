import { SourceFile } from "./parsing/SourceFile"
import { Span } from "./Span"

export class Position {
    public span(length: number) {
        return new Span(this, length)
    }

    constructor(
        public readonly line: number,
        public readonly column: number,
        public readonly file: SourceFile
    ) { }
}