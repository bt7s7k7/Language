import { FunctionIRBuilder } from "../../emission/InstructionPrinter"
import { Span } from "../../Span"
import { Type } from "../Type"
import { Value } from "../Value"

export interface IAssignable {
    emitStore(builder: FunctionIRBuilder): void
}

export function isAssignable<T extends Value>(value: T): value is T & IAssignable {
    return "emitStore" in value
}

export class Reference extends Type {
    public assignableTo(other: Type): boolean {
        return super.assignableTo(other) || this.type.assignableTo(other) || (other instanceof Reference && this.type.assignableTo(other.type))
    }

    constructor(
        public readonly type: Type
    ) { super(Span.native, `${type.name}(&)`, type.size) }
}
