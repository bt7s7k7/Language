import { unreachable } from "../../comTypes/util"
import { Diagnostic } from "../Diagnostic"
import { EmissionUtil } from "../emission/EmissionUtil"
import { FunctionIRBuilder } from "../emission/FunctionIRBuilder"
import { Span } from "../Span"
import { Instructions } from "../vm/Instructions"
import { AnyTypedArrayCtor } from "../vm/types"
import { IntrinsicFunction } from "./intrinsic/IntrinsicFunction"
import { Never } from "./types/base"
import { ConstExpr } from "./types/ConstExpr"
import { InstanceType } from "./types/InstanceType"
import { SpecificFunction } from "./types/SpecificFunction"
import { normalizeType } from "./util"
import { Value } from "./Value"
import { Invocation } from "./values/Invocation"

function createNumber(name: string, size: number, container: AnyTypedArrayCtor) {
    const TYPE = new class Number extends InstanceType {
        constructor() { super(Span.native, name, size) }
    }

    const ALIGNED_SIZE = Math.ceil(size / 4) * 4
    const ALIGNMENT_PADDING = 0//ALIGNED_SIZE - size
    class Constant extends Value {
        public emit(builder: FunctionIRBuilder) {
            const temp = new Uint8Array(ALIGNED_SIZE)
            const data = new container([this.value]).buffer
            temp.set(new Uint8Array(data), ALIGNMENT_PADDING)
            builder.pushInstruction(Instructions.CONST, size, [...new Uint32Array(temp.buffer)])
            return size
        }

        constructor(
            span: Span,
            public readonly value: number,
            type = TYPE
        ) { super(span, type) }
    }

    Object.assign(TYPE, { "CONSTANT": Constant })

    class ConstBinaryOperation extends SpecificFunction {
        public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const types = SpecificFunction.testConstExpr<[number, number]>(span, [TYPE, TYPE], args)
            if (types instanceof Diagnostic) return types

            const result = this.operation(types[0], types[1])

            return {
                target: this,
                arguments: args.map((v, i) => ({ name: "ab"[i], type: v.type })),
                result: new ConstExpr(span, TYPE, result)
            }
        }

        constructor(
            name: string,
            public readonly operation: (a: number, b: number) => number
        ) { super(Span.native, name) }
    }

    const CTOR = new class PrimitiveCtor extends IntrinsicFunction {
        public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): Diagnostic | SpecificFunction.Signature | Diagnostic[] {
            let type = normalizeType(args[0].type ?? Never.TYPE)
            if (!EmissionUtil.tryGetTypeCode(type)) return new Diagnostic(`Type "${type.name}" is not primitive`, args[0].span)

            return {
                target: this,
                arguments: [{ name: "source", type }],
                result: TYPE
            }
        }

        public emit(builder: FunctionIRBuilder, invocation: Invocation): number {
            invocation.args[0].emit(builder)

            const source = invocation.signature.arguments[0].type
            const sourceCode = EmissionUtil.tryGetTypeCode(source) ?? unreachable()

            builder.pushInstruction(Instructions.NUM_CNV, sourceCode | (EmissionUtil.getTypeCode(TYPE) << 8))

            return size
        }

        constructor() { super(Span.native, name) }
    }

    return {
        TYPE,
        CTOR,
        Constant,
        CONST_ADD: new ConstBinaryOperation("__operator_add", (a, b) => a + b),
        CONST_SUB: new ConstBinaryOperation("__operator_sub", (a, b) => a - b),
        CONST_MUL: new ConstBinaryOperation("__operator_mul", (a, b) => a * b),
        CONST_DIV: new ConstBinaryOperation("__operator_div", (a, b) => a / b),
        CONST_MOD: new ConstBinaryOperation("__operator_mod", (a, b) => a % b),
        CONST_EQ: new ConstBinaryOperation("__operator_eq", (a, b) => +(a == b)),
        CONST_LT: new ConstBinaryOperation("__operator_lt", (a, b) => +(a < b)),
        CONST_GT: new ConstBinaryOperation("__operator_gt", (a, b) => +(a > b)),
        CONST_LTE: new ConstBinaryOperation("__operator_lte", (a, b) => +(a <= b)),
        CONST_GTE: new ConstBinaryOperation("__operator_gte", (a, b) => +(a >= b)),
        CONST_NEGATE: new class extends SpecificFunction {
            public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
                const types = SpecificFunction.testConstExpr<[number]>(span, [TYPE], args)
                if (types instanceof Diagnostic) return types

                const result = -types[0]

                return {
                    target: this,
                    arguments: args.map((v, i) => ({ name: "a"[i], type: v.type })),
                    result: new ConstExpr(span, TYPE, result)
                }
            }

            constructor() { super(Span.native, "@negate") }

        }
    }
}

export namespace Primitives {
    export const Number = createNumber("Number", 8, Float64Array)
    export const Char = createNumber("Char", 1, Uint8Array)
}