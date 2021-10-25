import { EOPNOTSUPP } from "constants"
import { unreachable } from "../../comTypes/util"
import { Span } from "../Span"
import { ExecutableHeader } from "../vm/ExecutableHeader"
import { AnyInstructionIR } from "./InstructionIR"


export interface FunctionIR {
    isExtern: boolean
    span: Span,
    name: string,
    variables: Map<string, VariableIR>,
    instructions: AnyInstructionIR[]
}

export interface VariableIR {
    type: "variables" | "arguments" | "returns"
    name: string
    size: number
    span: Span
}

export interface AssembledFunction {
    data: ArrayBuffer,
    header: ExecutableHeader.Function
}