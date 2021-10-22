import { Span } from "../Span"
import { VariableIR } from "./FunctionIR"
import { AnyInstructionIR } from "./InstructionIR"

export class FunctionIRBuilder {
    public readonly variables = new Map<string, VariableIR>()
    public readonly instructions: AnyInstructionIR[] = []
    protected id = 0

    public registerVariable(type: VariableIR["type"], span: Span, name: string, size: number) {
        this.variables.set(name, { name, size, span, type })
    }

    public pushInstruction(code: number, subtype = 0, args: (string | number)[] = []) {
        this.instructions.push({ args, code, subtype })
    }

    public pushLabel(name: string) {
        this.instructions.push({ label: name })
    }

    public nextID() {
        return this.id++
    }
}