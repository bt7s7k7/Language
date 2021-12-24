import { DebugInfo } from "../../DebugInfo"
import { Diagnostic } from "../../Diagnostic"
import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { IntrinsicFunction } from "../intrinsic/IntrinsicFunction"
import { Primitives } from "../Primitives"
import { Type } from "../Type"
import { Typing } from "../Typing"
import { normalizeType } from "../util"
import { Invocation } from "../values/Invocation"
import { MemberAccess } from "../values/MemberAccess"
import { ConstExpr, isConstexpr } from "./ConstExpr"
import { InstanceType } from "./InstanceType"
import { SpecificFunction } from "./SpecificFunction"

function registerTupleMethods(tuple: Tuple, scope: Typing.Scope) {
    scope.registerMany(tuple.name, {
        length: new ConstExpr(Span.native, Primitives.Number.TYPE, tuple.shape.properties.length),
        ...Object.fromEntries(tuple.shape.properties.map(v => [v.name, v]))
    })
}

function createTupleShape(types: Type[]) {
    let cursor = 0
    let i = 0
    const properties: MemberAccess.Property[] = []

    for (const type of types) {
        properties.push(new MemberAccess.Property(Span.native, "item" + i, type, cursor))
        cursor += type.size
        i++
    }

    return { properties, size: cursor }
}

export class Tuple extends InstanceType {
    public assignableTo(other: Type): boolean {
        return super.assignableTo(other) || (other instanceof Tuple && !this.types.some((v, i) => !v.assignableTo(other.types[i])))
    }

    public getDetail(debug: DebugInfo.Builder) {
        return {
            props: this.shape.properties.map((v, i) => ({ type: debug.type(v.type).name, offset: v.offset, name: "item" + i }))
        }
    }

    constructor(
        public readonly types: Type[],
        public readonly shape = createTupleShape(types)
    ) { super(Span.native, "Tuple(" + types.map(v => v.name).join(", ") + ")", shape.size) }
}

export namespace Tuple {
    export const TYPE = new class extends SpecificFunction {
        public override match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
            const types: Type[] = []
            for (const argument of args) {
                if (isConstexpr<Type>(argument.type, Type.TYPE)) {
                    types.push(argument.type.value)
                } else {
                    return new Diagnostic("Tuple must be initialized with a list of types", argument.span)
                }
            }

            const tupleType = new Tuple(types)

            context.scope.runInitializer(tupleType.name, () => {
                registerTupleMethods(tupleType, context.rootScope)
            })

            return {
                target: this,
                arguments: args.map((v, i) => ({ name: "_" + i, type: v.type })),
                result: new ConstExpr(span, Type.TYPE, tupleType)
            }
        }

        constructor() { super(Span.native, "<native> Tuple.@invoke") }
    }

    export const CREATE_TUPLE = new class extends IntrinsicFunction {
        public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic | Diagnostic[] {
            const types: Type[] = []
            for (const argument of args) {
                types.push(normalizeType(argument.type))
            }

            const tupleType = new Tuple(types)

            context.scope.runInitializer(tupleType.name, () => {
                registerTupleMethods(tupleType, context.rootScope)
            })

            return {
                target: this,
                arguments: args.map((v, i) => ({ name: "_" + i, type: v.type })),
                result: tupleType
            }
        }

        public emit(builder: FunctionIRBuilder, invocation: Invocation): number {
            const tuple = invocation.signature.result as Tuple

            for (let i = 0; i < invocation.args.length; i++) {
                const argument = invocation.args[i]
                const type = tuple.shape.properties[i].type

                EmissionUtil.safeEmit(builder, type.size, argument)
            }

            return tuple.size
        }

        constructor() { super(Span.native, "<native> __createTuple") }
    }
}