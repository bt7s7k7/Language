import { FORMAT } from "../textFormat/Formatter"
import { Span } from "./Span"

export class Diagnostic {
    public format(): string {
        return (
            FORMAT.primary(this.span.pos.file.path) + ":" +
            FORMAT.warning((this.span.pos.line + 1).toString()) + ":" +
            FORMAT.warning((this.span.pos.column + 1).toString()) + " : " +
            this.message + "\n\n" + this.span.format()
        ) + (
                this.children ? "\n" + this.children.map(v => "    " + v.format().replace(/\n/g, "\n    ")).join("\n") : ""
            )
    }

    constructor(
        public message: string,
        public readonly span: Span,
        public readonly children: Diagnostic[] = []
    ) { }
}