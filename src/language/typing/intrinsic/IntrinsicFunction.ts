import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { SpecificFunction } from "../types/SpecificFunction"
import { Invocation } from "../values/Invocation"

export abstract class IntrinsicFunction extends SpecificFunction {
    public abstract emit(builder: FunctionIRBuilder, invocation: Invocation): number
}