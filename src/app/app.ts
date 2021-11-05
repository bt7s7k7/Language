import chalk = require("chalk")
import { inspect } from "util"
import { Diagnostic } from "../language/Diagnostic"
import { Assembler } from "../language/emission/Assembler"
import { Emitter } from "../language/emission/Emitter"
import { Parser } from "../language/parsing/Parser"
import { SourceFile } from "../language/parsing/SourceFile"
import { Position } from "../language/Position"
import { Span } from "../language/Span"
import { IntrinsicMaths } from "../language/typing/intrinsic/IntrinsicMaths"
import { Primitives } from "../language/typing/Primitives"
import { Void } from "../language/typing/types/base"
import { FunctionDefinition } from "../language/typing/types/FunctionDefinition"
import { Pointer } from "../language/typing/types/Pointer"
import { Slice } from "../language/typing/types/Slice"
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
    /* javascript */`
    
    function print(msg: Number): Void => extern
    function print(msg: *Number): Void => extern

    function main() {
        var x = []Number(1, 2, 3, 4)
        print(&x[0] == x.data)
    }

    `
))
if (ast instanceof Diagnostic) {
    console.log(inspect(ast, undefined, Infinity, true))
} else {
    const globalScope = new Typing.Scope()
    globalScope.register("Number", Primitives.Number.TYPE)
    globalScope.register("Void", Void.TYPE)

    for (const operatorName of [
        "ADD", "SUB", "MUL", "DIV",
        "MOD", "EQ", "LT", "GT", "LTE",
        "GTE", "NEGATE"
    ]) {
        const funcName = `__operator__${operatorName.toLowerCase()}`
        const definition = new FunctionDefinition(Span.native, funcName)

        definition.addOverload((IntrinsicMaths as any)[operatorName])
        for (const primitiveName of ["Number"]) {
            definition.addOverload((Primitives as any)[primitiveName][`CONST_${operatorName}`])
        }
        globalScope.register(funcName, definition)
    }

    globalScope.register("__operator__assign", new FunctionDefinition(Span.native, "__operator__assign")
        .addOverload(new IntrinsicMaths.Assignment())
    )

    globalScope.register("__operator__as_ptr", new FunctionDefinition(Span.native, "__operator__as_ptr").addOverload(Pointer.AS_POINTER_OPERATOR))
    globalScope.register("__operator__addr", new FunctionDefinition(Span.native, "__operator__addr").addOverload(Pointer.ADDRESS_OF_OPERATOR))
    globalScope.register("__operator__deref", new FunctionDefinition(Span.native, "__operator__deref").addOverload(Pointer.DEREF_OPERATOR))

    globalScope.register("__operator__as_slice", new FunctionDefinition(Span.native, "__operator__as_slice").addOverload(Slice.AS_SLICE_OPERATOR))
    globalScope.register("__operator__index", new FunctionDefinition(Span.native, "__operator__index").addOverload(Slice.INDEX_OPERATOR))

    const program = Typing.parse(ast, globalScope)
    if (program instanceof Array) {
        console.log(inspect(ast, undefined, Infinity, true))
        console.log(inspect(program, undefined, Infinity, true))
    } else {
        console.log(inspect(program, undefined, Infinity, true))
        const emission = Emitter.emit(program)
        console.log(inspect(emission, undefined, Infinity, true))
        const assembler = new Assembler()
        for (const symbol of emission.values()) {
            assembler.addFunction(symbol)
        }

        const build = assembler.build()
        console.log(inspect(build, undefined, Infinity, true))

        const vm = new BytecodeVM(build.header, build.data)
        const print: BytecodeVM.ExternFunction = (ctx, vm) => {
            const value = vm.variableStack.read(ctx.references[0], 8)
            console.log(chalk.cyanBright("==>"), value)
        }

        vm.externFunctions.set("print(msg: Number): Void", print)
        vm.externFunctions.set("print(msg: *Number): Void", print)

        const result = vm.directCall(vm.findFunction("main(): Void"), [new Float64Array([5, 25]).buffer], 8)
        console.log(result)
    }
}