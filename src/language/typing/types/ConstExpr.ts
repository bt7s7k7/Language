import { unreachable } from "../../../comTypes/util"
import { Span } from "../../Span"
import { stringifyValue } from "../../util"
import { Type } from "../Type"

export function isConstexpr<T>(target: unknown, type: Type): target is ConstExpr<T> {
    return target instanceof ConstExpr && target.type.assignableTo(type)
}

export class ConstExpr<T = any> extends Type {
    public assignableTo(other: Type): boolean {
        return super.assignableTo(other) || this.type.assignableTo(other) || (other instanceof ConstExpr && this.type.assignableTo(other.type) && this.value == other.value)
    }

    constructor(
        span: Span,
        public readonly type: Type,
        public readonly value: T
    ) {
        super(span, `<${type.name}> ${value instanceof Type ? value.name : stringifyValue(value)}`, type.size)
        if (type instanceof ConstExpr) {
            unreachable()
        }
    }

    public static removeConstexpr(type: Type) {
        return type instanceof ConstExpr ? type.type : type
    }
}
