import { unreachable } from "../../comTypes/util"
import { Program } from "../typing/Program"
import { ExecutableHeader } from "../vm/ExecutableHeader"
import { FunctionIR, VariableIR } from "./FunctionIR"

export interface Assembly {
    header: ExecutableHeader
    data: ArrayBufferLike
}

export class Assembler {
    public readonly chunks: ArrayBuffer[] = []
    public readonly header: ExecutableHeader = {
        data: [],
        functions: [],
        reflection: this.program.debug.build()
    }
    public length = 0

    protected readonly functionLookup = new Map<string, number>()
    protected readonly dataLookup = new Map<string, number>()

    public addFunction(func: FunctionIR) {
        const index = this.header.functions.length
        this.functionLookup.set(func.name, index)
        const instructions: number[] = []
        const labels = new Map<string, ExecutableHeader.Label>()

        for (const data of func.data.values()) {
            const index = this.header.data.length
            this.header.data.push({ name: data.name, offset: this.length, size: data.data.byteLength })
            this.dataLookup.set(data.name, index)
            this.length += data.data.byteLength
            this.chunks.push(data.data)
        }

        const header: ExecutableHeader.Function = {
            name: func.name,
            arguments: [],
            labels: [],
            offset: func.isExtern ? -1 : this.length,
            size: 0,
            returns: [],
            variables: []
        }


        const variableIndexes = new Map<VariableIR, number>()
        for (const variable of func.variables.values()) {
            const collection = header[variable.type]
            const index = collection.length
            collection.push({ name: variable.name, size: variable.size })
            variableIndexes.set(variable, index)
        }

        for (const variable of header.variables) {
            const ir = func.variables.get(variable.name)!
            variableIndexes.set(ir, variableIndexes.get(ir)! + header.arguments.length)
        }

        for (const variable of header.returns) {
            const ir = func.variables.get(variable.name)!
            variableIndexes.set(ir, variableIndexes.get(ir)! + header.arguments.length + header.variables.length)
        }

        let pc = 0
        for (const entry of func.instructions) {
            if ("label" in entry) {
                const label: ExecutableHeader.Label = { name: entry.label, offset: pc }
                labels.set(entry.label, label)
                header.labels.push(label)
            } else {
                pc++
                for (const _ of entry.args) {
                    pc++
                }
            }
        }

        if (!func.isExtern) for (const entry of func.instructions) {
            if ("label" in entry) continue

            instructions.push((entry.code << 16) | entry.subtype)
            pc++
            for (const arg of entry.args) {
                if (typeof arg == "number") {
                    instructions.push(arg)
                } else {
                    if (arg.startsWith("l:")) {
                        const label = labels.get(arg.substr(2))
                        if (!label) throw new Error("Cannot find label name")
                        const index = header.labels.indexOf(label)
                        instructions.push(index)
                    } else if (arg.startsWith("f:")) {
                        const index = this.functionLookup.get(arg.substr(2))
                        if (index == null) throw new Error("Cannot find function " + arg.substr(2))
                        instructions.push(index)
                    } else {
                        const index = variableIndexes.get(func.variables.get(arg)!) ?? this.dataLookup.get(arg) ?? unreachable(`Variable "${arg}" should exist`)
                        if (index == null) throw new Error("Cannot find variable " + arg.substr(2))
                        instructions.push(index)
                    }
                }
            }
        }

        const data = new Uint32Array(instructions).buffer
        header.size = data.byteLength

        this.chunks.push(data)
        this.length += data.byteLength
        this.header.functions.push(header)
    }

    public concatData() {
        const result = new Uint8Array(this.length)
        let cursor = 0
        for (const chunk of this.chunks) {
            result.set(new Uint8Array(chunk), cursor)
            cursor += chunk.byteLength
        }

        return result.buffer
    }

    public build(): Assembly {
        return { header: this.header, data: this.concatData() }
    }

    constructor(
        public readonly program: Program
    ) { }
}