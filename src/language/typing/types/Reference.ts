import { FunctionIRBuilder } from "../../emission/InstructionPrinter"
import { Span } from "../../Span"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { Type } from "../Type"
import { Value } from "../Value"
import { Invocation } from "../values/Invocation"
import { SpecificFunction } from "./SpecificFunction"

export interface IRefValue {
    emitStore(builder: FunctionIRBuilder): void
    emitPtr(builder: FunctionIRBuilder): void
}

export interface IIntrinsicRefFunction {
    emitStore(builder: FunctionIRBuilder, invocation: Invocation): void
    emitPtr(builder: FunctionIRBuilder, invocation: Invocation): void
}

export function isRefValue<T extends Value>(value: T): value is T & IRefValue {
    return "emitStore" in value && (value as T & IRefValue).emitStore != null
}

export function isIntrinsicRefFunction<T extends SpecificFunction>(value: T): value is T & IntrinsicFunction & IIntrinsicRefFunction {
    return "emitStore" in value && (value as T & IIntrinsicRefFunction).emitStore != null
}

export class Reference extends Type {
    public assignableTo(other: Type): boolean {
        return super.assignableTo(other) || this.type.assignableTo(other) || (other instanceof Reference && this.type.assignableTo(other.type))
    }

    constructor(
        public readonly type: Type
    ) { super(Span.native, `${type.name}(&)`, type.size) }

    public static dereference(type: Type) {
        return type instanceof Reference ? type.type : type
    }
}
