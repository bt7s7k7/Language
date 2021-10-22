import { Span } from "../../Span"
import { Type } from "../Type"
import { Value } from "../Value"

export class Variable extends Value {
    constructor(
        span: Span, type: Type,
        public readonly name: string
    ) { super(span, type) }
}