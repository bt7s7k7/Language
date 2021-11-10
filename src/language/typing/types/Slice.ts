import { unreachable } from "../../../comTypes/util"
import { Diagnostic } from "../../Diagnostic"
import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { Primitives } from "../Primitives"
import { Type } from "../Type"
import { Invocation } from "../values/Invocation"
import { Never } from "./base"
import { ConstExpr, isConstexpr } from "./ConstExpr"
import { FunctionDefinition } from "./FunctionDefinition"
import { InstanceType } from "./InstanceType"
import { Pointer } from "./Pointer"
import { IIntrinsicRefFunction, Reference } from "./Reference"
import { SpecificFunction } from "./SpecificFunction"

function createLocalSlice(span: Span, builder: FunctionIRBuilder, length: number, type: Type) {
    const sliceLength = length
    const elementSize = type.size
    const sliceSize = elementSize * sliceLength
    const dataVariable = ".slice_" + builder.nextID() + "_data"
    builder.registerVariable("variables", span, dataVariable, sliceSize)

    return { elementSize, sliceSize, dataVariable, sliceLength }
}

export class Slice extends InstanceType {
    public assignableTo(other: Type): boolean {
        return super.assignableTo(other) || (other instanceof Slice && this.type.assignableTo(other.type))
    }

    private readonly props: Record<string, Type.PropertyDef> = {
        "static !invoke": new FunctionDefinition(Span.native, "__slice_ctor").addOverload(new Slice.SliceCtor(this)),
        "static create": new FunctionDefinition(Span.native, "__slice_create").addOverload(new Slice.SliceCreate(this)),
        "data": { type: new Pointer(this.type), offset: 0 },
        "length": { type: Primitives.Number.TYPE, offset: Primitives.Number.TYPE.size },

    }

    public getProperty(key: string) {
        return this.props[key] ?? null
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

            return {
                target: this,
                arguments: [{ name: "type", type }],
                result: new ConstExpr(type.span, Type.TYPE, new Slice(type))
            }
        }

        constructor() { super(Span.native, "__operator__as_slice") }
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
            const lengthPropSize = new Primitives.Number.Constant(Span.native, sliceLength).emit(builder)

            return lengthPropSize + Pointer.size
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
            const { dataVariable, sliceSize, sliceLength } = createLocalSlice(invocation.span, builder, sizeArgument.value, this.sliceType.type)

            builder.pushInstruction(Instructions.VAR_PTR, 0, [dataVariable])
            const lengthPropSize = new Primitives.Number.Constant(Span.native, sliceLength).emit(builder)

            return lengthPropSize + Pointer.size
        }

        constructor(public readonly sliceType: Slice) { super(Span.native, "__slice_ctor") }
    }

    export function emitConstant(builder: FunctionIRBuilder, ptr: number, size: number) {
        return new Primitives.Number.Constant(Span.native, ptr).emit(builder)
            + new Primitives.Number.Constant(Span.native, size).emit(builder)
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
            new Primitives.Number.Constant(Span.native, type.size).emit(builder)
            builder.pushInstruction(Instructions.MUL, Instructions.Types.FLOAT64)
            builder.pushInstruction(Instructions.ADD, Instructions.Types.FLOAT64)
        }

        constructor() { super(Span.native, "__operator__index") }
    }

    export const size = 16
}