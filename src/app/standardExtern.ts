import chalk = require("chalk")
import { Interface } from "readline"
import { inspect, TextDecoder, TextEncoder } from "util"
import { DebugInfo } from "../language/DebugInfo"
import { Assembly } from "../language/emission/Assembler"
import { BytecodeVM } from "../language/vm/BytecodeVM"
import { MemoryView } from "../language/vm/Memory"

export function installStandardExtern(vm: BytecodeVM, build: Assembly, rl: Interface) {
    for (const name of build.header.reflection.templates["printf"].specializations) {
        const specialization = build.header.reflection.functions[name]
        const typeName = specialization.args[0].type
        const type = build.header.reflection.types[typeName]

        vm.externFunctions.set(name, (ctx, vm) => {
            const decoder = new TextDecoder()
            function loadString(slice: MemoryView) {
                const [ptr, size] = slice.as(Float64Array)
                if (ptr == 0) return ""
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
                const slice = vm.activeCoroutine.stack.read(ctx.references[0] + 16 * i, 16)
                format.push(loadString(slice))
                if (i < expressionsLength) {
                    const prop = expressionsType.detail!.props![i]
                    const type = build.header.reflection.types[prop.type]
                    const value = vm.activeCoroutine.stack.read(ctx.references[0] + expressionsProp.offset + prop.offset, type.size)
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

    vm.externFunctions.set("random(): Number", (ctx, vm) => {
        vm.resume(MemoryView.from(new Float64Array([Math.random()]).buffer))
    })
}