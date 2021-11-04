import { FunctionIRBuilder } from "../../emission/InstructionPrinter"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { ProgramFunction } from "../types/ProgramFunction"
import { IRefValue, isIntrinsicRefFunction } from "../types/Reference"
import { SpecificFunction } from "../types/SpecificFunction"
import { Value } from "../Value"

export class Invocation extends Value {

    public override emit(builder: FunctionIRBuilder) {
        if (this.signature.target instanceof IntrinsicFunction) {
            return this.signature.target.emit(builder, this)
        } else if (this.signature.target instanceof ProgramFunction) {
            for (const arg of this.args) {
                arg.emit(builder)
            }

            builder.pushInstruction(Instructions.CALL, 0, ["f:" + this.signature.target.name])

            return this.signature.result.size
        }

        throw new Error("Unsupported specific function type: " + this.signature.target.constructor.name)
    }

    constructor(
        span: Span,
        public readonly signature: SpecificFunction.Signature,
        public readonly args: Value[]
    ) {
        super(span, signature.result)
        const target = signature.target
        if (isIntrinsicRefFunction(target)) {
            Object.assign(this, {
                emitStore: function (builder) {
                    target.emitStore(builder, this)
                },
                emitPtr: function (builder) {
                    target.emitPtr(builder, this)
                }
            } as Partial<IRefValue> & ThisType<Invocation & IRefValue>)
        }
    }
}