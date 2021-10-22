import exp = require("constants")
import { Diagnostic } from "../Diagnostic"
import { FunctionIRBuilder } from "../emission/InstructionPrinter"
import { Span } from "../Span"
import { Instructions } from "../vm/Instructions"
import { Type } from "./Type"
import { ConstExpr } from "./types/ConstExpr"
import { InstanceType } from "./types/InstanceType"
import { SpecificFunction } from "./types/SpecificFunction"
import { Value } from "./Value"

export namespace Double64 {
    export const TYPE = new class Double64 extends InstanceType {
        constructor() { super(Span.native, "number", 8) }
    }

    export class Constant extends Value {
        public emit(builder: FunctionIRBuilder) {
            builder.pushInstruction(Instructions.CONST, 8, [...new Uint32Array(new Float64Array([this.value]).buffer)])
            return 8
        }

        constructor(
            span: Span,
            public readonly value: number,
            type = Double64.TYPE
        ) { super(span, type) }
    }

    class ConstBinaryOperation extends SpecificFunction {
        public match(span: Span, args: Type[], argSpans: Span[]): SpecificFunction.Signature | Diagnostic {
            const types = SpecificFunction.testConstExpr<[number, number]>(span, [Double64.TYPE, Double64.TYPE], args, argSpans)
            if (types instanceof Diagnostic) return types

            const result = this.operation(types[0], types[1])

            return {
                target: this,
                arguments: args.map((v, i) => ({ name: "ab"[i], type: v })),
                result: new ConstExpr(span, Double64.TYPE, result)
            }
        }

        constructor(
            name: string,
            public readonly operation: (a: number, b: number) => number
        ) { super(Span.native, name) }
    }

    export const CONST_ADD = new ConstBinaryOperation("__operator_add", (a, b) => a + b)
    export const CONST_SUB = new ConstBinaryOperation("__operator_sub", (a, b) => a - b)
    export const CONST_MUL = new ConstBinaryOperation("__operator_mul", (a, b) => a * b)
    export const CONST_DIV = new ConstBinaryOperation("__operator_div", (a, b) => a / b)
    export const CONST_MOD = new ConstBinaryOperation("__operator_mod", (a, b) => a % b)
    export const CONST_EQ = new ConstBinaryOperation("__operator_eq", (a, b) => +(a == b))
    export const CONST_LT = new ConstBinaryOperation("__operator_lt", (a, b) => +(a < b))
    export const CONST_GT = new ConstBinaryOperation("__operator_gt", (a, b) => +(a > b))
    export const CONST_LTE = new ConstBinaryOperation("__operator_lte", (a, b) => +(a <= b))
    export const CONST_GTE = new ConstBinaryOperation("__operator_gte", (a, b) => +(a >= b))

    export const CONST_NEGATE = new class extends SpecificFunction {
        public match(span: Span, args: Type[], argSpans: Span[]): SpecificFunction.Signature | Diagnostic {
            const types = SpecificFunction.testConstExpr<[number]>(span, [Double64.TYPE], args, argSpans)
            if (types instanceof Diagnostic) return types

            const result = -types[0]

            return {
                target: this,
                arguments: args.map((v, i) => ({ name: "a"[i], type: v })),
                result: new ConstExpr(span, Double64.TYPE, result)
            }
        }

        constructor() { super(Span.native, "__operator__negate") }

    }
}