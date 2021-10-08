import { Span } from "../../Span"
import { Never } from "../types/base"
import { Variable } from "../Variable"

export class Return extends Variable {
    constructor(
        span: Span,
        public readonly body: Variable
    ) { super(span, Never.TYPE) }
}