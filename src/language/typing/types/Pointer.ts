import { unreachable } from "../../../comTypes/util"
import { DebugInfo } from "../../DebugInfo"
import { Diagnostic } from "../../Diagnostic"
import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { Type } from "../Type"
import { Typing } from "../Typing"
import { LanguageConstant } from "../Value"
import { Invocation } from "../values/Invocation"
import { Never, Void } from "./base"
import { ConstExpr } from "./ConstExpr"
import { FunctionDefinition } from "./FunctionDefinition"
import { InstanceType } from "./InstanceType"
import { IIntrinsicRefFunction, isRefValue, Reference } from "./Reference"
import { SpecificFunction } from "./SpecificFunction"

export class Pointer extends InstanceType {
    public assignableTo(other: Type): boolean {
        return super.assignableTo(other) || (other instanceof Pointer && this.type.assignableTo(other.type)) || other == Pointer.NULLPTR.type
    }

    public getDetail(debug: DebugInfo.Builder) {
        return {
            base: debug.type(this.type).name
        }
    }

    constructor(
        public readonly type: Type,
    ) { super(Span.native, "*" + type.name, Pointer.size) }
}

function registerPointerMethods(pointer: Pointer, scope: Typing.Scope) {
    scope.registerMany(pointer.name, {
        "alloc": new FunctionDefinition(Span.native, "alloc").addOverload(new Pointer.PointerAlloc(pointer)),
        "@dispose": new FunctionDefinition(Span.native, "@dispose").addOverload(new Pointer.PointerFree(pointer)),
    })
}

export namespace Pointer {
    export const AS_POINTER_OPERATOR = new class extends SpecificFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const result = SpecificFunction.testConstExpr<[Type]>(span, [Type.TYPE], args)
            if (!(result instanceof Array)) return result
            const type = result[0]
            const pointerType = new Pointer(type)

            context.scope.runInitializer(pointerType.name, () => {
                registerPointerMethods(pointerType, context.rootScope)
                context.debug.type(pointerType)
            })

            return {
                target: this,
                arguments: [{ name: "type", type }],
                result: new ConstExpr(type.span, Type.TYPE, pointerType)
            }
        }

        constructor() { super(Span.native, "@as_ptr") }
    }

    export const ADDRESS_OF_OPERATOR = new class extends IntrinsicFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const type = args[0] ? Reference.dereference(args[0].type) : Never.TYPE
            const target = [{ name: "value", type: new Reference(type) }]
            const error = SpecificFunction.testArguments(span, target, args)
            if (error) return error
            const pointerType = new Pointer(type)

            context.scope.runInitializer(pointerType.name, () => {
                registerPointerMethods(pointerType, context.rootScope)
                context.debug.type(pointerType)
            })

            return {
                target: this,
                arguments: target,
                result: pointerType
            }
        }

        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const value = invocation.args[0]
            if (!isRefValue(value)) throw unreachable()
            value.emitPtr(builder)
            return Pointer.size
        }

        constructor() { super(Span.native, "@addr") }
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
            EmissionUtil.safeEmit(builder, Pointer.size, invocation.args[0])
        }

        constructor() { super(Span.native, "@deref") }
    }

    export class PointerAlloc extends IntrinsicFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const error = SpecificFunction.testArguments(span, [], args)
            if (error) return error

            if (this.pointerType.type.size == Type.NOT_INSTANTIABLE) throw new Error(`Type "${this.pointerType.type.name}" is not instantiable`)

            return {
                arguments: [],
                result: this.pointerType,
                target: this
            }
        }

        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            builder.pushInstruction(Instructions.ALLOC, this.pointerType.type.size)
            return Pointer.size
        }

        constructor(public readonly pointerType: Pointer) { super(Span.native, "alloc") }
    }

    export class PointerFree extends IntrinsicFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const target = [{ name: "self", type: new Pointer(this.pointerType) }]
            const error = SpecificFunction.testArguments(span, target, args)
            if (error) return error

            return {
                arguments: target,
                result: Void.TYPE,
                target: this
            }
        }

        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            EmissionUtil.safeEmit(builder, Pointer.size, invocation.args[0])
            builder.pushInstruction(Instructions.LOAD_PTR, Pointer.size, [])
            builder.pushInstruction(Instructions.FREE, this.pointerType.type.size)

            return 0
        }

        constructor(public readonly pointerType: Pointer) { super(Span.native, "free") }
    }

    export const NULLPTR = new class NullPointer extends LanguageConstant {
        public emit(builder: FunctionIRBuilder): number {
            EmissionUtil.emitConstant(builder, new Float64Array([0]).buffer)
            return 8
        }

        constructor() {
            super(Span.native, new class NullPointerType extends Type {
                public assignableTo(other: Type): boolean {
                    return other instanceof Pointer
                }

                constructor() { super(Span.native, "nullptr", 8) }
            })
        }
    }

    export const size = 8
}