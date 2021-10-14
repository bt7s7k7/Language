import { Span } from "../../Span"
import { SpecificFunction } from "../types/SpecificFunction"
import { Value } from "../Value"

export class Invocation extends Value {
    constructor(
        span: Span,
        public readonly func: SpecificFunction.Signature,
        public readonly args: Value[]
    ) { super(span, func.result) }
}