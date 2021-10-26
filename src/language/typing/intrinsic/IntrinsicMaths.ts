import exp = require("constants")
import { Diagnostic } from "../../Diagnostic"
import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/InstructionPrinter"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Primitives } from "../Primitives"
import { Type } from "../Type"
import { Never } from "../types/base"
import { SpecificFunction } from "../types/SpecificFunction"
import { Invocation } from "../values/Invocation"
import { VariableDereference } from "../values/VariableDereference"
import { IntrinsicFunction } from "./IntrinsicFunction"

abstract class Operation extends IntrinsicFunction {
    public match(span: Span, args: Type[], argSpans: Span[]): SpecificFunction.Signature | Diagnostic {
        const type = args[0] ?? Never.TYPE
        const target = Array.from({ length: this.arity }, (_, i): SpecificFunction.Argument => ({ name: "ab"[i], type }))
        const error = SpecificFunction.testArguments(span, target, args, argSpans)
        if (error) return error

        return {
            span: this.span,
            target: this,
            arguments: target,
            result: type
        }
    }

    constructor(
        name: string,
        public readonly arity: number
    ) { super(Span.native, `${name}<T extends any_number>(${Array.from({ length: arity }, () => "T").join(", ")}): T`) }
}

export namespace IntrinsicMaths {
    class BinaryOperation extends Operation {
        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const type = invocation.type
            const subtype = EmissionUtil.getTypeCode(type)

            EmissionUtil.safeEmit(builder, type.size, invocation.args[0])
            EmissionUtil.safeEmit(builder, type.size, invocation.args[1])

            builder.pushInstruction(this.instruction, subtype)

            return type.size
        }

        constructor(
            name: string,
            public readonly instruction: number
        ) { super(name, 2) }
    }

    export const ADD = new BinaryOperation("__operator_add", Instructions.ADD)
    export const SUB = new BinaryOperation("__operator_sub", Instructions.SUB)
    export const MUL = new BinaryOperation("__operator_mul", Instructions.MUL)
    export const DIV = new BinaryOperation("__operator_div", Instructions.DIV)
    export const MOD = new BinaryOperation("__operator_mod", Instructions.MOD)
    export const EQ = new BinaryOperation("__operator_eq", Instructions.EQ)
    export const LT = new BinaryOperation("__operator_lt", Instructions.LT)
    export const GT = new BinaryOperation("__operator_gt", Instructions.GT)
    export const LTE = new BinaryOperation("__operator_lt", Instructions.LTE)
    export const GTE = new BinaryOperation("__operator_gt", Instructions.GTE)
    export const NEGATE = new class extends Operation {
        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const type = invocation.type
            const subtype = EmissionUtil.getTypeCode(type)
            const constant = (type as any)["CONSTANT"] as null | (typeof Primitives.Number.Constant)
            if (!constant) throw new Error("Cannot create constant for type " + type.name)

            EmissionUtil.safeEmit(builder, type.size, invocation.args[0])
            EmissionUtil.safeEmit(builder, type.size, new constant(Span.native, -1))

            builder.pushInstruction(Instructions.MUL, subtype)

            return type.size
        }

        constructor() { super("__operator__negate", 1) }
    }

    export class Assignment extends Operation {
        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const type = invocation.type
            const subtype = EmissionUtil.getTypeCode(type)
            const variable = invocation.args[0]
            if (!(variable instanceof VariableDereference)) throw new Error("Assignment target is not a variable")

            EmissionUtil.safeEmit(builder, type.size, invocation.args[1])
            variable.emitStore(builder)

            return 0
        }

        constructor() { super("__operator_assign", 2) }
    }
}