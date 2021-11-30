import { Diagnostic } from "../../Diagnostic"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { Type } from "../Type"
import { Invocation } from "../values/Invocation"
import { isConstexpr } from "./ConstExpr"
import { SpecificFunction } from "./SpecificFunction"

export namespace Never {
    export const TYPE = new class Never extends Type {
        constructor() { super(Span.native, "Never", Type.NOT_INSTANTIABLE) }
    }
}

export namespace Void {
    export const TYPE = new class Void extends Type {
        constructor() { super(Span.native, "Void", 0) }
    }
}

export const REINTERPRET_OPERATOR = new class ReinterpretOperator extends IntrinsicFunction {
    public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic | Diagnostic[] {
        if (args.length != 2) return new Diagnostic("Expected 1 argument", span)
        const constexpr = args[1].type
        if (!isConstexpr<Type>(constexpr, Type.TYPE)) return new Diagnostic("Expected constant type", span)
        const target = constexpr.value
        if (target.size != args[0].type.size) throw new Diagnostic("Size of the new type must match the size of the original", args[1].span)

        return {
            target: this,
            arguments: [{ name: "value", type: args[0].type }, { name: "target_type", type: args[1].type }],
            result: target
        }
    }

    public emit(builder: FunctionIRBuilder, invocation: Invocation): number {
        const size = invocation.args[0].emit(builder)
        return size
    }

    constructor() { super(Span.native, "@reinterpret") }
}