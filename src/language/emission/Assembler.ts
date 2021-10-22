import { ExecutableHeader } from "../vm/ExecutableHeader"
import { FunctionIR } from "./FunctionIR"

export class Assembler {
    public readonly chunks: ArrayBuffer[] = []
    public readonly header: ExecutableHeader = {
        data: [],
        functions: []
    }
    public length = 0

    protected readonly functionLookup = new Map<string, number>()

    public addFunction(func: FunctionIR) {
        const index = this.header.functions.length
        this.functionLookup.set(func.name, index)
        const { data, header } = func.assemble(index, this.length, this.functionLookup)

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

    public build() {
        return { header: this.header, data: this.concatData() }
    }
}