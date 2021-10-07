import { Span } from "../../Span"
import { ParentNode } from "../ParentNode"

export class OperatorNode extends ParentNode {
    constructor(
        span: Span,
        public readonly name: string
    ) { super(span) }
}