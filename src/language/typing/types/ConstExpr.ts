import { Span } from "../../Span"
import { stringifyValue } from "../../util"
import { Type } from "../Type"

export class ConstExpr extends Type {
    public assignableTo(other: Type) {
        return super.assignableTo(other) || this.type.assignableTo(other)
    }

    constructor(
        span: Span,
        public readonly type: Type,
        public readonly value: any
    ) { super(span, `<${type.name}> ${stringifyValue(value)}`) }
}
