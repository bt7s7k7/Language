import { Span } from "../../Span"
import { Type } from "../Type"

export class Pointer extends Type {
    constructor(
        span: Span,
        public readonly type: Type,
    ) { super(span, "*" + type.name, 8) }
}