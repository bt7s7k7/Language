import { Span } from "../../Span"
import { Void } from "../types/base"
import { Value } from "../Value"

export class NOP extends Value {
    public override emit() { return 0 }

    constructor(span: Span) { super(span, Void.TYPE) }
}