import { unreachable } from "../../comTypes/util"
import { Pointer } from "../typing/types/Pointer"
import { CoroutineHandle } from "./CoroutineHandle"
import { ExecutableHeader } from "./ExecutableHeader"
import { Instructions } from "./Instructions"
import { MemoryView } from "./Memory"
import { MemoryMapper } from "./MemoryMapper"
import { AnyTypedArrayCtor } from "./types"


interface StackFrame {
    function: ExecutableHeader.Function
    data: Uint32Array
    /** Contains the real addresses of function arguments, variables and returns */
    references: number[]
    pc: number
    /** Size of the frame variables on the stack */
    size: number
    /** Length of the stack when this frame was created. The length is asserted to be the same on return. */
    stackLen: number
    callback?: (data: MemoryView) => void
}

const TYPES: Record<(typeof Instructions.Types)[Exclude<keyof typeof Instructions.Types, "names">], AnyTypedArrayCtor> = {
    [Instructions.Types.FLOAT64]: Float64Array,
    [Instructions.Types.UINT8]: Uint8Array
}

export class BytecodeVM {
    public readonly memoryMap = new MemoryMapper()
    public readonly controlStack: StackFrame[] = []
    public readonly externFunctions = new Map<string, BytecodeVM.ExternFunction>()
    public activeCoroutine = new CoroutineHandle(this.memoryMap)

    public directCall(functionIndex: number, args: ArrayBuffer[], callback: StackFrame["callback"]) {
        for (const arg of args) {
            this.activeCoroutine.stack.pushConst(arg)
        }

        const frame = this.makeCall(functionIndex)
        frame.callback = callback
        this.controlStack.push(frame)
        this.run()
    }

    public findFunction(name: string) {
        const index = this.config.functions.findIndex(v => v.name == name)
        if (index == -1) throw new Error(`Cannot find function with signature "${name}"`)
        return index
    }

    public storePointer(address: number, data: MemoryView) {
        this.memoryMap.writeValue(address, data)
    }

    public loadPointer(address: number, size: number) {
        return this.memoryMap.readValue(address, size)
    }

    public allocate(size: number) {
        return this.memoryMap.allocate(size)
    }

    public free(ptr: number) {
        this.memoryMap.freeAddress(ptr)
    }

    public resume(data: MemoryView) {
        const entry = this.controlStack.pop()!
        const returnSize = this.makeReturn(entry)
        if (returnSize != data.length) throw new Error(`Tried to resume execution, but returned data size mismatch (${data.length}, ${returnSize})`)
        if (returnSize != 0) this.activeCoroutine.stack.write(this.activeCoroutine.stack.length - returnSize, data)
        this.run()
    }

    public run() {
        let ctx = this.controlStack[this.controlStack.length - 1]
        while (ctx.pc < ctx.data.length || ctx.function.offset == -1) {
            if (ctx.function.offset == -1) {
                const extern = this.externFunctions.get(ctx.function.name)
                if (!extern) throw new Error(`Cannot find extern function for '${ctx.function.name}'`)
                extern(ctx, this)
                return
            }

            const curr = ctx.data[ctx.pc]
            const inst = (curr & 0xffff0000) >>> 16
            const subtype = curr & 0x0000ffff
            //console.log("PC:", ctx.pc)
            ctx.pc++

            switch (inst) {
                case Instructions.LOAD: {
                    const ref = ctx.data[ctx.pc]
                    ctx.pc++
                    const data = this.activeCoroutine.stack.read(ctx.references[ref], subtype)
                    //console.log("Load:", ref, ctx.references[ref], data)
                    this.activeCoroutine.stack.push(data)
                } break
                case Instructions.STORE: {
                    const ref = ctx.data[ctx.pc]
                    ctx.pc++
                    const data = this.activeCoroutine.stack.pop(subtype)
                    this.activeCoroutine.stack.write(ctx.references[ref], data)
                    //console.log("Store:", ref, ctx.references[ref], data)
                } break
                case Instructions.RETURN: {
                    const entry = this.controlStack.pop()!
                    //console.log("Return")
                    const returnSize = this.makeReturn(entry)
                    if (this.controlStack.length == 0) {
                        entry.callback?.(this.activeCoroutine.stack.pop(returnSize))
                        return
                    }
                    ctx = this.controlStack[this.controlStack.length - 1]
                } break
                case Instructions.CONST: {
                    const data: number[] = []
                    for (let size = subtype; size > 0; size -= 4) {
                        data.push(ctx.data[ctx.pc])
                        ctx.pc++
                    }
                    const buffer = new Uint32Array(data).buffer.slice(0, subtype)
                    //console.log("Const:", new MemoryView(buffer))
                    this.activeCoroutine.stack.pushConst(buffer)
                } break
                case Instructions.ADD: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a + b
                    //console.log("Add:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.SUB: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a - b
                    //console.log("Sub:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.MUL: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a * b
                    //console.log("Mul:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.DIV: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a / b
                    //console.log("Div:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.MOD: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = a % b
                    //console.log("Mod:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.EQ: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a == b)
                    //console.log("Eq:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.LT: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a < b)
                    //console.log("Lt:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.GT: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a > b)
                    //console.log("Gt:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.LTE: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a <= b)
                    //console.log("Lte:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.GTE: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const b = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const a = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const res = +(a >= b)
                    //console.log("Gte:", a, b, res)
                    this.activeCoroutine.stack.pushConst(new type([res]).buffer)
                } break
                case Instructions.BR_FALSE:
                case Instructions.BR_TRUE: {
                    const type = TYPES[subtype as keyof typeof TYPES]
                    if (!type) throw new Error("Invalid type")
                    const labelIndex = ctx.data[ctx.pc]
                    ctx.pc++
                    const predicate = this.activeCoroutine.stack.pop(type.BYTES_PER_ELEMENT).as(type)[0]
                    const label = ctx.function.labels[labelIndex]
                    if (!predicate == !(inst == Instructions.BR_TRUE)) {
                        //console.log("Jump:", label.name)
                        ctx.pc = label.offset
                    } else {
                        //console.log("Jump skipped:", label.name)
                    }
                } break
                case Instructions.BR: {
                    const labelIndex = ctx.data[ctx.pc]
                    ctx.pc++
                    const label = ctx.function.labels[labelIndex]
                    //console.log("Jump:", label.name)
                    ctx.pc = label.offset
                } break
                case Instructions.DROP: {
                    this.activeCoroutine.stack.pop(subtype)
                } break
                case Instructions.CALL: {
                    const funcNumber = ctx.data[ctx.pc]
                    ctx.pc++
                    //console.log("Call:", funcNumber)
                    ctx = this.makeCall(funcNumber)
                    this.controlStack.push(ctx)
                } break
                case Instructions.VAR_PTR: {
                    const ref = ctx.data[ctx.pc]
                    ctx.pc++
                    const offset = ctx.references[ref]
                    const address = this.activeCoroutine.stackAddress + offset
                    //console.log("Varptr:", offset, "->", address)
                    this.activeCoroutine.stack.pushConst(new Float64Array([address]).buffer)
                } break
                case Instructions.DATA_PTR: {
                    const ref = ctx.data[ctx.pc]
                    ctx.pc++
                    const offset = this.config.data[ref].offset
                    const address = this.dataAddress + offset
                    //console.log("Dataptr:", offset, "->", address)
                    this.activeCoroutine.stack.pushConst(new Float64Array([address]).buffer)
                } break
                case Instructions.STORE_PTR: {
                    const ptr = this.activeCoroutine.stack.pop(Pointer.size).as(Float64Array)[0]
                    const value = this.activeCoroutine.stack.pop(subtype)
                    this.storePointer(ptr, value)
                } break
                case Instructions.EXCH_PTR: {
                    const ptr = this.stack.pop(Pointer.size).as(Float64Array)[0]
                    const value = this.stack.pop(subtype)
                    const oldValue = this.loadPointer(ptr, subtype).clone()
                    this.storePointer(ptr, value)
                    this.stack.push(oldValue)
                } break
                case Instructions.STORE_PTR_ALT: {
                    const value = this.activeCoroutine.stack.pop(subtype)
                    const ptr = this.activeCoroutine.stack.pop(Pointer.size).as(Float64Array)[0]
                    this.storePointer(ptr, value)
                } break
                case Instructions.LOAD_PTR: {
                    const ptr = this.activeCoroutine.stack.pop(Pointer.size).as(Float64Array)[0]
                    const value = this.loadPointer(ptr, subtype)
                    //console.log("Ptr load:", ptr, "=", value)
                    this.activeCoroutine.stack.push(value)
                } break
                case Instructions.MEMBER: {
                    const offset = ctx.data[ctx.pc]
                    ctx.pc++
                    const size = ctx.data[ctx.pc]
                    ctx.pc++
                    const value = this.activeCoroutine.stack.pop(subtype)
                    const result = value.slice(offset, size)
                    this.activeCoroutine.stack.push(result)
                } break
                case Instructions.ALLOC: {
                    const ptr = this.allocate(subtype)
                    this.activeCoroutine.stack.pushConst(new Float64Array([ptr]).buffer)
                } break
                case Instructions.FREE: {
                    const ptr = this.activeCoroutine.stack.pop(8).as(Float64Array)[0]
                    this.free(ptr)
                } break
                case Instructions.ALLOC_ARR: {
                    const length = this.activeCoroutine.stack.pop(8).as(Float64Array)[0]
                    const ptr = this.allocate(subtype * length)
                    this.activeCoroutine.stack.pushConst(new Float64Array([ptr]).buffer)
                } break
                case Instructions.STACK_COPY: {
                    const segment = this.activeCoroutine.stack.peek(subtype)
                    this.activeCoroutine.stack.push(segment)
                } break
                case Instructions.STACK_SWAP: {
                    const data = this.activeCoroutine.stack.pop(subtype * 2).clone()
                    this.activeCoroutine.stack.push(data.slice(subtype, subtype))
                    this.activeCoroutine.stack.push(data.slice(0, subtype))
                } break
                case Instructions.NUM_CNV: {
                    const sourceTypeCode = subtype & 0xff
                    const destTypeCode = (subtype >> 8) & 0xff
                    const sourceType = TYPES[sourceTypeCode as keyof typeof TYPES]
                    if (!sourceType) throw new Error("Invalid type")
                    const destType = TYPES[destTypeCode as keyof typeof TYPES]
                    if (!destType) throw new Error("Invalid type")
                    const source = this.activeCoroutine.stack.pop(sourceType.BYTES_PER_ELEMENT).as(sourceType)[0]
                    this.activeCoroutine.stack.pushConst(new destType([source]).buffer)
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
        //console.log("Called function", [func.name])
        if (!func) throw unreachable()
        let variableSize = 0
        let offset = this.activeCoroutine.stack.length

        const references: number[] = []

        let argumentsSize = 0
        { // Set references to arguments on the stack
            for (const argument of func.arguments) {
                argumentsSize += argument.size
            }

            const argumentStart = this.activeCoroutine.stack.length - argumentsSize
            argumentsSize = 0
            for (const argument of func.arguments) {
                references.push(argumentStart + argumentsSize)
                argumentsSize += argument.size
            }
        }

        // Allocate space on the stack for variables and returns
        for (const scope of [func.variables, func.returns]) {
            for (const variable of scope) {
                references.push(offset)
                variableSize += variable.size
                offset += variable.size
            }
        }

        this.activeCoroutine.stack.expand(variableSize)

        const fullSize = argumentsSize + variableSize
        const entry: StackFrame = {
            function: func,
            data: new Uint32Array(this.data.slice(func.offset, func.offset + func.size)),
            pc: 0,
            references,
            size: fullSize,
            stackLen: this.activeCoroutine.stack.length - fullSize
        }

        return entry
    }

    protected makeReturn(entry: StackFrame) {
        const expectedStackLength = entry.stackLen + entry.size
        if (this.activeCoroutine.stack.length != expectedStackLength) throw new Error("Stack length was not returned to the same value as when the function started (" + this.activeCoroutine.stack.length + "," + expectedStackLength + ")")
        let returnSize = 0
        for (const returns of entry.function.returns) {
            returnSize += returns.size
        }

        const returnValue = this.activeCoroutine.stack.read(this.activeCoroutine.stack.length - returnSize, returnSize).clone()

        this.activeCoroutine.stack.shrink(entry.size)
        this.activeCoroutine.stack.push(returnValue)

        return returnSize
    }

    public readonly dataAddress
    constructor(
        public readonly config: ExecutableHeader,
        public readonly data: ArrayBuffer
    ) {
        const dataView = new MemoryView(data)
        this.dataAddress = this.memoryMap.createPage(dataView)
    }
}

export namespace BytecodeVM {
    export type ExternFunction = (ctx: StackFrame, vm: BytecodeVM) => void
}