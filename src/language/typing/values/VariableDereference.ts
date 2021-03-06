import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Type } from "../Type"
import { IRefValue, Reference } from "../types/Reference"
import { Value } from "../Value"
import { Variable } from "./Variable"

export class VariableDereference extends Value implements IRefValue {
    public emit(builder: FunctionIRBuilder) {
        if (this.accessType == "declaration") {
            builder.registerVariable("variables", this.span, this.variable.name, this.variable.type.size)
        }

        builder.pushInstruction(Instructions.LOAD, this.variable.type.size, [this.variable.name])
        return this.variable.type.size
    }

    public emitStore(builder: FunctionIRBuilder) {
        if (this.accessType == "declaration") {
            builder.registerVariable("variables", this.span, this.variable.name, this.variable.type.size)
        }

        builder.pushInstruction(Instructions.STORE, this.variable.type.size, [this.variable.name])
    }

    public emitPtr(builder: FunctionIRBuilder) {
        if (this.accessType == "declaration") {
            builder.registerVariable("variables", this.span, this.variable.name, this.variable.type.size)
        }

        builder.pushInstruction(Instructions.VAR_PTR, 0, [this.variable.name])
    }

    constructor(
        span: Span,
        public readonly variable: Variable,
        public readonly accessType: "declaration" | "access" = "access"
    ) {
        super(span, new Reference(variable.type))
        if (variable.type.size == Type.NOT_INSTANTIABLE) {
            throw new Error(`Type "${variable.type.name}" is not instantiable`)
        }
    }
}