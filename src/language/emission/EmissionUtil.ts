import { Double64 } from "../typing/numbers"
import { Type } from "../typing/Type"
import { Value } from "../typing/Value"
import { Instructions } from "../vm/Instructions"
import { FunctionIRBuilder } from "./InstructionPrinter"

const TYPE_LOOKUP = new Map<Type, number>([
    [Double64.TYPE, Instructions.Types.FLOAT64]
])

export namespace EmissionUtil {
    export function safeEmit(builder: FunctionIRBuilder, expectedSize: number, target: Value) {
        const size = target.emit(builder)
        if (size != expectedSize) throw new Error(`Emitted size mismatch (${target.constructor.name}), expected ${expectedSize} but got ${size}`)
    }

    export function getTypeCode(type: Type) {
        const ret = TYPE_LOOKUP.get(type)
        if (!ret) throw new Error("Cannot get code for type " + type.name)
        return ret
    }

    export const RETURN_VARIABLE_NAME = ".return"
}