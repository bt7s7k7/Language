import { SourceFile } from "./parsing/SourceFile"
import { Position } from "./Position"

let _native: Span | null = null

export class Span {
    constructor(
        public readonly pos: Position,
        public readonly length: number
    ) { }

    public static get native() {
        if (_native) return _native
        return _native = new Span(new Position(0, 0, new SourceFile("<native>", "")), 1)
    }
}