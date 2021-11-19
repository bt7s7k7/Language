import { unreachable } from "../../../comTypes/util"
import { TemplateParameter } from "../../ast/nodes/TemplateNode"
import { Diagnostic } from "../../Diagnostic"
import { Span } from "../../Span"
import { Type } from "../Type"
import { Typing } from "../Typing"
import { ConstExpr } from "./ConstExpr"
import { FunctionDefinition } from "./FunctionDefinition"
import { Pointer } from "./Pointer"
import { Reference } from "./Reference"
import { Slice } from "./Slice"
import { SpecificFunction } from "./SpecificFunction"

class SpecializationFunction extends SpecificFunction {
    public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
        if (args.length != this.template.params.length) return new Diagnostic(`Template expected ${this.template.params.length} arguments, but ${args.length} provided`, span)

        const result = this.template.specializationFactory(context.rootScope, args.map(v => v.type instanceof ConstExpr ? v.type.value : v.type))

        return {
            target: this,
            arguments: this.template.params.map((v, i) => ({ name: v.name, type: args[i].type })),
            result: new ConstExpr(span, Type.TYPE, result)
        }
    }

    constructor(
        public readonly template: TemplatedEntity
    ) { super(template.span, template.name) }
}

class ImplicitSpecializationFunction extends SpecificFunction {
    public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic | Diagnostic[] {
        if (!this.template.isImplicit) return new Diagnostic("Template does not have an ISS", span)

        const generatedParams: SpecificFunction.ArgumentInfo[] = []
        for (const { strategy } of this.template.params) {
            if (!strategy) throw unreachable()

            if (strategy.type == "any" || strategy.type == "child") {
                const target = args[strategy.index]
                if (!target) return new Diagnostic(`According to the template ISS, there should be an argument at pos ${strategy.index}`, span)
                const type = Reference.dereference(target.type)
                if (strategy.type == "any") {
                    generatedParams.push({ span: target.span, type })
                } else if (strategy.type == "child") {
                    if (!(type instanceof Pointer || type instanceof Slice)) return new Diagnostic(`According to the template ISS, argument at pos ${strategy.index} should be a native parent type`, span)
                    generatedParams.push({ span: target.span, type: type.type })

                }

                continue
            }

            throw unreachable()
        }

        const specializationMatch = this.template.specialization.findOverload(span, generatedParams, context)
        if (specializationMatch instanceof Array) return specializationMatch

        let specialization = specializationMatch.result as FunctionDefinition
        if (specialization instanceof ConstExpr) specialization = specialization.value
        const entityMatch = specialization.findOverload(span, args, context)

        if (!(entityMatch instanceof Array)) context.debug.template(this.template.name).addSpecialization(entityMatch)

        return entityMatch
    }

    constructor(
        public readonly template: TemplatedEntity
    ) { super(template.span, template.name) }
}

export class TemplatedEntity extends Type {
    public readonly specialization = new FunctionDefinition(this.span, this.name).addOverload(new SpecializationFunction(this))
    public readonly implicitSpecialization = new FunctionDefinition(this.span, this.name).addOverload(new ImplicitSpecializationFunction(this))

    constructor(
        span: Span,
        name: string,
        public readonly params: TemplateParameter[],
        public readonly isImplicit: boolean,
        public readonly specializationFactory: (rootScope: Typing.Scope, args: Type[]) => Type
    ) { super(span, name, Type.NOT_INSTANTIABLE) }
}