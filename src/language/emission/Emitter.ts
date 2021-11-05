import { Diagnostic } from "../Diagnostic"
import { Span } from "../Span"
import { Program } from "../typing/Program"
import { Type } from "../typing/Type"
import { Void } from "../typing/types/base"
import { FunctionDefinition } from "../typing/types/FunctionDefinition"
import { ProgramFunction } from "../typing/types/ProgramFunction"
import { Block } from "../typing/values/Block"
import { Return } from "../typing/values/Return"
import { Instructions } from "../vm/Instructions"
import { EmissionUtil } from "./EmissionUtil"
import { FunctionIR } from "./FunctionIR"
import { FunctionIRBuilder } from "./FunctionIRBuilder"

class EmittingError extends Error {
    public name = "EmittingError"
    public readonly diagnostics
    constructor(
        ...diagnostics: Diagnostic[]
    ) { super(); this.diagnostics = diagnostics }
}

export namespace Emitter {
    export function emit(program: Program) {
        const functions = new Map<string, FunctionIR>()

        for (const symbol of program.entries.values()) {
            if (symbol instanceof FunctionDefinition) {
                for (const overload of symbol.overloads) {
                    if (overload instanceof ProgramFunction) {
                        const builder = new FunctionIRBuilder(overload.name)

                        for (const arg of overload.args) {
                            if (arg.type.size == Type.NOT_INSTANTIABLE) throw new EmittingError(new Diagnostic("Type is not instantiable", arg.span))
                            builder.registerVariable("arguments", arg.span, arg.name, arg.type.size)
                        }

                        if (overload.body != "extern") {
                            if (overload.body instanceof Block) {
                                overload.body.emit(builder)
                            } else {
                                new Block(Span.native, [new Return(Span.native, overload.body)]).emit(builder)
                            }
                        }

                        if (overload.result == Void.TYPE && builder.lastInstruction?.code != Instructions.RETURN) {
                            builder.pushInstruction(Instructions.RETURN)
                        }

                        builder.registerVariable("returns", overload.result.span, EmissionUtil.RETURN_VARIABLE_NAME, overload.result.size)

                        functions.set(overload.name, {
                            isExtern: overload.body == "extern",
                            instructions: builder.instructions,
                            variables: builder.variables,
                            data: builder.data,
                            name: overload.name,
                            span: overload.span
                        })
                    }
                }
            }
        }

        return functions
    }
}