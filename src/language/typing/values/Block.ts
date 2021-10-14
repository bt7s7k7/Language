import { Span } from "../../Span"
import { Void } from "../types/base"
import { Value } from "../Value"

export class Block extends Value {
    constructor(
        span: Span,
        public readonly exprs: Value[]
    ) { super(span, Void.TYPE) }
}