import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Void } from "../types/base"
import { Value } from "../Value"

export class WhileLoop extends Value {
    public emit(builder: FunctionIRBuilder) {
        const type = this.predicate.type
        const subtype = EmissionUtil.getTypeCode(type)

        const id = builder.nextID()
        const startLabel = `_while_${id}_start`
        const endLabel = `_while_${id}_end`

        builder.pushScope(`while_predicate_${id}`)

        builder.pushLabel(startLabel)
        EmissionUtil.safeEmit(builder, type.size, this.predicate)

        builder.popScope(1, true)

        builder.pushInstruction(Instructions.BR_FALSE, subtype, ["l:" + endLabel])

        builder.pushScope(`while_body_${id}`)

        this.body.emit(builder)

        builder.popScope(1, true)

        builder.pushInstruction(Instructions.BR, 0, ["l:" + startLabel])
        builder.pushLabel(endLabel)

        return 0
    }

    constructor(
        span: Span,
        public readonly predicate: Value,
        public readonly body: Value,
    ) { super(span, Void.TYPE) }
}