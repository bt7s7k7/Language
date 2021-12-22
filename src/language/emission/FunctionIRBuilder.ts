import { Span } from "../Span"
import { DataIR, VariableIR } from "./FunctionIR"
import { AnyInstructionIR, InstructionIR } from "./InstructionIR"

interface Scope {
    name: string
    deferred: (() => void)[]
}

export class FunctionIRBuilder {
    public readonly variables = new Map<string, VariableIR>()
    public readonly data = new Map<string, DataIR>()
    public readonly instructions: AnyInstructionIR[] = []
    public lastInstruction: InstructionIR | null = null
    public readonly scopeStack: Scope[] = []
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

    public pushScope(name: string) {
        this.scopeStack.push({
            name, deferred: []
        })
    }

    public popScope(count: number | "all" = 1, remove: boolean) {
        if (count == "all") count = this.scopeStack.length

        for (let i = 0; i < count; i++) {
            const scope = this.scopeStack[this.scopeStack.length - i - 1]
            if (!scope) throw new Error("Tried to pop more scopes than created")

            for (let i = scope.deferred.length - 1; i >= 0; i--) {
                scope.deferred[i]()
            }
        }

        if (remove) this.scopeStack.splice(this.scopeStack.length - count)
    }

    public pushDeferred(callback: () => void) {
        this.scopeStack[this.scopeStack.length - 1].deferred.push(callback)
    }

    constructor(public readonly globalIndex: string) { }
}