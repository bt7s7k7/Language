import { Span } from "../../Span"
import { Type } from "../Type"
import { SpecificFunction } from "../types/SpecificFunction"
import { Variable } from "../Variable"

export class Invocation extends Variable {
    constructor(
        span: Span,
        public readonly func: SpecificFunction,
        public readonly args: Variable[],
        result: Type
    ) { super(span, result) }
}