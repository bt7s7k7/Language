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
                // Skip redundant load instruction
                if (builder.lastInstruction && builder.lastInstruction.code == Instructions.LOAD && builder.lastInstruction.subtype == size) {
                    builder.popInstruction()
                } else {
                    builder.pushInstruction(Instructions.DROP, size)
                }

                // Optimization for statement level assignments, by default they return the
                // assigned value by copy so we can remove the copy and drop
                //if (builder.instructions.length >= 3) {
                //    const [copy, store, drop] = builder.instructions.slice(-3)
                //    if (
                //        "code" in copy && copy.code == Instructions.STACK_COPY && copy.subtype == size &&
                //        "code" in store && store.code == Instructions.STORE && store.subtype == size &&
                //        "code" in drop && drop.code == Instructions.DROP && drop.subtype == size
                //    ) {
                //        builder.instructions.splice(builder.instructions.length - 1, 1)
                //        builder.instructions.splice(builder.instructions.length - 2, 1)
                //    }
                //}
            }
        }
        return 0
    }

    constructor(
        span: Span,
        public readonly statements: Value[]
    ) { super(span, Void.TYPE) }
}