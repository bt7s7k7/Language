import { Diagnostic } from "../../Diagnostic"
import { Span } from "../../Span"
import { Type } from "../Type"
import { Typing } from "../Typing"
import { ConstExpr } from "./ConstExpr"
import { FunctionDefinition } from "./FunctionDefinition"
import { SpecificFunction } from "./SpecificFunction"

class SpecializationFunction extends SpecificFunction {
    public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
        if (args.length != this.template.params.length) return new Diagnostic(`Template expected ${this.template.params.length} arguments, but ${args.length} provided`, span)

        const result = this.template.specializationFactory(context.rootScope, args.map(v => v.type instanceof ConstExpr ? v.type.value : v.type))

        return {
            target: this,
            arguments: this.template.params.map((v, i) => ({ name: v, type: args[i].type })),
            result: new ConstExpr(span, Type.TYPE, result)
        }
    }

    constructor(
        public readonly template: TemplatedEntity
    ) {
        super(template.span, template.name)
    }
}

export class TemplatedEntity extends Type {
    public readonly specialization = new FunctionDefinition(this.span, this.name).addOverload(new SpecializationFunction(this))

    constructor(
        span: Span,
        name: string,
        public readonly params: string[],
        public readonly specializationFactory: (rootScope: Typing.Scope, args: Type[]) => Type
    ) { super(span, name, Type.NOT_INSTANTIABLE) }
}