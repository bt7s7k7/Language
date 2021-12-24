export interface InstructionInfo {
    label: string
    subtype?: null | "size" | "type"
    args?: InstructionInfo.ArgumentType[]
}

export namespace InstructionInfo {
    export type ArgumentType = "const" | "var" | "jump" | "func" | "data" | "raw"
}

export namespace Instructions {
    export const LOAD = 1
    export const STORE = 2
    export const RETURN = 3
    export const CONST = 4
    export const DROP = 5
    export const CALL = 6
    export const VAR_PTR = 7
    export const DATA_PTR = 8
    export const LOAD_PTR = 9
    export const STORE_PTR = 10
    export const MEMBER = 11
    export const ALLOC = 12
    export const FREE = 13
    export const ALLOC_ARR = 14
    export const STACK_COPY = 16
    export const STACK_SWAP = 17
    export const STACK_PTR = 18
    export const STORE_PTR_ALT = 19

    export const ADD = 101
    export const SUB = 102
    export const MUL = 103
    export const DIV = 104
    export const MOD = 105
    export const NUM_CNV = 116
    export const EQ = 151
    export const LT = 152
    export const GT = 153
    export const LTE = 152
    export const GTE = 153

    export const BR_TRUE = 50
    export const BR_FALSE = 51
    export const BR = 52

    export namespace Types {
        export const UINT8 = 5
        export const FLOAT64 = 10

        export const names: Partial<Record<number, string>> = {
            5: "u8",
            10: "f64"
        }
    }

    export const info: Partial<Record<number, InstructionInfo>> = {
        [LOAD]: { label: "load", subtype: "size", args: ["var"] },
        [STORE]: { label: "store", subtype: "size", args: ["var"] },
        [RETURN]: { label: "return" },
        [CONST]: { label: "const", subtype: "size", args: ["const"] },
        [DROP]: { label: "drop", subtype: "size" },
        [CALL]: { label: "call", args: ["func"] },
        [VAR_PTR]: { label: "var_ptr", args: ["var"] },
        [DATA_PTR]: { label: "data_ptr", args: ["data"] },
        [LOAD_PTR]: { label: "load_ptr", subtype: "size" },
        [STORE_PTR]: { label: "store_ptr", subtype: "size" },
        [STORE_PTR_ALT]: { label: "store_ptr_alt", subtype: "size" },
        [MEMBER]: { label: "member", subtype: "size", args: ["raw", "raw"] },
        [ALLOC]: { label: "alloc", subtype: "size" },
        [FREE]: { label: "free" },
        [ALLOC_ARR]: { label: "alloc_arr", subtype: "size" },
        [STACK_COPY]: { label: "stack_copy", subtype: "size" },
        [STACK_SWAP]: { label: "stack_swap", subtype: "size" },
        [ADD]: { label: "add", subtype: "type" },
        [SUB]: { label: "sub", subtype: "type" },
        [MUL]: { label: "mul", subtype: "type" },
        [DIV]: { label: "div", subtype: "type" },
        [MOD]: { label: "mod", subtype: "type" },
        [EQ]: { label: "eq", subtype: "type" },
        [LT]: { label: "lt", subtype: "type" },
        [GT]: { label: "gt", subtype: "type" },
        [LTE]: { label: "lte", subtype: "type" },
        [GTE]: { label: "gte", subtype: "type" },
        [BR_TRUE]: { label: "br_true", subtype: "type", args: ["jump"] },
        [BR_FALSE]: { label: "br_false", subtype: "type", args: ["jump"] },
        [BR]: { label: "br", args: ["jump"] },
        [NUM_CNV]: { label: "num_cnv", subtype: "type" }
    }
}