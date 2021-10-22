import { FunctionIRBuilder } from "../emission/InstructionPrinter"
import { Span } from "../Span"
import { Type } from "./Type"

export abstract class Value {
    public emit(builder: FunctionIRBuilder): number {
        throw new Error(`Cannot emit ${this.constructor.name}`)
    }

    constructor(
        public readonly span: Span,
        public readonly type: Type
    ) { }
}