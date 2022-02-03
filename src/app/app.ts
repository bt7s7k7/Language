import chalk = require("chalk")
import { readFileSync } from "fs"
import { join } from "path"
import { createInterface } from "readline"
import { inspect } from "util"
import { createGlobalScope } from "../language/createGlobalScope"
import { Diagnostic } from "../language/Diagnostic"
import { Disassembler } from "../language/disassembler/Disassembler"
import { Assembler } from "../language/emission/Assembler"
import { Emitter } from "../language/emission/Emitter"
import { Parser } from "../language/parsing/Parser"
import { SourceFile } from "../language/parsing/SourceFile"
import { Position } from "../language/Position"
import { Span } from "../language/Span"
import { Type } from "../language/typing/Type"
import { FunctionDefinition } from "../language/typing/types/FunctionDefinition"
import { ProgramFunction } from "../language/typing/types/ProgramFunction"
import { Typing } from "../language/typing/Typing"
import { BytecodeVM } from "../language/vm/BytecodeVM"
import { MemoryView } from "../language/vm/Memory"
import { FORMAT } from "../textFormat/Formatter"
import { ANSIRenderer } from "../textFormatANSI/ANSIRenderer"
import { installStandardExtern } from "./standardExtern"

// @ts-ignore
Span.prototype[inspect.custom] = function (this: Span) {
    if (this == Span.native) return chalk.blueBright("<native>")
    return "\n" + ANSIRenderer.render(FORMAT.primary(this.format("white")))
}

// @ts-ignore
Position.prototype._s = Position.prototype[inspect.custom] = function (this: Position) {
    return "\n" + ANSIRenderer.render(FORMAT.primary(this.format("white")))
}

// @ts-ignore
MemoryView.prototype[inspect.custom] = function (this: MemoryView) {
    return chalk.yellow(this.toString())
}

// @ts-ignore
Type.prototype[inspect.custom] = function (this: Type) {
    return this.constructor.name + " " + chalk.greenBright(this.name)
}

// @ts-ignore
FunctionDefinition.prototype[inspect.custom] = undefined
// @ts-ignore
ProgramFunction.prototype[inspect.custom] = undefined

const rl = createInterface(process.stdin, process.stdout)
rl.pause()

const sourcePath = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(__dirname, "../../test/units/hello.lenk")
const source = readFileSync(sourcePath).toString()

const ast = Parser.parse(new SourceFile(sourcePath, source))

if (ast instanceof Diagnostic) {
    console.log(inspect(ast, undefined, Infinity, true))
} else {
    const program = Typing.parse([ast], createGlobalScope())
    if (program instanceof Array) {
        console.log(inspect(ast, undefined, Infinity, true))
        console.log(inspect(program, undefined, Infinity, true))
    } else {
        console.log(inspect(program, undefined, Infinity, true))

        const emission = Emitter.emit(program)
        console.log(inspect(emission, undefined, Infinity, true))
        const assembler = new Assembler(program)
        for (const name of program.createdFunctions) {
            const func = emission.get(name)!
            assembler.addFunction(func)
        }

        console.log(inspect(program.debug, undefined, Infinity, true))

        const build = assembler.build()
        const disassembler = new Disassembler(build)
        for (const disassembly of disassembler) {
            console.log(ANSIRenderer.render(disassembly.format()))
        }

        const vm = new BytecodeVM(build.header, build.data)
        installStandardExtern(vm, build, rl)

        vm.directCall(vm.findFunction("main(): Void"), [new Float64Array([5, 25]).buffer], (result) => {
            console.log(result)
            rl.close()
        })
    }
}