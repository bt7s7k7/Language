import { Span } from "../../Span"
import { Variable } from "../Variable"

export class VariableDereference extends Variable {
    constructor(
        span: Span,
        public readonly variable: Variable
    ) { super(span, variable.type) }
}