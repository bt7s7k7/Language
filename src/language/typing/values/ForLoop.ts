import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Void } from "../types/base"
import { Value } from "../Value"

export class ForLoop extends Value {

    public emit(builder: FunctionIRBuilder) {
        const id = builder.nextID()
        const startLabel = `_for_${id}_start`
        const incrementLabel = `_for_${id}_inc`
        const endLabel = `_for_${id}_end`

        builder.pushScope(`for_init_${id}`)

        {
            const size = this.initializer?.emit(builder)
            if (size != null && size > 0) {
                builder.pushInstruction(Instructions.DROP, size)
            }
        }

        builder.pushLabel(startLabel)
        if (this.predicate) {
            builder.pushScope(`for_predicate_${id}`)

            const type = this.predicate.type
            const subtype = EmissionUtil.getTypeCode(type)

            EmissionUtil.safeEmit(builder, type.size, this.predicate)

            builder.popScope(1, true)

            builder.pushInstruction(Instructions.BR_FALSE, subtype, ["l:" + endLabel])
        }

        builder.pushScope(`for_body_${id}`)

        EmissionUtil.safeEmit(builder, 0, this.body)
        builder.pushLabel(incrementLabel)

        {
            const size = this.increment?.emit(builder)
            if (size != null && size > 0) {
                builder.pushInstruction(Instructions.DROP, size)
            }
        }

        builder.popScope(1, true)

        builder.pushInstruction(Instructions.BR, 0, ["l:" + startLabel])
        builder.pushLabel(endLabel)

        if (this.initializer) builder.popScope(1, true)

        return 0
    }

    constructor(
        span: Span,
        public readonly initializer: Value | null,
        public readonly predicate: Value | null,
        public readonly increment: Value | null,
        public readonly body: Value,
    ) { super(span, Void.TYPE) }
}