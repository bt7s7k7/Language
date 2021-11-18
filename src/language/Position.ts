import { SourceFile } from "./parsing/SourceFile"
import { Span } from "./Span"

export class Position {
    public span(length: number) {
        if (length < 0) {
            return new Span(new Position(this.line, this.column + length, this.file), -length)
        }
        return new Span(this, length)
    }

    constructor(
        public readonly line: number,
        public readonly column: number,
        public readonly file: SourceFile
    ) { }
}