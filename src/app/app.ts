import chalk = require("chalk")
import { readFileSync } from "fs"
import { join } from "path"
import { createInterface } from "readline"
import { inspect, TextDecoder, TextEncoder } from "util"
import { unreachable } from "../comTypes/util"
import { DebugInfo } from "../language/DebugInfo"
import { Diagnostic } from "../language/Diagnostic"
import { Disassembler, FunctionDisassembly } from "../language/disassembler/Disassembler"
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

function stringifyFunctionDisassembly(func: FunctionDisassembly) {
    const lines = [
        "== " + chalk.greenBright(func.name) + " =="
    ]

    if (func.header.offset == -1) {
        lines.push(chalk.yellowBright("EXTERN"))
    } else {
        for (const instruction of func.instructions) {
            if (instruction.label) {
                lines.push(chalk.blueBright(instruction.label) + ":")
            }
            lines.push(`    ${chalk.grey(instruction.offset.toString(16).padStart(4, "0"))} ${chalk.cyan(instruction.instruction.label)}${instruction.subtype != null ? `[${chalk.magenta(instruction.subtype)}]` : ""} ${instruction.arguments.map(arg =>
                arg.type == "const" ? "#" + chalk.yellowBright(arg.value)
                    : arg.type == "data" ? chalk.greenBright(arg.value)
                        : arg.type == "func" ? chalk.greenBright(arg.value)
                            : arg.type == "jump" ? ":" + chalk.blueBright(arg.value.toString(16).padStart(8, "0"))
                                : arg.type == "var" ? "$" + chalk.greenBright(arg.value)
                                    : arg.type == "raw" ? chalk.yellowBright(arg.value)
                                        : unreachable()
            ).join(", ")}`)
        }
    }

    return lines.join("\n")
}

const rl = createInterface(process.stdin, process.stdout)
rl.pause()

const sourcePath = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(__dirname, "../../test/units/hello.lenk")
const source = readFileSync(sourcePath).toString()

const ast = Parser.parse(new SourceFile(sourcePath, source))

if (ast instanceof Diagnostic) {
    console.log(inspect(ast, undefined, Infinity, true))
} else {
    const globalScope = new Typing.Scope()
    globalScope.register("Number", Primitives.Number.TYPE)
    globalScope.registerMany("Number", {
        "@invoke": new FunctionDefinition(Span.native, "@invoke").addOverload(Primitives.Number.CTOR)
    })
    globalScope.register("Char", Primitives.Char.TYPE)
    globalScope.registerMany("Char", {
        "@invoke": new FunctionDefinition(Span.native, "@invoke").addOverload(Primitives.Char.CTOR)
    })
    globalScope.register("Void", Void.TYPE)

    for (const operatorName of [
        "ADD", "SUB", "MUL", "DIV",
        "MOD", "EQ", "LT", "GT", "LTE",
        "GTE", "NEGATE", "AND", "OR"
    ]) {
        const funcName = `@${operatorName.toLowerCase()}`
        const definition = new FunctionDefinition(Span.native, funcName)

        const intrinsic = (IntrinsicMaths as any)[operatorName]
        if (intrinsic) definition.addOverload(intrinsic)
        for (const primitiveName of ["Number", "Char"]) {
            const constexprFunction = (Primitives as any)[primitiveName][`CONST_${operatorName}`]
            if (constexprFunction) definition.addOverload(constexprFunction)
        }
        globalScope.register(funcName, definition)
    }

    globalScope.register("@assign", new FunctionDefinition(Span.native, "@assign")
        .addOverload(new IntrinsicMaths.Assignment())
    )

    globalScope.register("@as_ptr", new FunctionDefinition(Span.native, "@as_ptr").addOverload(Pointer.AS_POINTER_OPERATOR))
    globalScope.register("@addr", new FunctionDefinition(Span.native, "@addr").addOverload(Pointer.ADDRESS_OF_OPERATOR))
    globalScope.register("@deref", new FunctionDefinition(Span.native, "@deref").addOverload(Pointer.DEREF_OPERATOR))

    globalScope.register("@as_slice", new FunctionDefinition(Span.native, "@as_slice").addOverload(Slice.AS_SLICE_OPERATOR))
    globalScope.register("@index", new FunctionDefinition(Span.native, "@index").addOverload(Slice.INDEX_OPERATOR))

    globalScope.register("__createTuple", new FunctionDefinition(Span.native, "__createTuple").addOverload(Tuple.CREATE_TUPLE))
    globalScope.register("Tuple", new FunctionDefinition(Span.native, "Tuple").addOverload(Tuple.TYPE))

    globalScope.register("@reinterpret", new FunctionDefinition(Span.native, "@reinterpret").addOverload(REINTERPRET_OPERATOR))

    const program = Typing.parse(ast, globalScope)
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

        const build = assembler.build()
        const disassembler = new Disassembler(build)
        for (const disassembly of disassembler) {
            console.log(stringifyFunctionDisassembly(disassembly))
        }
        const vm = new BytecodeVM(build.header, build.data)

        const print: BytecodeVM.ExternFunction = (ctx, vm) => {
            const value = vm.stack.read(ctx.references[0], ctx.function.arguments[0].size)
            console.log(chalk.cyanBright("==>"), value)
            vm.resume(MemoryView.empty)
        }

        vm.externFunctions.set("print(msg: Number): Void", print)
        vm.externFunctions.set("print(msg: Char): Void", print)
        vm.externFunctions.set("print(msg: *Number): Void", print)
        vm.externFunctions.set("print(msg: []Char): Void", (ctx, vm) => {
            const [ptr, size] = vm.stack.read(ctx.references[0], ctx.function.arguments[0].size).as(Float64Array)
            const msg = new TextDecoder().decode(vm.loadPointer(ptr, size).as(Uint8Array))
            console.log(chalk.cyanBright("==>"), msg)

            vm.resume(MemoryView.empty)
        })

        for (const name of build.header.reflection.templates["printf"].specializations) {
            const specialization = build.header.reflection.functions[name]
            const typeName = specialization.args[0].type
            const type = build.header.reflection.types[typeName]

            vm.externFunctions.set(name, (ctx, vm) => {
                const decoder = new TextDecoder()
                function loadString(slice: MemoryView) {
                    const [ptr, size] = slice.as(Float64Array)
                    return decoder.decode(vm.loadPointer(ptr, size).as(Uint8Array))
                }

                function serialize(value: MemoryView, type: DebugInfo.TypeInfo) {
                    if (type.name == "[]Char") return loadString(value)
                    if (type.name.startsWith("[]")) return serializeSlice(value, type)
                    if (type.detail?.props) return serializeStruct(value, type)
                    if (type.name == "Number") return value.as(Float64Array)[0]
                    if (type.name == "Char") return value.as(Uint8Array)[0]
                    if (type.name[0] == "*") return { [inspect.custom]: () => chalk.greenBright(`(${type.name}) 0x${value.as(Float64Array)[0].toString(16)}`) }

                    return value
                }

                function serializeStruct(value: MemoryView, struct: DebugInfo.TypeInfo) {
                    const result: Record<string, any> = {}

                    for (let { name, offset, type } of struct.detail!.props!) {
                        const typeInfo = build.header.reflection.types[type]
                        if (!typeInfo) throw new Error(`Cannot get type info of "${type}"`)
                        const propertyValue = value.slice(offset, typeInfo.size)

                        result[name] = serialize(propertyValue, typeInfo)
                    }

                    return result
                }

                function serializeSlice(slice: MemoryView, type: DebugInfo.TypeInfo) {
                    const elementType = build.header.reflection.types[type.detail!.base!]
                    if (!elementType) throw new Error(`Cannot get type info of "${type.detail!.base!}"`)
                    const result: any[] = []
                    const [start, length] = slice.as(Float64Array)

                    for (let i = 0; i < length; i++) {
                        result.push(serialize(vm.loadPointer(start + i * elementType.size, elementType.size), elementType))
                    }


                    return result
                }

                const [literalsProp, expressionsProp] = type.detail!.props!
                const literalsType = build.header.reflection.types[literalsProp.type]
                const expressionsType = build.header.reflection.types[expressionsProp.type]

                const format: string[] = []

                const literalsLength = literalsType.detail!.props!.length
                const expressionsLength = expressionsType.detail!.props!.length

                for (let i = 0; i < literalsLength; i++) {
                    const slice = vm.stack.read(ctx.references[0] + 16 * i, 16)
                    format.push(loadString(slice))
                    if (i < expressionsLength) {
                        const prop = expressionsType.detail!.props![i]
                        const type = build.header.reflection.types[prop.type]
                        const value = vm.stack.read(ctx.references[0] + expressionsProp.offset + prop.offset, type.size)
                        format.push(inspect(serialize(value, type), true, Infinity, true))
                    }
                }

                // eslint-disable-next-line no-console
                console.log(format.join(""))
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