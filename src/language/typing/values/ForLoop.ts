import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/InstructionPrinter"
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

        this.initializer?.emit(builder)

        builder.pushLabel(startLabel)
        if (this.predicate) {
            const type = this.predicate.type
            const subtype = EmissionUtil.getTypeCode(type)

            EmissionUtil.safeEmit(builder, type.size, this.predicate)
            builder.pushInstruction(Instructions.BR_FALSE, subtype, ["l:" + endLabel])
        }
        this.body.emit(builder)
        builder.pushLabel(incrementLabel)
        this.increment?.emit(builder)
        builder.pushInstruction(Instructions.BR, 0, ["l:" + startLabel])
        builder.pushLabel(endLabel)

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