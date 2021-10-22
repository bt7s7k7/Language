import { FunctionIRBuilder } from "../../emission/InstructionPrinter"
import { Span } from "../../Span"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { ProgramFunction } from "../types/ProgramFunction"
import { SpecificFunction } from "../types/SpecificFunction"
import { Value } from "../Value"

export class Invocation extends Value {

    public override emit(builder: FunctionIRBuilder) {
        if (this.signature.target instanceof IntrinsicFunction) {
            return this.signature.target.emit(builder, this)
        } else if (this.signature.target instanceof ProgramFunction) {
            // TODO: Call program function
        }

        throw new Error("Unsupported specific function type: " + this.signature.target.constructor.name)
    }

    constructor(
        span: Span,
        public readonly signature: SpecificFunction.Signature,
        public readonly args: Value[]
    ) { super(span, signature.result) }
}