import { Span } from "../Span"
import { Type } from "./Type"

export class Value {
    constructor(
        public readonly span: Span,
        public readonly type: Type
    ) { }
}