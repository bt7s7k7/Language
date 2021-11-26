import chalk = require("chalk")
import { createInterface } from "readline"
import { inspect, TextDecoder, TextEncoder } from "util"
import { DebugInfo } from "../language/DebugInfo"
import { Diagnostic } from "../language/Diagnostic"
import { Assembler } from "../language/emission/Assembler"
import { Emitter } from "../language/emission/Emitter"
import { Parser } from "../language/parsing/Parser"
import { SourceFile } from "../language/parsing/SourceFile"
import { Position } from "../language/Position"
import { Span } from "../language/Span"
import { IntrinsicMaths } from "../language/typing/intrinsic/IntrinsicMaths"
import { Primitives } from "../language/typing/Primitives"
import { REINTERPRET_OPERATOR, Void } from "../language/typing/types/base"
import { FunctionDefinition } from "../language/typing/types/FunctionDefinition"
import { Pointer } from "../language/typing/types/Pointer"
import { Slice } from "../language/typing/types/Slice"
import { Tuple } from "../language/typing/types/Tuple"
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
    return chalk.yellow(this.toString())
}

const rl = createInterface(process.stdin, process.stdout)
rl.pause()

const ast = Parser.parse(new SourceFile("<anon>",
    /* `
 function fibonacci(i: int) {
     if (i == 0 || i == 1) return 0
     return fibonacci(i - 1) + fibonacci(i - 2)
 }
 
 function main() {
     return fibonacci(6)
    }
    
    function print(msg: *Number): Void => extern
    ` */
    /* javascript */`

    template(T is any 1)
    function printf(format: []Char, args: T): Void => extern

    namespace Foo {
        struct {
            next: *Foo
        }
    }

    function main() {
        var foo: Foo
        foo.next = *Foo.alloc()

        printf("Foo: {0} {1}", .[foo, foo.next.*])
    }

    `
))
if (ast instanceof Diagnostic) {
    console.log(inspect(ast, undefined, Infinity, true))
} else {
    const globalScope = new Typing.Scope()
    globalScope.register("Number", Primitives.Number.TYPE)
    globalScope.register("Char", Primitives.Char.TYPE)
    globalScope.register("Void", Void.TYPE)

    for (const operatorName of [
        "ADD", "SUB", "MUL", "DIV",
        "MOD", "EQ", "LT", "GT", "LTE",
        "GTE", "NEGATE", "AND", "OR"
    ]) {
        const funcName = `__operator__${operatorName.toLowerCase()}`
        const definition = new FunctionDefinition(Span.native, funcName)

        const intrinsic = (IntrinsicMaths as any)[operatorName]
        if (intrinsic) definition.addOverload(intrinsic)
        for (const primitiveName of ["Number", "Char"]) {
            const constexprFunction = (Primitives as any)[primitiveName][`CONST_${operatorName}`]
            if (constexprFunction) definition.addOverload(constexprFunction)
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

    globalScope.register("__createTuple", new FunctionDefinition(Span.native, "__createTuple").addOverload(Tuple.CREATE_TUPLE))
    globalScope.register("Tuple", new FunctionDefinition(Span.native, "Tuple").addOverload(Tuple.TYPE))

    globalScope.register("__operator__reinterpret", new FunctionDefinition(Span.native, "__operator__reinterpret").addOverload(REINTERPRET_OPERATOR))

    const program = Typing.parse(ast, globalScope)
    if (program instanceof Array) {
        console.log(inspect(ast, undefined, Infinity, true))
        console.log(inspect(program, undefined, Infinity, true))
    } else {
        console.log(inspect(program, undefined, Infinity, true))
        const emission = Emitter.emit(program)
        console.log(inspect(emission, undefined, Infinity, true))
        const assembler = new Assembler(program)
        for (const symbol of emission.values()) {
            assembler.addFunction(symbol)
        }

        const build = assembler.build()
        console.log(inspect(build, undefined, Infinity, true))

        const vm = new BytecodeVM(build.header, build.data)
        const print: BytecodeVM.ExternFunction = (ctx, vm) => {
            const value = vm.variableStack.read(ctx.references[0], ctx.function.arguments[0].size)
            console.log(chalk.cyanBright("==>"), value)
            vm.resume(MemoryView.empty)
        }

        vm.externFunctions.set("print(msg: Number): Void", print)
        vm.externFunctions.set("print(msg: Char): Void", print)
        vm.externFunctions.set("print(msg: *Number): Void", print)
        vm.externFunctions.set("print(msg: []Char): Void", (ctx, vm) => {
            const [ptr, size] = vm.variableStack.read(ctx.references[0], ctx.function.arguments[0].size).as(Float64Array)
            const msg = new TextDecoder().decode(vm.loadPointer(ptr, size).as(Uint8Array))
            console.log(chalk.cyanBright("==>"), msg)

            vm.resume(MemoryView.empty)
        })


        for (const name of build.header.reflection.templates["printf"].specializations) {
            const specialization = build.header.reflection.functions[name]
            const typeName = specialization.args[1].type
            const type = build.header.reflection.types[typeName]
            const props: { type: string, offset: number }[] = type.detail.shape

            vm.externFunctions.set(name, (ctx, vm) => {
                const decoder = new TextDecoder()
                function loadString(slice: MemoryView) {
                    const [ptr, size] = slice.as(Float64Array)
                    return decoder.decode(vm.loadPointer(ptr, size).as(Uint8Array))
                }

                function objectifyStruct(value: MemoryView, struct: DebugInfo.TypeInfo) {
                    const result: Record<string, any> = {}

                    for (let { name, offset, type } of struct.detail.shape) {
                        const typeInfo = build.header.reflection.types[type]
                        const propertyValue = value.slice(offset, typeInfo.size)

                        if (typeInfo.detail?.shape) {
                            result[name] = objectifyStruct(propertyValue, typeInfo)
                        } else {
                            result[name] = propertyValue
                        }
                    }

                    return result
                }

                const tuple = vm.variableStack.read(ctx.references[1], ctx.function.arguments[1].size)

                const format = loadString(vm.variableStack.read(ctx.references[0], ctx.function.arguments[0].size))
                    .replace(/\{(\d+)\}/g, (_, i) => {
                        const prop = props[i]
                        const type = build.header.reflection.types[prop.type]
                        if (!prop) return chalk.redBright(`{${i}}`)

                        const value = tuple.slice(prop.offset, type.size)

                        if (type.name == "[]Char") {
                            return chalk.greenBright(JSON.stringify(loadString(value)))
                        }

                        if (type.detail?.shape) {
                            return inspect(objectifyStruct(value, type))
                        }

                        return chalk.yellowBright(value.toString())
                    })

                // eslint-disable-next-line no-console
                console.log(format)
                vm.resume(MemoryView.empty)
            })
        }

        vm.externFunctions.set("readline(): []Char", (ctx, vm) => {
            rl.resume()
            rl.question("> ", answer => {
                rl.pause()
                const data = new TextEncoder().encode(answer)
                const ptr = vm.allocate(data.length)
                vm.storePointer(ptr, MemoryView.from(data.buffer))
                vm.resume(MemoryView.from(new Float64Array([ptr, data.byteLength]).buffer))
            })
        })

        vm.directCall(vm.findFunction("main(): Void"), [new Float64Array([5, 25]).buffer], (result) => {
            console.log(result)
            rl.close()
        })
    }
}