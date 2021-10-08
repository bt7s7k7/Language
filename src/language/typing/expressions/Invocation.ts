import { Span } from "../../Span"
import { SpecificFunction } from "../types/SpecificFunction"
import { Variable } from "../Variable"

export class Invocation extends Variable {
    constructor(
        span: Span,
        public readonly func: SpecificFunction,
        public readonly args: Variable[]
    ) { super(span, func.result) }
}