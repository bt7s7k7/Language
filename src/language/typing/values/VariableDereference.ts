import { Span } from "../../Span"
import { Value } from "../Value"

export class VariableDereference extends Value {
    constructor(
        span: Span,
        public readonly variable: Value
    ) { super(span, variable.type) }
}