import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
export const IMPLICIT_SPECIALIZATION_STRATEGY_TYPES = ["any", "child"] as const

export interface ImplicitSpecializationStrategy {
    type: (typeof IMPLICIT_SPECIALIZATION_STRATEGY_TYPES)[number]
    index: number
}

export interface TemplateParameter {
    span: Span
    name: string
    strategy: ImplicitSpecializationStrategy | null
}

export class TemplateNode extends ASTNode {
    constructor(
        span: Span,
        public readonly params: TemplateParameter[],
        public entity: ASTNode | null
    ) { super(span) }
}