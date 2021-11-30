import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Void } from "../types/base"
import { Value } from "../Value"

export class Block extends Value {

    public override emit(builder: FunctionIRBuilder) {
        for (const statement of this.statements) {
            const size = statement.emit(builder)
            if (size > 0) {
                if (builder.lastInstruction && builder.lastInstruction.code == Instructions.LOAD && builder.lastInstruction.subtype == size) {
                    builder.popInstruction()
                } else {
                    builder.pushInstruction(Instructions.DROP, size)
                }
            }
        }
        return 0
    }

    constructor(
        span: Span,
        public readonly statements: Value[]
    ) { super(span, Void.TYPE) }
}