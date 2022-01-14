import { FORMAT } from "../textFormat/Formatter"
import { SourceFile } from "./parsing/SourceFile"
import { Position } from "./Position"

let _native: Span | null = null

export class Span {
    public format(variant: Exclude<keyof typeof FORMAT, "use"> = "danger") {
        const lineText = this.pos.file.getLine(this.pos.line)
        const mark = " ".repeat(this.pos.column) + FORMAT[variant](this.length == 1 ? "^" : "~".repeat(this.length))

        return FORMAT.secondary(this.pos.line + " | ") + lineText + "\n" + " ".repeat(this.pos.line.toString().length + 3) + mark
    }

    constructor(
        public readonly pos: Position,
        public readonly length: number
    ) { }

    public static get native() {
        if (_native) return _native
        return _native = new Span(new Position(0, 0, new SourceFile("<native>", "")), 1)
    }
}