# Introduction

Author: [dreampuf](https://github.com/dreampuf/)

[GraphvizOnline](https://github.com/dreampuf/GraphvizOnline) lets you edit and view [GraphViz](http://www.graphviz.org/) diagrams online. You can [use GraphvizOnline online here](http://dreampuf.github.io/GraphvizOnline/).

## Graph from URL / Gist

You can display a graph defined in a gist, or any other publically available url by adding a `?url=` parameter to the GraphvizOnline url

Example: https://dreampuf.github.io/GraphvizOnline/?url=https://gist.githubusercontent.com/timabell/da08616ecb8693d524b8eab3b7b51018/raw/0e205c341b40641206a55c9f96b5db9b8fa581bc/graph.gv

Using https://gist.github.com/ allows you to share and version your graph definitions.

# How to implement this

- [viz.js](https://github.com/mdaines/viz.js) This repo has compile graphviz(C) to javascript via [emscripten](https://github.com/kripken/emscripten).
- [ACE-editor](http://ace.ajax.org/) An amazing online editor.

# License

GraphvizOnline licensed under BSD-3 license. The dependencies:

- [viz.js](https://github.com/mdaines/viz.js/blob/master/LICENSE) MIT
- [ACE-editor](https://github.com/ajaxorg/ace/blob/master/LICENSE) BSD-2
