# Introduction

Author: [dreampuf](https://github.com/dreampuf/)

[GraphvizOnline](https://github.com/dreampuf/GraphvizOnline) lets you edit and view [GraphViz](http://www.graphviz.org/) diagrams online. You can [use GraphvizOnline online here](http://dreampuf.github.io/GraphvizOnline/).

## Graph from URL / Gist

You can display a graph defined in a gist, or any other publically available url by adding a `?url=` parameter to the GraphvizOnline url

Example: https://dreampuf.github.io/GraphvizOnline/?url=https://gist.githubusercontent.com/timabell/da08616ecb8693d524b8eab3b7b51018/raw/0e205c341b40641206a55c9f96b5db9b8fa581bc/graph.gv

Using https://gist.github.com/ allows you to share and version your graph definitions.

## Presentation mode

If you would like to display just the graph and not the graph input, you can add a `?presentation` query param. This can be helpful when generating links with the graph already prefilled. You might set the param to comma separated list of the following values:

- `editable`: show the editor-toggle button
- `hide-options`: hide the options bar at top of page
- `show-engine`, `show-format`, `show-raw`, `show-download`, `show-share`: show some some options in conjuntion with `hide-options`

Example: `?presentation=editable,hide-options,show-download`

## Deploy to Wasmer Edge

[![Deploy to Wasmer](https://img.shields.io/badge/Deploy%20to-Wasmer-171717?logo=wasmer&logoColor=white)](https://wasmer.io/apps/create?github=dreampuf%2FGraphvizOnline)

GraphvizOnline is plain static files with no build step, so it can be served as-is. Fork this repository and import your fork if you want to customize it: the import serves the repository you choose and does not copy it into your GitHub account. The editor loads `lz-string` from cdnjs, and the Share button calls `api.allorigins.win` and `is.gd` to shorten links.

# How to implement this

- [viz.js](https://github.com/mdaines/viz.js) This repo has compile graphviz(C) to javascript via [emscripten](https://github.com/kripken/emscripten).
- [ACE-editor](http://ace.ajax.org/) An amazing online editor.

# License

GraphvizOnline licensed under BSD-3 license. The dependencies:

- [viz.js](https://github.com/mdaines/viz.js/blob/master/LICENSE) MIT
- [ACE-editor](https://github.com/ajaxorg/ace/blob/master/LICENSE) BSD-2
