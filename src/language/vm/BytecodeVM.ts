import { unreachable } from "../../comTypes/util"
import { ExecutableHeader } from "./ExecutableHeader"
import { Instructions } from "./Instructions"
import { Memory } from "./Memory"

interface ExecutionContext {
    function: ExecutableHeader.Function
    data: Uint32Array
    references: number[]
    pc: number
    size: number
    stackLen: number
}

export class BytecodeVM {
    public readonly stack = new Memory()
    public readonly variableStack = new Memory()
    public readonly controlStack: ExecutionContext[] = []

    public directCall(functionIndex: number, args: ArrayBuffer[], returnSize: number) {
        for (const arg of args) {
            this.stack.pushConst(arg)
        }

        this.run(functionIndex)

        return this.stack.pop(returnSize)
    }

    public run(entryFunctionIndex: number) {
        this.controlStack.push(this.makeCall(entryFunctionIndex))
        let ctx = this.controlStack[this.controlStack.length - 1]

        while (ctx.pc < ctx.data.length) {
            const curr = ctx.data[ctx.pc]
            const inst = (curr & 0xffff0000) >>> 16
            const subtype = curr & 0x0000ffff
            ctx.pc++

            switch (inst) {
                case Instructions.LOAD: {
                    const ref = ctx.data[ctx.pc]
                    ctx.pc++
                    const data = this.variableStack.read(ctx.references[ref], subtype)
                    this.stack.push(data)
                } break
                case Instructions.STORE: {
                    const ref = ctx.data[ctx.pc]
                    ctx.pc++
                    const data = this.stack.pop(subtype)
                    this.variableStack.write(ctx.references[ref], data)
                } break
                case Instructions.RETURN: {
                    const entry = this.controlStack.pop()!
                    this.makeReturn(entry)
                    if (this.controlStack.length == 0) return
                } break
                case Instructions.CONST: {
                    const data = ctx.data[ctx.pc]
                    ctx.pc++
                    const buffer = new Uint32Array([data]).buffer.slice(0, subtype)
                    this.stack.pushConst(buffer)
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

        const entry: ExecutionContext = {
            function: func,
            data: new Uint32Array(this.data.slice(func.offset, func.offset + func.size)),
            pc: 0,
            references,
            size,
            stackLen: this.stack.length
        }

        for (let i = func.arguments.length - 1; i >= 0; i--) {
            const arg = func.arguments[i]
            const offset = references[i]
            const data = this.stack.pop(arg.size)
            this.variableStack.write(offset, data)
        }

        return entry
    }

    protected makeReturn(entry: ExecutionContext) {
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