import { Span } from "../../Span"
import { Void } from "../types/base"
import { Variable } from "../Variable"

export class IfStatement extends Variable {
    constructor(
        span: Span,
        public readonly returns: boolean,
        public readonly predicate: Variable,
        public readonly body: Variable,
        public readonly bodyElse: Variable | null
    ) { super(span, returns ? body.type : Void.TYPE) }
}