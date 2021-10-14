import { Span } from "../../Span"
import { Void } from "../types/base"
import { Value } from "../Value"

export class NOP extends Value {
    constructor(span: Span) { super(span, Void.TYPE) }
}