import { unreachable } from "../../comTypes/util"
import { Span } from "../Span"
import { ExecutableHeader } from "../vm/ExecutableHeader"
import { AnyInstructionIR } from "./InstructionIR"

export class FunctionIR {
    public assemble(index: number, offset: number, functionLookup: Map<string, number>): AssembledFunction {
        const instructions: number[] = []
        const labels = new Map<string, ExecutableHeader.Label>()

        const header: ExecutableHeader.Function = {
            name: this.name,
            arguments: [],
            labels: [],
            offset,
            size: 0,
            returns: [],
            variables: []
        }

        const variableIndexes = new Map<VariableIR, number>()
        for (const variable of this.variables.values()) {
            const collection = header[variable.type]
            const index = collection.length
            collection.push({ name: variable.name, size: variable.size })
            variableIndexes.set(variable, index)
        }

        for (const variable of header.variables) {
            const ir = this.variables.get(variable.name)!
            variableIndexes.set(ir, variableIndexes.get(ir)! + header.arguments.length)
        }

        for (const variable of header.returns) {
            const ir = this.variables.get(variable.name)!
            variableIndexes.set(ir, variableIndexes.get(ir)! + header.arguments.length + header.variables.length)
        }

        let pc = 0
        for (const entry of this.instructions) {
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

        for (const entry of this.instructions) {
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
                    } else {
                        const index = variableIndexes.get(this.variables.get(arg)!) ?? unreachable()
                        instructions.push(index)
                    }
                }
            }
        }

        const data = new Uint32Array(instructions).buffer
        header.size = data.byteLength

        return { data, header }
    }

    constructor(
        public readonly span: Span,
        public readonly name: string,
        public readonly variables: Map<string, VariableIR>,
        public readonly instructions: AnyInstructionIR[]
    ) { }
}

export interface VariableIR {
    type: "variables" | "arguments" | "returns"
    name: string
    size: number
    span: Span
}

export interface AssembledFunction {
    data: ArrayBuffer,
    header: ExecutableHeader.Function
}