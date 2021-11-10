import { unreachable } from "../../../comTypes/util"
import { Diagnostic } from "../../Diagnostic"
import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { Type } from "../Type"
import { Invocation } from "../values/Invocation"
import { Never } from "./base"
import { ConstExpr } from "./ConstExpr"
import { InstanceType } from "./InstanceType"
import { IIntrinsicRefFunction, isRefValue, Reference } from "./Reference"
import { SpecificFunction } from "./SpecificFunction"

export class Pointer extends InstanceType {
    public assignableTo(other: Type): boolean {
        return super.assignableTo(other) || (other instanceof Pointer && this.type.assignableTo(other.type))
    }

    constructor(
        public readonly type: Type,
    ) { super(Span.native, "*" + type.name, Pointer.size) }
}

export namespace Pointer {
    export const AS_POINTER_OPERATOR = new class extends SpecificFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const result = SpecificFunction.testConstExpr<[Type]>(span, [Type.TYPE], args)
            if (!(result instanceof Array)) return result
            const type = result[0]

            return {
                target: this,
                arguments: [{ name: "type", type }],
                result: new ConstExpr(type.span, Type.TYPE, new Pointer(type))
            }
        }

        constructor() { super(Span.native, "__operator__as_ptr") }
    }

    export const ADDRESS_OF_OPERATOR = new class extends IntrinsicFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const type = args[0] ? Reference.dereference(args[0].type) : Never.TYPE
            const target = [{ name: "value", type: new Reference(type) }]
            const error = SpecificFunction.testArguments(span, target, args)
            if (error) return error

            return {
                target: this,
                arguments: target,
                result: new Pointer(type)
            }
        }

        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const value = invocation.args[0]
            if (!isRefValue(value)) throw unreachable()
            value.emitPtr(builder)
            return Pointer.size
        }

        constructor() { super(Span.native, "__operator__addr") }
    }

    export const DEREF_OPERATOR = new class extends IntrinsicFunction implements IIntrinsicRefFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const type = args[0] ? Reference.dereference(args[0].type) : Never.TYPE
            const base = type instanceof Pointer ? type.type : Never.TYPE
            const target = [{ name: "pointer", type: new Pointer(base) }]
            const error = SpecificFunction.testArguments(span, target, args)
            if (error) return error

            return {
                target: this,
                arguments: target,
                result: new Reference(base)
            }
        }

        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            EmissionUtil.safeEmit(builder, Pointer.size, invocation.args[0])
            const type = Reference.dereference(invocation.signature.result)
            builder.pushInstruction(Instructions.LOAD_PTR, type.size)
            return type.size
        }

        public emitStore(builder: FunctionIRBuilder, invocation: Invocation) {
            EmissionUtil.safeEmit(builder, Pointer.size, invocation.args[0])
            const type = Reference.dereference(invocation.signature.result)
            builder.pushInstruction(Instructions.STORE_PTR, type.size)
        }

        public emitPtr(builder: FunctionIRBuilder, invocation: Invocation) {
            // The value on the stack is already a pointer so we don't do anything
        }

        constructor() { super(Span.native, "__operator__deref") }
    }

    export const size = 8
}