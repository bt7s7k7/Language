import { unreachable } from "../../../comTypes/util"
import { Span } from "../../Span"
import { Type } from "../Type"
import { Reference } from "../types/Reference"
import { Value } from "../Value"

export class Variable extends Value {
    constructor(
        span: Span, type: Type,
        public readonly name: string
    ) {
        super(span, type)
        if (type instanceof Reference) throw unreachable()
    }
}