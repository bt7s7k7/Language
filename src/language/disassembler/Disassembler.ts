import { unreachable } from "../../comTypes/util"
import { Assembly } from "../emission/Assembler"
import { ExecutableHeader } from "../vm/ExecutableHeader"
import { InstructionInfo, Instructions } from "../vm/Instructions"

export interface FunctionDisassembly {
    name: string
    instructions: FunctionDisassembly.Instruction[]
    header: ExecutableHeader.Function
}

export namespace FunctionDisassembly {
    export interface Instruction {
        offset: number
        instruction: InstructionInfo
        subtype: string | null
        arguments: Argument[]
        label: string | null
    }

    export interface Argument {
        type: InstructionInfo.ArgumentType,
        value: string | number
    }

    export interface Variable {
        name: string
    }
}


export class Disassembler {
    public disassembleFunction(name: string): FunctionDisassembly {
        const index = this.findFunction(name)

        const functionHeader = this.assembly.header.functions[index]
        const data = new Uint32Array(this.assembly.data.slice(functionHeader.offset, functionHeader.offset + functionHeader.size))

        const instructions: FunctionDisassembly.Instruction[] = []
        const labelLookup = Object.fromEntries(functionHeader.labels.map(v => [v.offset, v.name]))

        const variables: FunctionDisassembly.Variable[] = []
        for (const variable of functionHeader.arguments) variables.push({ name: variable.name })
        for (const variable of functionHeader.variables) variables.push({ name: variable.name })
        for (const variable of functionHeader.returns) variables.push({ name: variable.name })

        for (let offset = 0; offset < data.length;) {
            const curr = data[offset]
            const code = (curr & 0xffff0000) >>> 16
            const subtype = curr & 0x0000ffff
            const start = offset
            offset++

            const instruction = Instructions.info[code] ?? unreachable()
            const args: FunctionDisassembly.Argument[] = []
            if (instruction.args) for (const argumentType of instruction.args) {
                if (argumentType == "jump") {
                    args.push({ type: "jump", value: functionHeader.labels[data[offset++]].name })
                } else if (argumentType == "raw") {
                    args.push({ type: "raw", value: data[offset++] })
                } else if (argumentType == "func") {
                    args.push({ type: "func", value: this.assembly.header.functions[data[offset++]].name })
                } else if (argumentType == "data") {
                    args.push({ type: "data", value: this.assembly.header.data[data[offset++]].name })
                } else if (argumentType == "var") {
                    args.push({ type: "var", value: variables[data[offset++]].name })
                } else if (argumentType == "const") {
                    const chunks: number[] = []
                    for (let size = subtype; size > 0; size -= 4) {
                        chunks.push(data[offset])
                        offset++
                    }
                    const buffer = new Uint32Array(chunks).buffer.slice(0, subtype)

                    if (subtype == 8) {
                        args.push({ type: "const", value: new Float64Array(buffer)[0] })
                    } else if (subtype == 1) {
                        args.push({ type: "const", value: new Uint8Array(buffer)[0] })
                    } else {
                        args.push({ type: "const", value: `<${[...new Uint8Array(buffer)].map(v => v.toString(16).padStart(2, "0"))}>` })
                    }
                }
            }

            instructions.push({
                arguments: args,
                instruction,
                offset: start,
                subtype: instruction.subtype ? (instruction.subtype == "size" ? subtype.toString() : Instructions.Types.names[subtype] ?? subtype.toString()) : null,
                label: labelLookup[offset]
            })
        }

        return {
            name: functionHeader.name,
            instructions,
            header: functionHeader
        }
    }

    public findFunction(name: string) {
        let index = this.functionCache.get(name)
        if (index == null) {
            index = this.assembly.header.functions.findIndex(v => v.name == name)
            this.functionCache.set(name, index)
        }
        return index
    }

    public *[Symbol.iterator]() {
        for (const func of this.assembly.header.functions) {
            yield this.disassembleFunction(func.name)
        }
    }

    protected readonly functionCache = new Map<string, number>()

    constructor(
        public readonly assembly: Assembly
    ) { }
}