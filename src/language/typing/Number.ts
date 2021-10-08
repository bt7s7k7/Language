import exp = require("constants")
import { Span } from "../Span"
import { InstanceType } from "./types/InstanceType"
import { Variable } from "./Variable"

export namespace Double64 {
    export const TYPE = new class Double64 extends InstanceType {
        constructor() { super(Span.native, "number") }
    }

    export class Constant extends Variable {
        constructor(
            span: Span,
            public readonly value: number,
            type = Double64.TYPE
        ) { super(span, type) }
    }
}