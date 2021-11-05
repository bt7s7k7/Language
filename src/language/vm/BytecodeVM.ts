import { unreachable } from "../../comTypes/util"
import { Pointer } from "../typing/types/Pointer"
import { ExecutableHeader } from "./ExecutableHeader"
import { Instructions } from "./Instructions"
import { Memory, MemoryView } from "./Memory"
import { AnyTypedArrayCtor } from "./types"

namespace MemoryMap {
    export const SEGMENT_SIZE = 3002399035752448

    export const SEGMENTS = [
        "data",
        "variableStack"
    ] as const

    export function prefixAddress(address: number, segment: (typeof SEGMENTS)[number]) {
        let i = 0
        while (SEGMENTS[i] != segment) i++
        return address + SEGMENT_SIZE * i
    }

    export function parseAddress(address: number) {
        let i = 0
        while (address >= SEGMENT_SIZE) {
            i++
            address -= SEGMENT_SIZE
        }

        return [address, SEGMENTS[i]] as const
    }
}


interface ExecutionContext {
    function: ExecutableHeader.Function
    data: Uint32Array
    references: number[]
    pc: number
    size: number
    stackLen: number
}

const TYPES: Record<(typeof Instructions.Types)[keyof typeof Instructions.Types], AnyTypedArrayCtor> = {
    [Instructions.Types.FLOAT64]: Float64Array,
    [Instructions.Types.UINT32]: Uint32Array
}

export class BytecodeVM {
    public readonly stack = new Memory()
    public readonly variableStack = new Memory()
    public readonly controlStack: ExecutionContext[] = []
    public readonly externFunctions = new Map<string, BytecodeVM.ExternFunction>()

    public directCall(functionIndex: number, args: ArrayBuffer[], returnSize: number) {
        for (const arg of args) {
            this.stack.pushConst(arg)
        }

        this.run(functionIndex)

        return this.stack.pop(returnSize)
    }

    public findFunction(name: string) {
        const index = this.config.functions.findIndex(v => v.name == name)
        if (index == -1) throw new Error(`Cannot find function with signature "${name}"`)
        return index
    }

    public storePointer(address: number, data: MemoryView) {
        const [offset, type] = MemoryMap.parseAddress(address)

        if (type == "variableStack") {
            return this.variableStack.write(offset, data)
        } else unreachable()
    }

    public loadPointer(address: number, size: number) {
        const [offset, type] = MemoryMap.parseAddress(address)

        if (type == "variableStack") {
            return this.variableStack.read(offset, size)
        } else unreachable()
    }

    public run(entryFunctionIndex: number) {
        this.controlStack.push(this.makeCall(entryFunctionIndex))
        let ctx = this.controlStack[this.controlStack.length - 1]

        while (ctx.pc < ctx.data.length || ctx.function.offset == -1) {
            if (ctx.function.offset == -1) {
                const extern = this.externFunctions.get(ctx.function.name)
                if (!extern) throw new Error(`Cannot find extern function for '${ctx.function.name}'`)
                extern(ctx, this)
                const entry = this.controlStack.pop()!
                this.makeReturn(entry)
                if (this.controlStack.length == 0) return
                ctx = this.controlStack[this.controlStack.length - 1]
                continue
            }

            const curr = ctx.data[ctx.pc]
            const inst = (curr & 0xffff0000) >>> 16
            const subtype = curr & 0x0000ffff
            console.log("PC:", ctx.pc)
            ctx.pc++

            switch (inst) {
                case Instructions.LOAD: {
                    const ref = ctx.data[ctx.pc]
                    ctx.pc++
                    const data = this.variableStack.read(ctx.references[ref], subtype)
                    console.log("Load:", ref, ctx.references[ref], data)
                    this.stack.push(data)
                } break
                case Instructions.STORE: {
                    const ref = ctx.data[ctx.pc]
                    ctx.pc++
                    const data = this.stack.pop(subtype)
                    this.variableStack.write(ctx.references[ref], data)
                    console.log("Store:", ref, ctx.references[ref], data)
                } break
                case Instructions.RETURN: {
                    const entry = this.controlStack.pop()!
                    console.log("Return")
                    this.makeReturn(entry)
                    if (this.controlStack.length == 0) return
                    ctx = this.controlStack[this.controlStack.length - 1]
                } break
                case Instructions.CONST: {
                    const data: number[] = []
                    for (let size = subtype; size > 0; size -= 4) {
                        data.push(ctx.data[ctx.pc])
                        ctx.pc++
                    }
                    const buffer = new Uint32Array(data).buffer.slice(0, subtype)
                    console.log("Const:", new MemoryView(buffer))
                    this.stack.pushConst(buffer)
                } break
                case Instructions.ADD: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a + b
                    console.log("Add:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.SUB: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a - b
                    console.log("Sub:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.MUL: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a * b
                    console.log("Mul:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.DIV: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a / b
                    console.log("Div:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.MOD: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a % b
                    console.log("Mod:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.EQ: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a == b)
                    console.log("Eq:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.LT: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a < b)
                    console.log("Lt:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.GT: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a > b)
                    console.log("Gt:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.LTE: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a <= b)
                    console.log("Lte:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.GTE: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a >= b)
                    console.log("Gte:", a, b, res)
                    this.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.BR_FALSE:
                case Instructions.BR_TRUE: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const labelIndex = ctx.data[ctx.pc]
                    ctx.pc++
                    const predicate = this.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const label = ctx.function.labels[labelIndex]
                    if (!predicate == !(inst == Instructions.BR_TRUE)) {
                        console.log("Jump:", label.name)
                        ctx.pc = label.offset
                    } else console.log("Jump skipped:", label.name)
                } break
                case Instructions.BR: {
                    const labelIndex = ctx.data[ctx.pc]
                    ctx.pc++
                    const label = ctx.function.labels[labelIndex]
                    console.log("Jump:", label.name)
                    ctx.pc = label.offset
                } break
                case Instructions.DROP: {
                    this.stack.pop(subtype)
                } break
                case Instructions.CALL: {
                    const funcNumber = ctx.data[ctx.pc]
                    ctx.pc++
                    console.log("Call:", funcNumber)
                    ctx = this.makeCall(funcNumber)
                    this.controlStack.push(ctx)
                } break
                case Instructions.VAR_PTR: {
                    const ref = ctx.data[ctx.pc]
                    ctx.pc++
                    const offset = ctx.references[ref]
                    const address = MemoryMap.prefixAddress(offset, "variableStack")
                    console.log("Varptr:", offset, "->", address)
                    this.stack.pushConst(new Float64Array([address]).buffer)
                } break
                case Instructions.STORE_PTR: {
                    const ptr = this.stack.pop(Pointer.size).as(Float64Array)[0]
                    const value = this.stack.pop(subtype)
                    console.log("Ptr store:", ptr, "=", value)
                    this.storePointer(ptr, value)
                } break
                case Instructions.LOAD_PTR: {
                    const ptr = this.stack.pop(Pointer.size).as(Float64Array)[0]
                    const value = this.loadPointer(ptr, subtype)
                    console.log("Ptr load:", ptr, "=", value)
                    this.stack.push(value)
                } break
                case Instructions.MEMBER: {
                    const offset = ctx.data[ctx.pc]
                    ctx.pc++
                    const size = ctx.data[ctx.pc]
                    ctx.pc++
                    const value = this.stack.pop(subtype)
                    const result = value.slice(offset, size)
                    this.stack.push(result)
                } break
                default: {
                    throw new Error("Invalid instruction")
                }
            }
        }

        throw new Error("Got outside of function")
    }

    protected makeCall(index: number) {
        const func = this.config.functions[index]
        if (!func) throw new Error("Function index out of range")
        console.log("Called function", [func.name])
        if (!func) throw unreachable()
        let size = 0
        let offset = this.variableStack.length

        const references: number[] = []

        for (const scope of [func.arguments, func.variables, func.returns]) {
            for (const variable of scope) {
                references.push(offset)
                size += variable.size
                offset += variable.size
            }
        }

        this.variableStack.expand(size)

        for (let i = func.arguments.length - 1; i >= 0; i--) {
            const arg = func.arguments[i]
            const offset = references[i]
            const data = this.stack.pop(arg.size)
            this.variableStack.write(offset, data)
        }

        const entry: ExecutionContext = {
            function: func,
            data: new Uint32Array(this.data.slice(func.offset, func.offset + func.size)),
            pc: 0,
            references,
            size,
            stackLen: this.stack.length
        }

        return entry
    }

    protected makeReturn(entry: ExecutionContext) {
        if (this.stack.length != entry.stackLen) throw new Error("Stack length was not returned to the same value as when the function started (" + this.stack.length + "," + entry.stackLen + ")")
        const referenceOffset = entry.function.arguments.length + entry.function.variables.length
        for (let i = 0; i < entry.function.returns.length; i++) {
            const offset = entry.references[referenceOffset + i]
            const size = entry.function.returns[i].size
            const data = this.variableStack.read(offset, size)
            this.stack.push(data)
        }

        this.variableStack.shrink(entry.size)
    }


    constructor(
        public readonly config: ExecutableHeader,
        public readonly data: ArrayBuffer
    ) { }
}

export namespace BytecodeVM {
    export type ExternFunction = (ctx: ExecutionContext, vm: BytecodeVM) => void
}