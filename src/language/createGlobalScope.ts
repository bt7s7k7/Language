import { Span } from "./Span"
import { IntrinsicMaths } from "./typing/intrinsic/IntrinsicMaths"
import { Primitives } from "./typing/Primitives"
import { Void, REINTERPRET_OPERATOR } from "./typing/types/base"
import { DEFER } from "./typing/types/DeferOperator"
import { FunctionDefinition } from "./typing/types/FunctionDefinition"
import { ALLOC_OPERATOR, Pointer } from "./typing/types/Pointer"
import { Slice } from "./typing/types/Slice"
import { Tuple } from "./typing/types/Tuple"
import { Typing } from "./typing/Typing"

export function createGlobalScope(scope = new Typing.Scope()) {
    scope.register("Number", Primitives.Number.TYPE)
    scope.registerMany("Number", {
        "@invoke": new FunctionDefinition(Span.native, "@invoke").addOverload(Primitives.Number.CTOR)
    })
    scope.register("Char", Primitives.Char.TYPE)
    scope.registerMany("Char", {
        "@invoke": new FunctionDefinition(Span.native, "@invoke").addOverload(Primitives.Char.CTOR)
    })
    scope.register("Void", Void.TYPE)

    for (const operatorName of [
        "ADD", "SUB", "MUL", "DIV",
        "MOD", "EQ", "LT", "GT", "LTE",
        "GTE", "NEGATE", "AND", "OR"
    ]) {
        const funcName = `@${operatorName.toLowerCase()}`
        const definition = new FunctionDefinition(Span.native, funcName)

        const intrinsic = (IntrinsicMaths as any)[operatorName]
        if (intrinsic) definition.addOverload(intrinsic)
        for (const primitiveName of ["Number", "Char"]) {
            const constexprFunction = (Primitives as any)[primitiveName][`CONST_${operatorName}`]
            if (constexprFunction) definition.addOverload(constexprFunction)
        }
        scope.register(funcName, definition)
    }

    scope.register("@assign", new FunctionDefinition(Span.native, "@assign").addOverload(new IntrinsicMaths.Assignment()))

    scope.register("@<int>defer", new FunctionDefinition(Span.native, "@<int>defer").addOverload(DEFER))
    scope.register("@<int>alloc", new FunctionDefinition(Span.native, "@<int>alloc").addOverload(ALLOC_OPERATOR))

    scope.register("@<int>as_ptr", new FunctionDefinition(Span.native, "@<int>as_ptr").addOverload(Pointer.AS_POINTER_OPERATOR))
    scope.register("@<int>addr", new FunctionDefinition(Span.native, "@<int>addr").addOverload(Pointer.ADDRESS_OF_OPERATOR))
    scope.register("@deref", new FunctionDefinition(Span.native, "@deref").addOverload(Pointer.DEREF_OPERATOR))
    scope.register("nullptr", Pointer.NULLPTR)

    scope.register("@<int>as_slice", new FunctionDefinition(Span.native, "@<int>as_slice").addOverload(Slice.AS_SLICE_OPERATOR))
    scope.register("@index", new FunctionDefinition(Span.native, "@index").addOverload(Slice.INDEX_OPERATOR))

    scope.register("__createTuple", new FunctionDefinition(Span.native, "__createTuple").addOverload(Tuple.CREATE_TUPLE))
    scope.register("Tuple", new FunctionDefinition(Span.native, "Tuple").addOverload(Tuple.TYPE))

    scope.register("@<int>reinterpret", new FunctionDefinition(Span.native, "@<int>reinterpret").addOverload(REINTERPRET_OPERATOR))

    return scope
}