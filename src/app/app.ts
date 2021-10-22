import chalk = require("chalk")
import { inspect } from "util"
import { Diagnostic } from "../language/Diagnostic"
import { Assembler } from "../language/emission/Assembler"
import { Emitter } from "../language/emission/Emitter"
import { Parser } from "../language/parsing/Parser"
import { SourceFile } from "../language/parsing/SourceFile"
import { Position } from "../language/Position"
import { Span } from "../language/Span"
import { GENERIC_ASSIGN } from "../language/typing/basic"
import { IntrinsicMaths } from "../language/typing/intrinsic/IntrinsicMaths"
import { Double64 } from "../language/typing/numbers"
import { FunctionDefinition } from "../language/typing/types/FunctionDefinition"
import { Typing } from "../language/typing/Typing"
import { stringifySpan } from "../language/util"
import { BytecodeVM } from "../language/vm/BytecodeVM"
import { MemoryView } from "../language/vm/Memory"

// @ts-ignore
Span.prototype[inspect.custom] = function (this: Span) {
    if (this == Span.native) return chalk.blueBright("<native>")
    return "\n" + chalk.blueBright(stringifySpan(this.pos.file, this.pos.line, this.pos.column, this.length))
}

// @ts-ignore
Position.prototype._s = Position.prototype[inspect.custom] = function (this: Position) {
    return "\n" + chalk.blueBright(stringifySpan(this.file, this.line, this.column, 1))
}

// @ts-ignore
MemoryView.prototype[inspect.custom] = function (this: MemoryView) {
    let represent = ""
    if (this.length == 1) represent += ":uint8(" + this.as(Uint8Array)[0] + ")"
    if (this.length == 2) represent += ":uint16(" + this.as(Uint16Array)[0] + ")"
    if (this.length == 4) represent += ":uint32(" + this.as(Uint32Array)[0] + ")"
    if (this.length == 8) represent += ":float64(" + this.as(Float64Array)[0] + ")"
    return chalk.yellow(`[${this.length}]${[...this.getUint8Array()].map(v => v.toString(16).padStart(2, "0")).join("").replace(/^0+/, "")}${represent}`)
}

const ast = Parser.parse(new SourceFile("<anon>",
    /* `
 function fibonacci(i: int) {
     if (i == 0 || i == 1) return 0
     return fibonacci(i - 1) + fibonacci(i - 2)
 }
 
 function main() {
     return fibonacci(6)
 }
 ` */
    `
    function _mul(value: number, target: number, counter: number, offset: number): number {
        if (counter) {
            return _mul(value + target, target, counter + offset, offset)
        } else {
            return value
        }
    }
    
    function mul(a: number, b: number, offset: number, zero: number) {
        return _mul(zero, a, b, offset)
    }
    `
))
if (ast instanceof Diagnostic) {
    console.log(inspect(ast, undefined, Infinity, true))
} else {
    const globalScope = new Typing.Scope()
    globalScope.register("number", Double64.TYPE)
    globalScope.register("__operator__add", new FunctionDefinition(Span.native, "__operator__add")
        .addOverload(Double64.CONST_ADD)
        .addOverload(new IntrinsicMaths.Addition())
    )
    globalScope.register("__operator__assign", new FunctionDefinition(Span.native, "__operator__assign")
        .addOverload(GENERIC_ASSIGN)
    )

    const program = Typing.parse(ast, globalScope)
    if (program instanceof Array) {
        console.log(inspect(ast, undefined, Infinity, true))
        console.log(inspect(program, undefined, Infinity, true))
    } else {
        const emission = Emitter.emit(program)
        console.log(inspect(emission, undefined, Infinity, true))
        const assembler = new Assembler()
        for (const symbol of emission.values()) {
            assembler.addFunction(symbol)
        }

        const build = assembler.build()
        console.log(inspect(build, undefined, Infinity, true))

        const vm = new BytecodeVM(build.header, build.data)
        const result = vm.directCall(1, [new Float64Array([5, 25, -1, 0]).buffer], 8)
        console.log(result)
    }
}