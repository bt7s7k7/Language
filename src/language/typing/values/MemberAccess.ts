import { unreachable } from "../../../comTypes/util"
import { FunctionIRBuilder } from "../../emission/InstructionPrinter"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Primitives } from "../Primitives"
import { Type } from "../Type"
import { isRefValue } from "../types/Reference"
import { Value } from "../Value"

export class MemberAccess extends Value {

    public override emit(builder: FunctionIRBuilder) {
        if (isRefValue(this.target)) {
            this.target.emitPtr(builder)
            const offset = this.steps.reduce((a, v) => a + v.offset, 0)
            new Primitives.Number.Constant(Span.native, offset).emit(builder)
            builder.pushInstruction(Instructions.ADD, Instructions.Types.FLOAT64)
            builder.pushInstruction(Instructions.LOAD_PTR, this.type.size)

            return this.type.size
        } else return unreachable()
    }

    constructor(
        span: Span,
        public readonly target: Value,
        public readonly steps: MemberAccess.Property[]
    ) { super(span, steps.length > 0 ? steps[steps.length - 1].type : target.type) }
}

export namespace MemberAccess {
    export interface Property {
        type: Type
        offset: number
    }
}