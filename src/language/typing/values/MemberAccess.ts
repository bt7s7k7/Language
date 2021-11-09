import { transform, unreachable } from "../../../comTypes/util"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Primitives } from "../Primitives"
import { Type } from "../Type"
import { IRefValue, isRefValue, Reference } from "../types/Reference"
import { Value } from "../Value"

export class MemberAccess extends Value implements IRefValue {
    public override emit(builder: FunctionIRBuilder) {
        if (isRefValue(this.target)) {
            this.emitPtr(builder)
            builder.pushInstruction(Instructions.LOAD_PTR, this.type.size)
            return this.type.size
        } else return unreachable()
    }

    public emitPtr(builder: FunctionIRBuilder) {
        if (!isRefValue(this.target)) throw unreachable()
        this.target.emitPtr(builder)
        const offset = this.steps.reduce((a, v) => a + v.offset, 0)
        new Primitives.Number.Constant(Span.native, offset).emit(builder)
        builder.pushInstruction(Instructions.ADD, Instructions.Types.FLOAT64)
    }

    public emitStore(builder: FunctionIRBuilder) {
        if (!isRefValue(this.target)) throw unreachable()
        this.emitPtr(builder)
        builder.pushInstruction(Instructions.STORE_PTR, this.type.size)
    }

    constructor(
        span: Span,
        public readonly target: Value,
        public readonly steps: MemberAccess.Property[]
    ) {
        super(span, transform(steps.length > 0 ? steps[steps.length - 1].type : target.type, v => isRefValue(target) ? new Reference(v) : v))
    }
}

export namespace MemberAccess {
    export interface Property {
        type: Type
        offset: number
    }
}