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

    public emitStore(builder: FunctionIRBuilder) {
        if (this.isDeclaration) {
            builder.registerVariable("variables", this.span, this.variable.name, this.variable.type.size)
        }
        builder.pushInstruction(Instructions.STORE, this.variable.type.size, [this.variable.name])
    }

    constructor(
        span: Span,
        public readonly variable: Variable,
        public readonly isDeclaration: boolean = false
    ) { super(span, variable.type) }
}