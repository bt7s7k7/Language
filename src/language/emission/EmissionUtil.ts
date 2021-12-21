import { Primitives } from "../typing/Primitives"
import { Type } from "../typing/Type"
import { Pointer } from "../typing/types/Pointer"
import { Value } from "../typing/Value"
import { Instructions } from "../vm/Instructions"
import { FunctionIRBuilder } from "./FunctionIRBuilder"

const TYPE_LOOKUP = new Map<Type, number>([
    [Primitives.Number.TYPE, Instructions.Types.FLOAT64],
    [Primitives.Char.TYPE, Instructions.Types.UINT8]
])

export namespace EmissionUtil {
    export function safeEmit(builder: FunctionIRBuilder, expectedSize: number, target: Value) {
        const size = target.emit(builder)
        if (size != expectedSize) {
            throw new Error(`Emitted size mismatch (${target.constructor.name}), expected ${expectedSize} but got ${size}`)
        }
    }

    export function getTypeCode(type: Type) {
        const ret = tryGetTypeCode(type)
        if (!ret) throw new Error("Cannot get code for type " + type.name)
        return ret
    }

    export function tryGetTypeCode(type: Type) {
        if (type instanceof Pointer) type = Primitives.Number.TYPE
        const ret = TYPE_LOOKUP.get(type)
        if (!ret) return null
        return ret
    }

    export function emitConstant(builder: FunctionIRBuilder, data: ArrayBuffer) {
        const size = data.byteLength
        const ALIGNED_SIZE = Math.ceil(size / 4) * 4
        const ALIGNMENT_PADDING = 0
        const temp = new Uint8Array(ALIGNED_SIZE)
        temp.set(new Uint8Array(data), ALIGNMENT_PADDING)
        builder.pushInstruction(Instructions.CONST, size, [...new Uint32Array(temp.buffer)])
        return size
    }

    export const RETURN_VARIABLE_NAME = ".return"
}