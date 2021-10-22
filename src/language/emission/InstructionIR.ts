export interface InstructionIR {
    code: number
    subtype: number
    args: (string | number)[]
}

export interface LabelIR {
    label: string
}

export type AnyInstructionIR = InstructionIR | LabelIR