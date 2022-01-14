import { RootNode } from "./ast/nodes/RootNode"
import { createGlobalScope } from "./createGlobalScope"
import { Diagnostic } from "./Diagnostic"
import { Assembler } from "./emission/Assembler"
import { Emitter } from "./emission/Emitter"
import { Parser } from "./parsing/Parser"
import { SourceFile } from "./parsing/SourceFile"
import { Program } from "./typing/Program"
import { Typing } from "./typing/Typing"

interface CompilerHost {
    readFile(path: string): Promise<string>
    readDir(path: string): Promise<{ name: string, path: string, type: "code" | "dir" | "other" }[]>
    printDiagnostic(text: string): void
}

export class Compiler {
    public readonly files = new Map<string, SourceFile>()
    public readonly asts = new Map<string, RootNode>()
    public readonly diagnostics: Diagnostic[] = []
    protected readonly changed = new Set<string>()
    public readonly globalScope = createGlobalScope()
    public program: Program | null = null

    public addSource(file: SourceFile) {
        this.files.set(file.path, file)
        this.changed.add(file.path)
    }

    public removeSource(path: string) {
        if (this.files.delete(path)) {
            this.changed.add(path)
        }
    }

    public addDiagnostic(diagnostic: Diagnostic) {
        if (this.host) {
            this.host.printDiagnostic(diagnostic.format())
        }
        this.diagnostics.push(diagnostic)
    }

    public addDiagnostics(diagnostics: Diagnostic[]) {
        for (const diagnostic of diagnostics) this.addDiagnostic(diagnostic)
    }

    public async addFile(path: string) {
        if (!this.host) throw new Error("Compiler does not have a host")

        const content = await this.host.readFile(path)
        this.addSource(new SourceFile(path, content))
    }

    public async addFolder(path: string) {
        if (!this.host) throw new Error("Compiler does not have a host")

        const entries = await this.host.readDir(path)
        await Promise.all(entries.map(async entry => {
            if (entry.type == "dir") {
                await this.addFolder(entry.path)
            } else if (entry.type == "code") {
                await this.addFile(entry.path)
            }
        }))
    }

    public parse() {
        for (const changed of this.changed.values()) {
            const file = this.files.get(changed)
            if (!file) {
                // File was deleted
                this.asts.delete(changed)
                continue
            }

            const result = Parser.parse(file)
            if (result instanceof Diagnostic) {
                this.addDiagnostic(result)
                this.asts.delete(changed)
            } else {
                this.asts.set(changed, result)
            }
        }

        this.changed.clear()
    }

    public type() {
        const result = Typing.parse([...this.asts.values()], this.globalScope)
        if (result instanceof Array) {
            this.addDiagnostics(result)
            this.program = null
        } else {
            this.program = result
        }
    }

    public assemble() {
        if (!this.program) throw new Error("Cannot assemble, no program compiled")
        const emission = Emitter.emit(this.program)
        const assembler = new Assembler(this.program)
        for (const name of this.program.createdFunctions) {
            const func = emission.get(name)!
            assembler.addFunction(func)
        }

        return assembler.build()
    }

    public compile() {
        this.parse()
        if (this.diagnostics.length > 0) {
            return null
        }
        this.type()
        if (this.diagnostics.length > 0) {
            return null
        }
        return this.assemble()
    }

    constructor(
        protected readonly host: CompilerHost | null = null
    ) { }
}