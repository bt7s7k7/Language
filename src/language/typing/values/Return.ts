import { Span } from "../../Span"
import { Never } from "../types/base"
import { Value } from "../Value"

export class Return extends Value {
    constructor(
        span: Span,
        public readonly body: Value
    ) { super(span, Never.TYPE) }
}