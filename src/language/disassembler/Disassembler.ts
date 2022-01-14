import { unreachable } from "../../comTypes/util"
import { FORMAT } from "../../textFormat/Formatter"
import { Assembly } from "../emission/Assembler"
import { ExecutableHeader } from "../vm/ExecutableHeader"
import { InstructionInfo, Instructions } from "../vm/Instructions"

export class FunctionDisassembly {
    public format() {
        const lines = [
            "== " + FORMAT.success(this.name) + " =="
        ]

        if (this.header.offset == -1) {
            lines.push(FORMAT.warning("EXTERN"))
        } else {
            for (const instruction of this.instructions) {
                if (instruction.label) {
                    lines.push(FORMAT.primary(instruction.label) + ":")
                }
                lines.push(`    ${FORMAT.secondary(instruction.offset.toString(16).padStart(4, "0"))} ${FORMAT.primary(instruction.instruction.label)}${instruction.subtype != null ? `[${FORMAT.secondary(instruction.subtype)}]` : ""} ${instruction.arguments.map(arg =>
                    arg.type == "const" ? "#" + FORMAT.warning(arg.value + "")
                        : arg.type == "data" ? FORMAT.success(arg.value + "")
                            : arg.type == "func" ? FORMAT.success(arg.value + "")
                                : arg.type == "jump" ? ":" + FORMAT.primary(arg.value.toString(16).padStart(8, "0"))
                                    : arg.type == "var" ? "$" + FORMAT.success(arg.value + "")
                                        : arg.type == "raw" ? FORMAT.warning(arg.value + "")
                                            : unreachable()
                ).join(", ")}`)
            }
        }

        return lines.join("\n")
    }

    constructor(
        public readonly name: string,
        public readonly instructions: FunctionDisassembly.Instruction[],
        public readonly header: ExecutableHeader.Function
    ) { }
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

            let formattedSubtype: string | null = null
            if (instruction.subtype) {
                if (instruction.subtype == "size") {
                    formattedSubtype = subtype.toString()
                } else {
                    const primaryTypeCode = subtype & 0xff
                    formattedSubtype = Instructions.Types.names[primaryTypeCode] ?? `<inv>${primaryTypeCode.toString()}`
                    const secondaryTypeCode = (subtype >> 8) & 0xff
                    if (secondaryTypeCode) {
                        formattedSubtype += ", " + Instructions.Types.names[secondaryTypeCode] ?? `<inv>${secondaryTypeCode.toString()}`
                    }
                }
            }

            instructions.push({
                arguments: args,
                instruction,
                offset: start,
                subtype: formattedSubtype,
                label: labelLookup[offset]
            })
        }

        return new FunctionDisassembly(functionHeader.name, instructions, functionHeader)
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