import { FunctionIRBuilder } from "../../emission/InstructionPrinter"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Value } from "../Value"
import { Variable } from "./Variable"

export class VariableDereference extends Value {

    public emit(builder: FunctionIRBuilder) {
        builder.pushInstruction(Instructions.LOAD, this.variable.type.size, [this.variable.name])
        return this.variable.type.size
    }

    constructor(
        span: Span,
        public readonly variable: Variable
    ) { super(span, variable.type) }
}