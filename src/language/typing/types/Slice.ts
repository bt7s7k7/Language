import { unreachable } from "../../../comTypes/util"
import { DebugInfo } from "../../DebugInfo"
import { Diagnostic } from "../../Diagnostic"
import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { Primitives } from "../Primitives"
import { Type } from "../Type"
import { Typing } from "../Typing"
import { Invocation } from "../values/Invocation"
import { MemberAccess } from "../values/MemberAccess"
import { Never, Void } from "./base"
import { ConstExpr, isConstexpr } from "./ConstExpr"
import { FunctionDefinition } from "./FunctionDefinition"
import { InstanceType } from "./InstanceType"
import { Pointer } from "./Pointer"
import { IIntrinsicRefFunction, Reference } from "./Reference"
import { SpecificFunction } from "./SpecificFunction"

function createLocalSlice(span: Span, builder: FunctionIRBuilder, length: number, type: Type) {
    if (type.size == Type.NOT_INSTANTIABLE) throw new Error(`Type "${type.name}" is not instantiable`)
    const sliceLength = length
    const elementSize = type.size
    const sliceSize = elementSize * sliceLength
    const dataVariable = ".slice_" + builder.nextID() + "_data"
    builder.registerVariable("variables", span, dataVariable, sliceSize)

    return { elementSize, sliceSize, dataVariable, sliceLength }
}

function registerSliceMethods(slice: Slice, scope: Typing.Scope) {
    scope.registerMany(slice.name, {
        "@invoke": new FunctionDefinition(Span.native, "__slice_ctor").addOverload(new Slice.SliceCtor(slice)),
        "create": new FunctionDefinition(Span.native, "__slice_create").addOverload(new Slice.SliceCreate(slice)),
        "alloc": new FunctionDefinition(Span.native, "alloc").addOverload(new Slice.SliceAlloc(slice)),
        "@dispose": new FunctionDefinition(Span.native, "@dispose").addOverload(new Slice.SliceFree(slice)),
        "data": new MemberAccess.Property(Span.native, "data", new Pointer(slice.type), 0),
        "length": new MemberAccess.Property(Span.native, "length", Primitives.Number.TYPE, Primitives.Number.TYPE.size)
    })
}

export class Slice extends InstanceType {
    public assignableTo(other: Type): boolean {
        return super.assignableTo(other) || (other instanceof Slice && this.type.assignableTo(other.type))
    }

    public getDetail(debug: DebugInfo.Builder) {
        return {
            base: debug.type(this.type).name,
            props: [
                { type: debug.type(new Pointer(this.type)).name, name: "data", offset: 0 },
                { type: "Number", name: "length", offset: 8 },
            ]
        }
    }

    constructor(
        public readonly type: Type,
    ) { super(Span.native, "[]" + type.name, Slice.size) }
}

export namespace Slice {
    export const AS_SLICE_OPERATOR = new class extends SpecificFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const result = SpecificFunction.testConstExpr<[Type]>(span, [Type.TYPE], args)
            if (!(result instanceof Array)) return result
            const type = result[0]
            const sliceType = new Slice(type)

            context.scope.runInitializer(sliceType.name, () => {
                registerSliceMethods(sliceType, context.rootScope)
            })

            return {
                target: this,
                arguments: [{ name: "type", type }],
                result: new ConstExpr(type.span, Type.TYPE, sliceType)
            }
        }

        constructor() { super(Span.native, "@as_slice") }
    }

    export class SliceCtor extends IntrinsicFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const base = this.sliceType.type
            const target = args.map((_, i) => ({ name: `elem_${i}`, type: base }))
            const error = SpecificFunction.testArguments(span, target, args)
            if (error) return error

            return {
                target: this,
                arguments: target,
                result: new Slice(base)
            }
        }

        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const { dataVariable, sliceSize, sliceLength } = createLocalSlice(invocation.span, builder, invocation.args.length, this.sliceType.type)

            for (const element of invocation.args) {
                EmissionUtil.safeEmit(builder, this.sliceType.type.size, element)
            }

            builder.pushInstruction(Instructions.STORE, sliceSize, [dataVariable])

            builder.pushInstruction(Instructions.VAR_PTR, 0, [dataVariable])
            EmissionUtil.emitConstant(builder, new Float64Array([sliceLength]).buffer)

            return Slice.size
        }

        constructor(public readonly sliceType: Slice) { super(Span.native, "__slice_ctor") }
    }

    export class SliceCreate extends IntrinsicFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const base = this.sliceType.type
            const result = SpecificFunction.testConstExpr<[number]>(span, [Primitives.Number.TYPE], args)
            if (!(result instanceof Array)) return result

            return {
                target: this,
                arguments: [{ name: "length", type: args[0].type }],
                result: new Slice(base)
            }
        }

        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const sizeArgument = invocation.signature.arguments[0].type
            if (!isConstexpr<number>(sizeArgument, Primitives.Number.TYPE)) throw unreachable()
            const { dataVariable, sliceLength } = createLocalSlice(invocation.span, builder, sizeArgument.value, this.sliceType.type)

            builder.pushInstruction(Instructions.VAR_PTR, 0, [dataVariable])
            EmissionUtil.emitConstant(builder, new Float64Array([sliceLength]).buffer)

            return Slice.size
        }

        constructor(public readonly sliceType: Slice) { super(Span.native, "__slice_ctor") }
    }

    export function emitConstant(builder: FunctionIRBuilder, ptr: number, size: number) {
        return EmissionUtil.emitConstant(builder, new Float64Array([ptr]).buffer)
            + EmissionUtil.emitConstant(builder, new Float64Array([size]).buffer)
    }

    export const INDEX_OPERATOR = new class SliceIndexOperator extends IntrinsicFunction implements IIntrinsicRefFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const type = Reference.dereference(args[0].type)
            const slice = type instanceof Slice ? type : Never.TYPE
            const target = [{ name: "slice", type: slice }, { name: "index", type: Primitives.Number.TYPE }]
            const error = SpecificFunction.testArguments(span, target, args)
            if (error) return error

            return {
                target: this,
                arguments: target,
                result: new Reference((slice as Slice).type)
            }
        }

        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            const slice = invocation.signature.arguments[0].type instanceof Slice ? invocation.signature.arguments[0].type : unreachable()
            const type = slice.type

            this.emitPtr(builder, invocation)
            builder.pushInstruction(Instructions.LOAD_PTR, type.size)

            return type.size
        }
        public emitStore(builder: FunctionIRBuilder, invocation: Invocation) {
            const slice = invocation.signature.arguments[0].type instanceof Slice ? invocation.signature.arguments[0].type : unreachable()
            const type = slice.type

            this.emitPtr(builder, invocation)
            builder.pushInstruction(Instructions.STORE_PTR, type.size)
        }

        public emitPtr(builder: FunctionIRBuilder, invocation: Invocation) {
            const slice = invocation.signature.arguments[0].type instanceof Slice ? invocation.signature.arguments[0].type : unreachable()
            const type = slice.type

            EmissionUtil.safeEmit(builder, Slice.size, invocation.args[0])
            builder.pushInstruction(Instructions.MEMBER, Slice.size, [0, Primitives.Number.TYPE.size])
            EmissionUtil.safeEmit(builder, Primitives.Number.TYPE.size, invocation.args[1])
            EmissionUtil.emitConstant(builder, new Float64Array([type.size]).buffer)
            builder.pushInstruction(Instructions.MUL, Instructions.Types.FLOAT64)
            builder.pushInstruction(Instructions.ADD, Instructions.Types.FLOAT64)
        }

        constructor() { super(Span.native, "@index") }
    }

    export class SliceAlloc extends IntrinsicFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const target = [{ name: "length", type: Primitives.Number.TYPE }]
            const error = SpecificFunction.testArguments(span, target, args)
            if (error) return error

            return {
                arguments: target,
                result: this.sliceType,
                target: this
            }
        }

        public override emit(builder: FunctionIRBuilder, invocation: Invocation) {
            EmissionUtil.safeEmit(builder, 8, invocation.args[0])
            builder.pushInstruction(Instructions.STACK_COPY, 8)
            builder.pushInstruction(Instructions.ALLOC_ARR, this.sliceType.type.size)
            builder.pushInstruction(Instructions.STACK_SWAP, 8)
            return Slice.size
        }

        constructor(public readonly sliceType: Slice) { super(Span.native, "alloc") }
    }

    export class SliceFree extends IntrinsicFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const target = [{ name: "self", type: new Pointer(this.sliceType) }]
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
            builder.pushInstruction(Instructions.LOAD_PTR, 8, [])
            builder.pushInstruction(Instructions.FREE)

            return 0
        }

        constructor(public readonly sliceType: Slice) { super(Span.native, "free") }
    }

    export const size = 16
}