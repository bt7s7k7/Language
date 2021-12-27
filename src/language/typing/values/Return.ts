import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Never } from "../types/base"
import { Value } from "../Value"

export class Return extends Value {

    public override emit(builder: FunctionIRBuilder) {
        if (this.body) {
            const size = this.body.emit(builder)
            builder.pushInstruction(Instructions.STORE, size, [EmissionUtil.RETURN_VARIABLE_NAME])
        }

        builder.popScope("all", false)
        builder.pushInstruction(Instructions.RETURN)
        return 0
    }

    constructor(
        span: Span,
        public readonly body: Value | null
    ) { super(span, Never.TYPE) }
}