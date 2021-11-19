import { Span } from "../../Span"
import { Value } from "../../typing/Value"
import { ASTNode } from "../ASTNode"
import { IdentifierNode } from "./IdentifierNode"
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