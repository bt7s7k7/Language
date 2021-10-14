import { Span } from "../../Span"
import { Void } from "../types/base"
import { Value } from "../Value"

export class IfStatement extends Value {
    constructor(
        span: Span,
        public readonly returns: boolean,
        public readonly predicate: Value,
        public readonly body: Value,
        public readonly bodyElse: Value | null
    ) { super(span, returns ? body.type : Void.TYPE) }
}