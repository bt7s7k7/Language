/// <reference path="./.vscode/config.d.ts" />

const { project, github } = require("ucpem")

project.prefix("src").res("app",
    github("bt7s7k7/CommonTypes").res("comTypes")
)