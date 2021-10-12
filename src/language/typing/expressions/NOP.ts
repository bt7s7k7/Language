import { Span } from "../../Span"
import { Void } from "../types/base"
import { Variable } from "../Variable"

export class NOP extends Variable {
    constructor(span: Span) { super(span, Void.TYPE) }
}