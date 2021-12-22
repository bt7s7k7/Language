import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Void } from "../types/base"
import { Value } from "../Value"

export class IfStatement extends Value {

    public emit(builder: FunctionIRBuilder) {
        const type = this.predicate.type
        const subtype = EmissionUtil.getTypeCode(type)
        EmissionUtil.safeEmit(builder, type.size, this.predicate)


        const id = builder.nextID()
        builder.pushScope(`if_${id}`)
        const ifFalseLabel = `_if_${id}_else`
        const endLabel = `_if_${id}_else_end`

        builder.pushInstruction(Instructions.BR_FALSE, subtype, ["l:" + ifFalseLabel])
        this.body.emit(builder)
        builder.popScope(1, true)
        if (this.bodyElse) {
            builder.pushScope(`if_else_${id}`)
            builder.pushInstruction(Instructions.BR, 0, ["l:" + endLabel])
            builder.pushLabel(ifFalseLabel)
            this.bodyElse.emit(builder)
            builder.pushLabel(endLabel)
            builder.popScope(1, true)
        } else {
            builder.pushLabel(ifFalseLabel)
        }

        return this.type.size
    }

    constructor(
        span: Span,
        public readonly returns: boolean,
        public readonly predicate: Value,
        public readonly body: Value,
        public readonly bodyElse: Value | null
    ) { super(span, returns ? body.type : Void.TYPE) }
}