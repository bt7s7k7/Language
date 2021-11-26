import { createShadowObject, ensureProperty } from "../comTypes/util"
import { Type } from "./typing/Type"
import { SpecificFunction } from "./typing/types/SpecificFunction"

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
                detail: type.getDetail(this)
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
                }
            })
        }

        public func(signature: SpecificFunction.Signature) {
            const self = this

            return makeBuilder(ensureProperty(this.functions, signature.target.name, () => ({
                name: signature.target.name,
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
                addSpecialization(func: SpecificFunction.Signature) {
                    if (this.specializations.includes(func.target.name)) return

                    const info = self.func(func)
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
    }

    export interface Data {

    }
}