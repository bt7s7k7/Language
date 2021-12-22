import { unreachable } from "../../../comTypes/util"
import { Diagnostic } from "../../Diagnostic"
import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Primitives } from "../Primitives"
import { Never } from "../types/base"
import { IIntrinsicRefFunction, isRefValue, Reference } from "../types/Reference"
import { SpecificFunction } from "../types/SpecificFunction"
import { normalizeType } from "../util"
import { Invocation } from "../values/Invocation"
import { IntrinsicFunction } from "./IntrinsicFunction"

abstract class Operation extends IntrinsicFunction {
    public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
        let type = normalizeType(args[0].type ?? Never.TYPE)
        if (this.config.requirePrimitive && !EmissionUtil.tryGetTypeCode(type)) return new Diagnostic(`Type "${type.name}" is not primitive`, args[0].span)
        const target = Array.from({ length: this.arity }, (_, i): SpecificFunction.Argument => ({ name: "ab"[i], type }))
        if (this.config.requireTargetReference) target[0].type = new Reference(target[0].type)
        const error = SpecificFunction.testArguments(span, target, args)
        if (error) return error

        return {
            span: this.span,
            target: this,
            arguments: target,
            result: this.config.resultIsReference ? new Reference(type) : type
        }
    }

    constructor(
        name: string,
        public readonly arity: number,
        public readonly config: { requireTargetReference?: boolean, requirePrimitive?: boolean, resultIsReference?: boolean } = {},
    ) { super(Span.native, `${name}<T extends any_number>(${Array.from({ length: arity }, () => "T").join(", ")}): T`) }
}

export namespace IntrinsicMaths {
    class BinaryOperation extends Operation {
        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const type = normalizeType(invocation.type)
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
            const type = normalizeType(invocation.type)
            const subtype = EmissionUtil.getTypeCode(type)
            const constant = (type as any)["CONSTANT"] as null | (typeof Primitives.Number.Constant)
            if (!constant) throw new Error("Cannot create constant for type " + type.name)

            EmissionUtil.safeEmit(builder, type.size, invocation.args[0])
            EmissionUtil.safeEmit(builder, type.size, new constant(Span.native, -1))

            builder.pushInstruction(Instructions.MUL, subtype)

            return type.size
        }

        constructor() { super("@negate", 1) }
    }

    class ShortCircuitOperation extends Operation {
        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const type = normalizeType(invocation.type)
            const subtype = EmissionUtil.getTypeCode(type)
            const constant = (type as any)["CONSTANT"] as null | (typeof Primitives.Number.Constant)
            if (!constant) throw new Error("Cannot create constant for type " + type.name)

            const endLabel = "sh_" + builder.nextID() + "_end"
            const otherLabel = "sh_" + builder.nextID() + "_other"

            EmissionUtil.safeEmit(builder, type.size, invocation.args[0])
            builder.pushInstruction(this.invert ? Instructions.BR_FALSE : Instructions.BR_TRUE, subtype, ["l:" + otherLabel])
            EmissionUtil.safeEmit(builder, type.size, new constant(Span.native, this.invert ? 1 : 0))
            builder.pushInstruction(Instructions.BR, 0, ["l:" + endLabel])
            builder.pushLabel(otherLabel)
            EmissionUtil.safeEmit(builder, type.size, invocation.args[1])
            builder.pushLabel(endLabel)

            return type.size
        }

        constructor(name: string, public readonly invert: boolean) { super(name, 2) }
    }

    export const AND = new ShortCircuitOperation("__operator_and", false)
    export const OR = new ShortCircuitOperation("__operator_or", true)

    export class Assignment extends Operation implements IIntrinsicRefFunction {
        public override emit(builder: FunctionIRBuilder, invocation: Invocation, noCopy = false) {
            const type = normalizeType(invocation.type)
            const variable = invocation.args[0]
            if (!isRefValue(variable)) throw new Error(`Assignment target '${variable.constructor.name}' is not a ref value`)

            EmissionUtil.safeEmit(builder, type.size, invocation.args[1])
            if (!noCopy) builder.pushInstruction(Instructions.STACK_COPY, type.size)
            variable.emitStore(builder)

            return type.size
        }

        public emitStore(builder: FunctionIRBuilder, invocation: Invocation): void {
            this.emit(builder, invocation, !!"dont copy")

            if (!isRefValue(invocation.args[0])) unreachable()
            invocation.args[0].emitStore(builder)
        }

        public emitPtr(builder: FunctionIRBuilder, invocation: Invocation): void {
            this.emit(builder, invocation, !!"dont copy")

            if (!isRefValue(invocation.args[0])) unreachable()
            invocation.args[0].emitPtr(builder)
        }


        constructor() { super("__operator_assign", 2, { requireTargetReference: true, requirePrimitive: false, resultIsReference: true }) }
    }
}