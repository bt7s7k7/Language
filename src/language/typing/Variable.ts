import { Span } from "../Span"
import { Type } from "./Type"

export class Variable {
    constructor(
        public readonly span: Span,
        public readonly type: Type
    ) { }
}