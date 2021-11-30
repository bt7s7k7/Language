import { Span } from "../Span"
import { DataIR, VariableIR } from "./FunctionIR"
import { AnyInstructionIR, InstructionIR } from "./InstructionIR"

export class FunctionIRBuilder {
    public readonly variables = new Map<string, VariableIR>()
    public readonly data = new Map<string, DataIR>()
    public readonly instructions: AnyInstructionIR[] = []
    public lastInstruction: InstructionIR | null = null
    protected id = 0

    public registerVariable(type: VariableIR["type"], span: Span, name: string, size: number) {
        this.variables.set(name, { name, size, span, type })
    }

    public pushInstruction(code: number, subtype = 0, args: (string | number)[] = []) {
        this.instructions.push(this.lastInstruction = { args, code, subtype })
    }

    public popInstruction() {
        this.instructions.pop()
    }

    public registerData(name: string, data: ArrayBuffer, span: Span) {
        this.data.set(name, { name, data, span })
    }

    public pushLabel(name: string) {
        this.instructions.push({ label: name })
    }

    public nextID() {
        return this.id++
    }

    constructor(public readonly globalIndex: string) { }
}