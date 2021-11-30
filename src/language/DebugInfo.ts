import { createShadowObject, ensureProperty } from "../comTypes/util"
import { Type } from "./typing/Type"
import { ProgramFunction } from "./typing/types/ProgramFunction"
import { Struct } from "./typing/types/Struct"

function makeBuilder<T extends Record<string, any>, M>(target: T, methods: M & ThisType<T & M>) {
    return Object.assign(createShadowObject(target), methods) as T & M
}

export interface DebugInfo {
    functions: Record<string, DebugInfo.FunctionInfo>
    templates: Record<string, DebugInfo.TemplateInfo>
    types: Record<string, DebugInfo.TypeInfo>
}

export namespace DebugInfo {
    export class Builder {
        public readonly functions: Record<string, DebugInfo.FunctionInfo> = {}
        public readonly templates: Record<string, DebugInfo.TemplateInfo> = {}
        public readonly types: Record<string, DebugInfo.TypeInfo> = {}

        public type(type: Type) {
            return makeBuilder(ensureProperty(this.types, type.name, () => ({
                name: type.name,
                size: type.size,
                detail: type.getDetail(this),
                template: null
            })), {
                setName(name: string) {
                    this.name = name
                    return this
                },
                setDetail(detail: any) {
                    this.detail = detail
                    return this
                },
                setSize(size: number) {
                    this.size = size
                    return this
                },
                setTemplate(template: string | null) {
                    this.template = template
                    return this
                }
            })
        }

        public func(func: ProgramFunction) {
            const self = this

            const signature = func.getSignature()

            return makeBuilder(ensureProperty(this.functions, func.name, () => ({
                name: func.name,
                template: null,
                result: self.type(signature.result).name,
                args: signature.arguments.map(v => ({ type: self.type(v.type).name, name: v.name })),
            })), {
                setTemplate(template: string | null) {
                    this.template = template
                    return this
                }
            })
        }

        public template(name: string) {
            const self = this

            return makeBuilder(ensureProperty(this.templates, name, () => ({
                name,
                specializations: []
            })), {
                addSpecialization(target: ProgramFunction | Struct) {
                    if (this.specializations.includes(target.name)) return

                    const info = self[target instanceof Struct ? "type" : "func"](target as any)
                    this.specializations.push(info.name)
                    info.setTemplate(this.name)

                    return this
                }
            })
        }

        public build(): DebugInfo {
            return { ...this }
        }
    }

    export interface FunctionInfo {
        name: string
        result: string
        args: { name: string, type: string }[]
        template: string | null
    }

    export interface TemplateInfo {
        name: string
        specializations: string[]
    }

    export interface TypeInfo {
        name: string
        size: number
        detail: any
        template: string | null
    }

    export interface Data {

    }
}