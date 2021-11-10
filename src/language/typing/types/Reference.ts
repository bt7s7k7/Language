import { unreachable } from "../../../comTypes/util"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
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

export function isRefValue<T extends Value | Type>(value: T): value is T & IRefValue {
    return "emitStore" in value && (value as T & IRefValue).emitStore != null
}

export function isIntrinsicRefFunction<T extends SpecificFunction>(value: T): value is T & IntrinsicFunction & IIntrinsicRefFunction {
    return "emitStore" in value && (value as T & IIntrinsicRefFunction).emitStore != null
}

export class Reference extends Type {
    public assignableTo(other: Type): boolean {
        return super.assignableTo(other) || this.type.assignableTo(other) || (other instanceof Reference && this.type.assignableTo(other.type))
    }

    public getProperty(key: string) {
        return this.type.getProperty(key)
    }

    constructor(
        public readonly type: Type
    ) {
        super(Span.native, `${type.name}(&)`, type.size)
        if (this.type instanceof Reference) throw unreachable()
    }

    public static dereference(type: Type) {
        return type instanceof Reference ? type.type : type
    }
}
