export interface ExecutableHeader {
    functions: ExecutableHeader.Function[]
    data: ExecutableHeader.Data[]
}

export namespace ExecutableHeader {
    export interface Function {
        name: string
        offset: number
        size: number
        arguments: Variable[]
        variables: Variable[]
        returns: Variable[]
        labels: Label[]
    }

    export interface Variable {
        name: string
        size: number
    }

    export interface Label {
        name: string
        offset: number
    }

    export interface Data {
        name: string
        size: number
        offset: number
    }
}