import { Span } from "../../Span"
import { Void } from "../types/base"
import { Variable } from "../Variable"

export class Block extends Variable {
    constructor(
        span: Span,
        public readonly exprs: Variable[]
    ) { super(span, Void.TYPE) }
}