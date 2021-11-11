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

    export const ADD = 101
    export const SUB = 102
    export const MUL = 103
    export const DIV = 104
    export const MOD = 105
    export const EQ = 151
    export const LT = 152
    export const GT = 153
    export const LTE = 152
    export const GTE = 153

    export const BR_TRUE = 50
    export const BR_FALSE = 51
    export const BR = 52

    export namespace Types {
        export const UINT32 = 5
        export const FLOAT64 = 10
    }
}