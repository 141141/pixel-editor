(function(pkg) {
  // Expose a require for our package so scripts can access our modules
  window.require = Require.generateFor(pkg);
})({
  "version": "0.1.0",
  "source": {
    "LICENSE": {
      "path": "LICENSE",
      "mode": "100644",
      "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
      "type": "blob"
    },
    "README.md": {
      "path": "README.md",
      "mode": "100644",
      "content": "pixel-editor\n============\n\nIt edits pixels\n",
      "type": "blob"
    },
    "command.coffee.md": {
      "path": "command.coffee.md",
      "mode": "100644",
      "content": "Command\n=======\n\nCommands that can be undone in the editor.\n\n    module.exports =\n      ChangePixel: (data, editor) ->\n        previous = editor.getPixel(data)\n\n        execute: ->\n          editor.changePixel(data)\n\n        undo: ->\n          editor.changePixel(previous)\n\n      Composite: ->\n        commands = []\n\n        execute: ->\n          commands.invoke \"execute\"\n\n        undo: ->\n          # Undo last command first because the order matters\n          commands.copy().reverse().invoke \"undo\"\n\n        push: (command, noExecute) ->\n          # We execute commands immediately when pushed in the compound\n          # so that the effects of events during mousemove appear\n          # immediately but they are all revoked together on undo/redo\n          # Passing noExecute as true will skip executing if we are\n          # adding commands that have already executed.\n          commands.push command\n          command.execute() unless noExecute\n",
      "type": "blob"
    },
    "editor.coffee.md": {
      "path": "editor.coffee.md",
      "mode": "100644",
      "content": "Pixel Editor\n============\n\nEditing pixels in your browser.\n\n    require \"jquery-utils\"\n\n    require \"./lib/canvas-to-blob\"\n    saveAs = require \"./lib/file_saver\"\n\n    runtime = require(\"runtime\")(PACKAGE)\n    runtime.boot()\n    runtime.applyStyleSheet(require('./style'))\n\n    TouchCanvas = require \"touch-canvas\"\n\n    Command = require \"./command\"\n    Undo = require \"./undo\"\n    Hotkeys = require \"./hotkeys\"\n    Tools = require \"./tools\"\n\n    Palette = require(\"./palette\")\n\n    template = require \"./templates/editor\"\n    debugTemplate = require \"./templates/debug\"\n\n    {Grid, Size, download} = require \"./util\"\n\n    Editor = (I={}, self) ->\n      activeIndex = Observable(1)\n\n      pixelExtent = Size(16, 16)\n      pixelSize = 20\n      canvasSize = pixelExtent.scale(pixelSize)\n      palette = Palette.defaults\n\n      canvas = null\n      lastCommand = null\n\n      self ?= Model(I)\n\n      self.include Undo\n      self.include Hotkeys\n      self.include Tools\n\n      activeTool = self.activeTool\n\n      pixels = Grid(pixelExtent.width, pixelExtent.height, 0)\n\n      self.extend\n        activeIndex: activeIndex\n\n        outputCanvas: ->\n          outputCanvas = TouchCanvas pixelExtent\n\n          pixels.each (index, x, y) ->\n            outputCanvas.drawRect\n              x: x\n              y: y\n              width: 1\n              height: 1\n              color: palette[index]\n\n          outputCanvas.element()\n\n        download: ->\n          self.outputCanvas().toBlob (blob) ->\n            saveAs blob, prompt(\"File name\", \"image.png\")\n\n        toDataURL: ->\n          console.log self.outputCanvas().toDataURL(\"image/png\")\n\n        draw: ({x, y}) ->\n          lastCommand.push Command.ChangePixel\n            x: x\n            y: y\n            index: activeIndex()\n          , self\n\n        changePixel: ({x, y, index})->\n          pixels.set(x, y, index) unless canvas is previewCanvas\n\n          color = palette[index]\n\n          if color is \"transparent\"\n            canvas.clear\n              x: x * pixelSize\n              y: y * pixelSize\n              width: pixelSize\n              height: pixelSize\n          else\n            canvas.drawRect\n              x: x * pixelSize\n              y: y * pixelSize\n              width: pixelSize\n              height: pixelSize\n              color: color\n\n        getPixel: ({x, y}) ->\n          x: x\n          y: y\n          index: pixels.get(x, y)\n\n        palette: Observable(palette)\n\nThis preview function is a little nuts, but I'm not sure how to clean it up.\n\nIt makes a copy of the current command chunk for undoing, sets the canvas\nequal to the preview canvas, then executes the passed in function.\n\nWe'll probably want to use a whole preview layer, so we don't need to worry about\naccidentally setting the pixel values during the preview.\n\n        preview: (fn) ->\n          realCommand = lastCommand\n          lastCommand = Command.Composite()\n          realCanvas = canvas\n          canvas = previewCanvas\n\n          canvas.clear()\n\n          fn()\n\n          canvas = realCanvas\n          lastCommand = realCommand\n\n      $('body').append template self\n\n      canvas = TouchCanvas canvasSize\n      previewCanvas = TouchCanvas canvasSize\n\n      # TODO: Tempest should have an easier way to do this\n      updateActiveColor = (newIndex) ->\n        color = palette[newIndex]\n\n        $(\".palette .current\").css\n          backgroundColor: color\n\n      updateActiveColor(activeIndex())\n      activeIndex.observe updateActiveColor\n\n      $('.viewport').append canvas.element()\n      $(\".viewport\").append $(previewCanvas.element()).addClass(\"preview\")\n\n      previewCanvas.on \"touch\", (position) ->\n        lastCommand = Command.Composite()\n        self.execute lastCommand\n\n        activeTool().touch\n          position: position.scale(pixelExtent).floor()\n          editor: self\n\n      previewCanvas.on \"move\", (position) ->\n        activeTool().move\n          position: position.scale(pixelExtent).floor()\n          editor: self\n\n      previewCanvas.on \"release\", (position) ->\n        activeTool().release\n          position: position.scale(pixelExtent).floor()\n          editor: self\n\n        previewCanvas.clear()\n\n      return self\n\n    Editor()\n",
      "type": "blob"
    },
    "hotkeys.coffee.md": {
      "path": "hotkeys.coffee.md",
      "mode": "100644",
      "content": "Hotkeys\n=======\n\nHotkeys for the pixel editor.\n\n    module.exports = (I={}, self)->\n      self.extend\n        addHotkey: (key, method) ->\n          $(document).bind \"keydown\", key, ->\n            self[method]()\n\n      hotkeys =\n        \"ctrl+z\": \"undo\"\n        \"ctrl+y\": \"redo\"\n        \"ctrl+s\": \"download\"\n        \"ctrl+b\": \"toDataURL\"\n\n      Object.keys(hotkeys).forEach (key) ->\n        self.addHotkey(key, hotkeys[key])\n\n      return self\n",
      "type": "blob"
    },
    "lib/canvas-to-blob.js": {
      "path": "lib/canvas-to-blob.js",
      "mode": "100644",
      "content": "/* canvas-toBlob.js\n * A canvas.toBlob() implementation.\n * 2011-07-13\n * \n * By Eli Grey, http://eligrey.com and Devin Samarin, https://github.com/eboyjr\n * License: X11/MIT\n *   See LICENSE.md\n */\n\n/*global self */\n/*jslint bitwise: true, regexp: true, confusion: true, es5: true, vars: true, white: true,\n  plusplus: true */\n\n/*! @source http://purl.eligrey.com/github/canvas-toBlob.js/blob/master/canvas-toBlob.js */\n\n(function(view) {\n\"use strict\";\nvar\n    Uint8Array = view.Uint8Array\n\t, HTMLCanvasElement = view.HTMLCanvasElement\n\t, is_base64_regex = /\\s*;\\s*base64\\s*(?:;|$)/i\n\t, base64_ranks\n\t, decode_base64 = function(base64) {\n\t\tvar\n\t\t\t  len = base64.length\n\t\t\t, buffer = new Uint8Array(len / 4 * 3 | 0)\n\t\t\t, i = 0\n\t\t\t, outptr = 0\n\t\t\t, last = [0, 0]\n\t\t\t, state = 0\n\t\t\t, save = 0\n\t\t\t, rank\n\t\t\t, code\n\t\t\t, undef\n\t\t;\n\t\twhile (len--) {\n\t\t\tcode = base64.charCodeAt(i++);\n\t\t\trank = base64_ranks[code-43];\n\t\t\tif (rank !== 255 && rank !== undef) {\n\t\t\t\tlast[1] = last[0];\n\t\t\t\tlast[0] = code;\n\t\t\t\tsave = (save << 6) | rank;\n\t\t\t\tstate++;\n\t\t\t\tif (state === 4) {\n\t\t\t\t\tbuffer[outptr++] = save >>> 16;\n\t\t\t\t\tif (last[1] !== 61 /* padding character */) {\n\t\t\t\t\t\tbuffer[outptr++] = save >>> 8;\n\t\t\t\t\t}\n\t\t\t\t\tif (last[0] !== 61 /* padding character */) {\n\t\t\t\t\t\tbuffer[outptr++] = save;\n\t\t\t\t\t}\n\t\t\t\t\tstate = 0;\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t\t// 2/3 chance there's going to be some null bytes at the end, but that\n\t\t// doesn't really matter with most image formats.\n\t\t// If it somehow matters for you, truncate the buffer up outptr.\n\t\treturn buffer;\n\t}\n;\nif (Uint8Array) {\n\tbase64_ranks = new Uint8Array([\n\t\t  62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1\n\t\t, -1, -1,  0, -1, -1, -1,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9\n\t\t, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25\n\t\t, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35\n\t\t, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51\n\t]);\n}\nif (HTMLCanvasElement && !HTMLCanvasElement.prototype.toBlob) {\n\tHTMLCanvasElement.prototype.toBlob = function(callback, type /*, ...args*/) {\n\t\t  if (!type) {\n\t\t\ttype = \"image/png\";\n\t\t} if (this.mozGetAsFile) {\n\t\t\tcallback(this.mozGetAsFile(\"canvas\", type));\n\t\t\treturn;\n\t\t}\n\t\tvar\n\t\t\t  args = Array.prototype.slice.call(arguments, 1)\n\t\t\t, dataURI = this.toDataURL.apply(this, args)\n\t\t\t, header_end = dataURI.indexOf(\",\")\n\t\t\t, data = dataURI.substring(header_end + 1)\n\t\t\t, is_base64 = is_base64_regex.test(dataURI.substring(0, header_end))\n\t\t\t, blob\n\t\t;\n\t\tif (Blob.fake) {\n\t\t\t// no reason to decode a data: URI that's just going to become a data URI again\n\t\t\tblob = new Blob\n\t\t\tif (is_base64) {\n\t\t\t\tblob.encoding = \"base64\";\n\t\t\t} else {\n\t\t\t\tblob.encoding = \"URI\";\n\t\t\t}\n\t\t\tblob.data = data;\n\t\t\tblob.size = data.length;\n\t\t} else if (Uint8Array) {\n\t\t\tif (is_base64) {\n\t\t\t\tblob = new Blob([decode_base64(data)], {type: type});\n\t\t\t} else {\n\t\t\t\tblob = new Blob([decodeURIComponent(data)], {type: type});\n\t\t\t}\n\t\t}\n\t\tcallback(blob);\n\t};\n}\n}(self));\n",
      "type": "blob"
    },
    "lib/file_saver.js": {
      "path": "lib/file_saver.js",
      "mode": "100644",
      "content": "/* FileSaver.js\n * A saveAs() FileSaver implementation.\n * 2013-10-21\n *\n * By Eli Grey, http://eligrey.com\n * License: X11/MIT\n *   See LICENSE.md\n */\n\n/*global self */\n/*jslint bitwise: true, regexp: true, confusion: true, es5: true, vars: true, white: true,\n  plusplus: true */\n\n/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */\n\nvar saveAs = saveAs\n  || (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob && navigator.msSaveOrOpenBlob.bind(navigator))\n  || (function(view) {\n  \"use strict\";\n\tvar\n\t\t  doc = view.document\n\t\t  // only get URL when necessary in case BlobBuilder.js hasn't overridden it yet\n\t\t, get_URL = function() {\n\t\t\treturn view.URL || view.webkitURL || view;\n\t\t}\n\t\t, URL = view.URL || view.webkitURL || view\n\t\t, save_link = doc.createElementNS(\"http://www.w3.org/1999/xhtml\", \"a\")\n\t\t, can_use_save_link =  !view.externalHost && \"download\" in save_link\n\t\t, click = function(node) {\n\t\t\tvar event = doc.createEvent(\"MouseEvents\");\n\t\t\tevent.initMouseEvent(\n\t\t\t\t\"click\", true, false, view, 0, 0, 0, 0, 0\n\t\t\t\t, false, false, false, false, 0, null\n\t\t\t);\n\t\t\tnode.dispatchEvent(event);\n\t\t}\n\t\t, webkit_req_fs = view.webkitRequestFileSystem\n\t\t, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem\n\t\t, throw_outside = function (ex) {\n\t\t\t(view.setImmediate || view.setTimeout)(function() {\n\t\t\t\tthrow ex;\n\t\t\t}, 0);\n\t\t}\n\t\t, force_saveable_type = \"application/octet-stream\"\n\t\t, fs_min_size = 0\n\t\t, deletion_queue = []\n\t\t, process_deletion_queue = function() {\n\t\t\tvar i = deletion_queue.length;\n\t\t\twhile (i--) {\n\t\t\t\tvar file = deletion_queue[i];\n\t\t\t\tif (typeof file === \"string\") { // file is an object URL\n\t\t\t\t\tURL.revokeObjectURL(file);\n\t\t\t\t} else { // file is a File\n\t\t\t\t\tfile.remove();\n\t\t\t\t}\n\t\t\t}\n\t\t\tdeletion_queue.length = 0; // clear queue\n\t\t}\n\t\t, dispatch = function(filesaver, event_types, event) {\n\t\t\tevent_types = [].concat(event_types);\n\t\t\tvar i = event_types.length;\n\t\t\twhile (i--) {\n\t\t\t\tvar listener = filesaver[\"on\" + event_types[i]];\n\t\t\t\tif (typeof listener === \"function\") {\n\t\t\t\t\ttry {\n\t\t\t\t\t\tlistener.call(filesaver, event || filesaver);\n\t\t\t\t\t} catch (ex) {\n\t\t\t\t\t\tthrow_outside(ex);\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t\t, FileSaver = function(blob, name) {\n\t\t\t// First try a.download, then web filesystem, then object URLs\n\t\t\tvar\n\t\t\t\t  filesaver = this\n\t\t\t\t, type = blob.type\n\t\t\t\t, blob_changed = false\n\t\t\t\t, object_url\n\t\t\t\t, target_view\n\t\t\t\t, get_object_url = function() {\n\t\t\t\t\tvar object_url = get_URL().createObjectURL(blob);\n\t\t\t\t\tdeletion_queue.push(object_url);\n\t\t\t\t\treturn object_url;\n\t\t\t\t}\n\t\t\t\t, dispatch_all = function() {\n\t\t\t\t\tdispatch(filesaver, \"writestart progress write writeend\".split(\" \"));\n\t\t\t\t}\n\t\t\t\t// on any filesys errors revert to saving with object URLs\n\t\t\t\t, fs_error = function() {\n\t\t\t\t\t// don't create more object URLs than needed\n\t\t\t\t\tif (blob_changed || !object_url) {\n\t\t\t\t\t\tobject_url = get_object_url(blob);\n\t\t\t\t\t}\n\t\t\t\t\tif (target_view) {\n\t\t\t\t\t\ttarget_view.location.href = object_url;\n\t\t\t\t\t} else {\n                        window.open(object_url, \"_blank\");\n                    }\n\t\t\t\t\tfilesaver.readyState = filesaver.DONE;\n\t\t\t\t\tdispatch_all();\n\t\t\t\t}\n\t\t\t\t, abortable = function(func) {\n\t\t\t\t\treturn function() {\n\t\t\t\t\t\tif (filesaver.readyState !== filesaver.DONE) {\n\t\t\t\t\t\t\treturn func.apply(this, arguments);\n\t\t\t\t\t\t}\n\t\t\t\t\t};\n\t\t\t\t}\n\t\t\t\t, create_if_not_found = {create: true, exclusive: false}\n\t\t\t\t, slice\n\t\t\t;\n\t\t\tfilesaver.readyState = filesaver.INIT;\n\t\t\tif (!name) {\n\t\t\t\tname = \"download\";\n\t\t\t}\n\t\t\tif (can_use_save_link) {\n\t\t\t\tobject_url = get_object_url(blob);\n\t\t\t\t// FF for Android has a nasty garbage collection mechanism\n\t\t\t\t// that turns all objects that are not pure javascript into 'deadObject'\n\t\t\t\t// this means `doc` and `save_link` are unusable and need to be recreated\n\t\t\t\t// `view` is usable though:\n\t\t\t\tdoc = view.document;\n\t\t\t\tsave_link = doc.createElementNS(\"http://www.w3.org/1999/xhtml\", \"a\");\n\t\t\t\tsave_link.href = object_url;\n\t\t\t\tsave_link.download = name;\n\t\t\t\tvar event = doc.createEvent(\"MouseEvents\");\n\t\t\t\tevent.initMouseEvent(\n\t\t\t\t\t\"click\", true, false, view, 0, 0, 0, 0, 0\n\t\t\t\t\t, false, false, false, false, 0, null\n\t\t\t\t);\n\t\t\t\tsave_link.dispatchEvent(event);\n\t\t\t\tfilesaver.readyState = filesaver.DONE;\n\t\t\t\tdispatch_all();\n\t\t\t\treturn;\n\t\t\t}\n\t\t\t// Object and web filesystem URLs have a problem saving in Google Chrome when\n\t\t\t// viewed in a tab, so I force save with application/octet-stream\n\t\t\t// http://code.google.com/p/chromium/issues/detail?id=91158\n\t\t\tif (view.chrome && type && type !== force_saveable_type) {\n\t\t\t\tslice = blob.slice || blob.webkitSlice;\n\t\t\t\tblob = slice.call(blob, 0, blob.size, force_saveable_type);\n\t\t\t\tblob_changed = true;\n\t\t\t}\n\t\t\t// Since I can't be sure that the guessed media type will trigger a download\n\t\t\t// in WebKit, I append .download to the filename.\n\t\t\t// https://bugs.webkit.org/show_bug.cgi?id=65440\n\t\t\tif (webkit_req_fs && name !== \"download\") {\n\t\t\t\tname += \".download\";\n\t\t\t}\n\t\t\tif (type === force_saveable_type || webkit_req_fs) {\n\t\t\t\ttarget_view = view;\n\t\t\t}\n\t\t\tif (!req_fs) {\n\t\t\t\tfs_error();\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tfs_min_size += blob.size;\n\t\t\treq_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {\n\t\t\t\tfs.root.getDirectory(\"saved\", create_if_not_found, abortable(function(dir) {\n\t\t\t\t\tvar save = function() {\n\t\t\t\t\t\tdir.getFile(name, create_if_not_found, abortable(function(file) {\n\t\t\t\t\t\t\tfile.createWriter(abortable(function(writer) {\n\t\t\t\t\t\t\t\twriter.onwriteend = function(event) {\n\t\t\t\t\t\t\t\t\ttarget_view.location.href = file.toURL();\n\t\t\t\t\t\t\t\t\tdeletion_queue.push(file);\n\t\t\t\t\t\t\t\t\tfilesaver.readyState = filesaver.DONE;\n\t\t\t\t\t\t\t\t\tdispatch(filesaver, \"writeend\", event);\n\t\t\t\t\t\t\t\t};\n\t\t\t\t\t\t\t\twriter.onerror = function() {\n\t\t\t\t\t\t\t\t\tvar error = writer.error;\n\t\t\t\t\t\t\t\t\tif (error.code !== error.ABORT_ERR) {\n\t\t\t\t\t\t\t\t\t\tfs_error();\n\t\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t\t};\n\t\t\t\t\t\t\t\t\"writestart progress write abort\".split(\" \").forEach(function(event) {\n\t\t\t\t\t\t\t\t\twriter[\"on\" + event] = filesaver[\"on\" + event];\n\t\t\t\t\t\t\t\t});\n\t\t\t\t\t\t\t\twriter.write(blob);\n\t\t\t\t\t\t\t\tfilesaver.abort = function() {\n\t\t\t\t\t\t\t\t\twriter.abort();\n\t\t\t\t\t\t\t\t\tfilesaver.readyState = filesaver.DONE;\n\t\t\t\t\t\t\t\t};\n\t\t\t\t\t\t\t\tfilesaver.readyState = filesaver.WRITING;\n\t\t\t\t\t\t\t}), fs_error);\n\t\t\t\t\t\t}), fs_error);\n\t\t\t\t\t};\n\t\t\t\t\tdir.getFile(name, {create: false}, abortable(function(file) {\n\t\t\t\t\t\t// delete file if it already exists\n\t\t\t\t\t\tfile.remove();\n\t\t\t\t\t\tsave();\n\t\t\t\t\t}), abortable(function(ex) {\n\t\t\t\t\t\tif (ex.code === ex.NOT_FOUND_ERR) {\n\t\t\t\t\t\t\tsave();\n\t\t\t\t\t\t} else {\n\t\t\t\t\t\t\tfs_error();\n\t\t\t\t\t\t}\n\t\t\t\t\t}));\n\t\t\t\t}), fs_error);\n\t\t\t}), fs_error);\n\t\t}\n\t\t, FS_proto = FileSaver.prototype\n\t\t, saveAs = function(blob, name) {\n\t\t\treturn new FileSaver(blob, name);\n\t\t}\n\t;\n\tFS_proto.abort = function() {\n\t\tvar filesaver = this;\n\t\tfilesaver.readyState = filesaver.DONE;\n\t\tdispatch(filesaver, \"abort\");\n\t};\n\tFS_proto.readyState = FS_proto.INIT = 0;\n\tFS_proto.WRITING = 1;\n\tFS_proto.DONE = 2;\n\n\tFS_proto.error =\n\tFS_proto.onwritestart =\n\tFS_proto.onprogress =\n\tFS_proto.onwrite =\n\tFS_proto.onabort =\n\tFS_proto.onerror =\n\tFS_proto.onwriteend =\n\t\tnull;\n\n\tview.addEventListener(\"unload\", process_deletion_queue, false);\n\treturn saveAs;\n}(window));\n\nif (typeof module !== 'undefined') module.exports = saveAs;\n",
      "type": "blob"
    },
    "palette.coffee.md": {
      "path": "palette.coffee.md",
      "mode": "100644",
      "content": "Palette\n=======\n\n    Palette =\n\n      defaults:\n        [\n          \"transparent\"\n          \"#000000\"\n          \"#FFFFFF\"\n          \"#666666\"\n          \"#DCDCDC\"\n          \"#EB070E\"\n          \"#F69508\"\n          \"#FFDE49\"\n          \"#388326\"\n          \"#0246E3\"\n          \"#563495\"\n          \"#58C4F5\"\n          \"#E5AC99\"\n          \"#5B4635\"\n          \"#FFFEE9\"\n        ]\n\n    module.exports = Palette\n",
      "type": "blob"
    },
    "pixie.cson": {
      "path": "pixie.cson",
      "mode": "100644",
      "content": "version: \"0.1.0\"\nentryPoint: \"editor\"\nremoteDependencies: [\n  \"//code.jquery.com/jquery-1.10.1.min.js\"\n  \"http://strd6.github.io/tempest/javascripts/envweb.js\"\n  \"http://strd6.github.io/require/v0.2.2.js\"\n]\ndependencies:\n  \"jquery-utils\": \"STRd6/jquery-utils:v0.1.2\"\n  runtime: \"STRd6/runtime:v0.1.1\"\n  \"touch-canvas\": \"STRd6/touch-canvas:v0.2.0\"\n  \"commando\": \"STRd6/commando:v0.9.0\"\nwidth: 480\nheight: 320\n",
      "type": "blob"
    },
    "style.styl": {
      "path": "style.styl",
      "mode": "100644",
      "content": "html, body\n  margin: 0\n  height: 100%\n\n.editor\n  background-color: lightgray\n  box-sizing: border-box\n  height: 100%\n  padding: 0 40px\n  position: relative\n  user-select: none\n  overflow: hidden\n\n.toolbar\n  background-color: white\n  box-sizing: border-box\n  height: 100%\n  width: 40px\n  position: absolute\n  top: 0\n  left: 0\n\n  .tool\n    background-color: lightgray\n    background-position: center\n    background-repeat: no-repeat\n    width: 36px\n    height: 36px\n    box-sizing: border-box\n    border: 1px solid rgba(0, 0, 0, 0.5)\n    border-radius: 2px\n    margin: 2px\n\n    &.active\n      background-color: white\n      border-color: green\n\n.palette\n  background-color: white\n  box-sizing: border-box\n  height: 100%\n  width: 40px\n  position: absolute\n  top: 0\n  right: 0\n  font-size: 0\n\n  .color\n    box-sizing: border-box\n    border: 1px solid rgba(0, 0, 0, 0.5)\n    border-radius: 2px\n    float: left\n    width: 16px\n    height: 16px\n    margin: 2px\n\n    &.current\n      float: none\n      width: 36px\n      height: 36px\n\n.viewport\n  background-color: white\n  border: 1px solid gray\n  height: 320px\n  width: 320px\n  \n  position: absolute\n  top: 0\n  bottom: 0\n  left: 0\n  right: 0\n  margin: auto\n\n  canvas\n    background-color: transparent\n    position: absolute\n\n.debug\n  background-color: white\n  box-sizing: border-box\n  position: absolute\n  width: 100%\n  height: 100px\n  bottom: 0\n  margin: 0\n  padding: 1em\n",
      "type": "blob"
    },
    "templates/debug.haml.md": {
      "path": "templates/debug.haml.md",
      "mode": "100644",
      "content": "Debug Some junk\n\n    %pre.debug\n      - each @items, (item) ->\n        = item\n",
      "type": "blob"
    },
    "templates/editor.haml.md": {
      "path": "templates/editor.haml.md",
      "mode": "100644",
      "content": "Editor template\n\n    - activeIndex = @activeIndex\n    - activeTool = @activeTool\n\n    .editor\n\nThe toolbar holds our tools.\n\n      .toolbar\n        - each @tools, (tool) ->\n          .tool(style=\"background-image: url(#{tool.iconUrl})\")\n            -on \"click\", (e) ->\n              - activeTool(tool)\n\nTODO: This whole activation and tracking should be made easier in Tempest.\n\n              - $(e.currentTarget).takeClass(\"active\")\n\nOur layers and preview canvases are placed in the viewport.\n\n      .viewport\n\nThe palette holds our colors.\n\n      .palette\n        .color.current\n        - each @palette, (color, index) ->\n          .color(style=\"background-color: #{color}\")\n            - on \"click\", ->\n              - activeIndex index\n",
      "type": "blob"
    },
    "test/editor.coffee": {
      "path": "test/editor.coffee",
      "mode": "100644",
      "content": "require \"../editor\"\n\ndescribe \"editor\", ->\n  it \"should be radical\", ->\n    assert true\n",
      "type": "blob"
    },
    "tools.coffee.md": {
      "path": "tools.coffee.md",
      "mode": "100644",
      "content": "Tools\n=====\n\n    {line, circle, rect, rectOutline} = require \"./util\"\n\n    line2 = (start, end, fn) ->\n      fn start\n      line start, end, fn\n\n    neighbors = (point) ->\n      [\n        Point(point.x, point.y-1)\n        Point(point.x-1, point.y)\n        Point(point.x+1, point.y)\n        Point(point.x, point.y+1)\n      ]\n\n    shapeTool = (fn, icon) ->\n      start = null\n\n      iconUrl: icon\n      touch: ({position})->\n        start = position\n\n      move: ({editor, position})->\n        editor.preview ->\n          fn start, position, editor.draw\n\n      release: ({position, editor}) ->\n        fn start, position, editor.draw\n\nDefault tools.\n\n    TOOLS =\n\nDraw a line when moving while touching.\n\n      pencil: do ->\n        previousPosition = null\n        \n        iconUrl: \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA5klEQVQ4T5VTuw2DMBB9LmkZg54ZGCDpHYkJYBBYATcUSKnSwAy0iDFoKR0fDgiMDc5JLvy59969OzPchzSesP3+sLFgySoMweMYou/xmWe81VKx5d0CyCQBoghoGgiV/JombwDNzjkwjsAw/A8gswwgBWm6VPdU7L4laPa6BsrSyX6oxTBQ7munO1v9LgCv2ldCWxcWgDV4EDjZbQq0dDKv65ytuxokKdtWO08AagkhTr2/BiD2otBv8hyMurCbPHNaTQ8OBjJScZFs9eChTKMwB8byT5ajkwIC8E22AvyY7j7ZJugLVIZ5EV8R1SQAAAAASUVORK5CYII=\"\n        touch: ({position, editor})->\n          editor.draw position\n          previousPosition = position\n        move: ({editor, position})->\n          line previousPosition, position, editor.draw\n          previousPosition = position\n        release: ->\n\n      fill:\n        iconUrl: \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABCklEQVQ4T52TPRKCMBCFX0pbj+HY0tJKY+UB8AqchCuYXofCRs9gy3ADW1rKmLeQTIBEZ0wTwu779idZhfQygUml3FIGikPb8ux5MUDM+S9AWAIjRrNNZYDLdov7MEiqx80G576PQqIAJ75NgJMFXPMc6vlcQZYAI842unq/YQ4HoKrGho1iqLqeQWadZuSyLKG1FmeWwMjY7QDCJlAIcQAj4iyDfr1kp4gggVgb9nsPUkXhs1gBJBpX1wFtC20BrpmSjS0pDbD1h8uJeQu+pKaJAmgfy5icQzH/sani9HgkAWLnLTAi0+YeiFmu+QXwEH5EHpAx7EFwld+GybVjOVTJdzBrYOKwGqoP9IV4EbRDWfEAAAAASUVORK5CYII=\"\n        touch: ({position, editor}) ->\n          index = editor.activeIndex()\n          targetIndex = editor.getPixel(position).index\n\n          return if index is targetIndex\n\n          queue = [position]\n          editor.draw position\n\n          while(queue.length)\n            position = queue.pop()\n\n            neighbors(position).forEach (position) ->\n              if editor.getPixel(position)?.index is targetIndex\n                editor.draw position\n                queue.push(position)\n\n          return\n\n        move: ->\n        release: ->\n\nShapes\n------\n\n      circle: shapeTool circle,\n        \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAVklEQVQ4T2NkwA7+YxFmxKYUXRCmEZtirHLICkEKsNqCZjOKOpgGYjXDzIKrp4oBpNqO4gqQC0YNgAQJqeFA3WjESBw48gdWdVTNC8gWk50bCbgeUxoAvXwcEQnwKSYAAAAASUVORK5CYII=\"\n\n      rect: shapeTool rect,\n        \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAK0lEQVQ4T2NkoBAwUqifYfAY8J9MrzDCvDBqAAPDMAgDMpMBwyBKymR7AQAp1wgR44q8HgAAAABJRU5ErkJggg==\"\n\n      rectOutline: shapeTool rectOutline,\n        \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAN0lEQVQ4T2NkoBAwUqifgWoG/CfTJYwwF4AMINU1YD2jBgy7MCAnLcHTATmawXpITX0YFlFsAADRBBIRAZEL0wAAAABJRU5ErkJggg==\"\n\n      line2: shapeTool line2,\n        \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAV0lEQVQ4T6XSyQ0AIAgEQOm/aIWHxoNzJTG+GASk9hnE+Z2P3FDMRBjZK0PI/fQyovVeQqzhpRFv+ikkWl+IRID8DRfJAC6SBUykAqhIFXgQBDgQFFjIAMAADxGQlO+iAAAAAElFTkSuQmCC\"\n\n    module.exports = (I={}, self=Core(I)) ->\n      self.extend\n        addTool: (tool) ->\n          self.tools.push tool\n\n        activeTool: Observable()\n\n        tools: Observable []\n\n      Object.keys(TOOLS).forEach (name) ->\n        self.addTool TOOLS[name]\n\n      self.activeTool(self.tools()[0])\n\n      return self\n",
      "type": "blob"
    },
    "undo.coffee.md": {
      "path": "undo.coffee.md",
      "mode": "100644",
      "content": "Undo\n====\n\nAn editor module for editors that support undo/redo\n\n    CommandStack = require \"commando\"\n\n    module.exports = (I={}, self=Core(I)) ->\n      # TODO: Module include should be idempotent\n      self.include Bindable unless self.on\n\n      commandStack = CommandStack()\n      lastClean = undefined\n\n      # TODO: Make this an observable rather than an event emitter\n      dirty = (newDirty) ->\n        if newDirty is false\n          lastClean = commandStack.current()\n          self.trigger('clean')\n\n          return self\n        else\n          return lastClean != commandStack.current()\n\n      updateDirtyState = ->\n        if dirty()\n          self.trigger('dirty')\n        else\n          self.trigger('clean')\n\n      # Set dirty state on save event\n      self.on 'save', ->\n        dirty(false)\n\n      self.extend\n        execute: (command) ->\n          commandStack.execute command\n          updateDirtyState()\n\n          return self\n\n        undo: ->\n          commandStack.undo()\n          updateDirtyState()\n\n          return self\n\n        redo: ->\n          commandStack.redo()\n          updateDirtyState()\n\n          return self\n\n      return self\n",
      "type": "blob"
    },
    "util.coffee.md": {
      "path": "util.coffee.md",
      "mode": "100644",
      "content": "Util\n====\n\nHelpers\n-------\n\n    isObject = (object) ->\n      Object::toString.call(object) is \"[object Object]\"\n\nSize\n----\n\nA 2d extent.\n\n    Size = (width, height) ->\n      width: width\n      height: height\n      __proto__: Size.prototype\n\n    Size.prototype =\n      scale: (scalar) ->\n        Size(@width * scalar, @height * scalar)\n\n      toString: ->\n        \"Size(#{@width}, #{@height})\"\n\n      each: (iterator) ->\n        [0...@height].forEach (y) ->\n          [0...@width].forEach (x) ->\n            iterator(x, y)\n\nPoint Extensions\n----------------\n\n    Point.prototype.scale = (scalar) ->\n      if isObject(scalar)\n        Point(@x * scalar.width, @y * scalar.height)\n      else\n        Point(@x * scalar, @y * scalar)\n\nExtra utilities that may be broken out into separate libraries.\n\n    module.exports =\n\n      Size: Size\n\nA 2d grid of values.\n\n      Grid: (width, height, defaultValue) ->\n        grid =\n          [0...height].map (y) ->\n            [0...width].map (x) ->\n              if typeof defaultValue is \"function\"\n                defaultValue(x, y)\n              else\n                defaultValue\n\n        self =\n          copy: ->\n            Grid(width, height, self.get)\n\n          get: (x, y) ->\n            grid[y]?[x]\n\n          set: (x, y, value) ->\n            return if x < 0 or x >= width\n            return if y < 0 or y >= height\n\n            grid[y][x] = value\n\n          each: (iterator) ->\n            grid.forEach (row, y) ->\n              row.forEach (value, x) ->\n                iterator(value, x, y)\n\n            return self\n\n        return self\n\nCall an iterator for each integer point on a line between two integer points.\n\n      line: (p0, p1, iterator) ->\n        {x:x0, y:y0} = p0\n        {x:x1, y:y1} = p1\n\n        dx = (x1 - x0).abs()\n        dy = (y1 - y0).abs()\n        sx = (x1 - x0).sign()\n        sy = (y1 - y0).sign()\n        err = dx - dy\n\n        while !(x0 is x1 and y0 is y1)\n          e2 = 2 * err\n\n          if e2 > -dy\n            err -= dy\n            x0 += sx\n\n          if e2 < dx\n            err += dx\n            y0 += sy\n\n          iterator\n            x: x0\n            y: y0\n\n      rect: (start, end, iterator) ->\n        [start.y..end.y].forEach (y) ->\n          [start.x..end.x].forEach (x) ->\n            iterator\n              x: x\n              y: y\n\n      rectOutline: (start, end, iterator) ->\n        [start.y..end.y].forEach (y) ->\n          if y is start.y or y is end.y\n            [start.x..end.x].forEach (x) ->\n              iterator\n                x: x\n                y: y\n          else\n            iterator\n              x: start.x\n              y: y\n\n            iterator\n              x: end.x\n              y: y\n\ngross code courtesy of http://en.wikipedia.org/wiki/Midpoint_circle_algorithm\n\n      circle: (center, endPoint, iterator) ->\n        {x:x0, y:y0} = center\n        {x:x1, y:y1} = endPoint\n\n        radius = endPoint.subtract(center).magnitude().floor()\n\n        f = 1 - radius\n        ddFx = 1\n        ddFy = -2 * radius\n\n        x = 0\n        y = radius\n\n        iterator Point(x0, y0 + radius)\n        iterator Point(x0, y0 - radius)\n        iterator Point(x0 + radius, y0)\n        iterator Point(x0 - radius, y0)\n\n        while x < y\n          if f > 0\n            y--\n            ddFy += 2\n            f += ddFy\n\n          x++\n          ddFx += 2\n          f += ddFx\n\n          iterator Point(x0 + x, y0 + y)\n          iterator Point(x0 - x, y0 + y)\n          iterator Point(x0 + x, y0 - y)\n          iterator Point(x0 - x, y0 - y)\n          iterator Point(x0 + y, y0 + x)\n          iterator Point(x0 - y, y0 + x)\n          iterator Point(x0 + y, y0 - x)\n          iterator Point(x0 - y, y0 - x)\n\nA download utility using the webkit file system.\n\n      download: (extension=\"png\", type=\"image/png\") ->\n        return unless webkitRequestFileSystem?\n\n        name = prompt(\"File name\", \"#{name}.#{extension}\")\n\n        webkitRequestFileSystem TEMPORARY, 5 * 1024 * 1024, (fs) ->\n          fs.root.getFile name, {create: true}, (fileEntry) ->\n            fileEntry.createWriter (fileWriter) ->\n              arr = new Uint8Array(3)\n\n              arr[0] = 97\n              arr[1] = 98\n              arr[2] = 99\n\n              blob = new Blob [arr],\n                type: type\n\n              fileWriter.addEventListener \"writeend\", ->\n                # Download by navigating to url\n                location.href = fileEntry.toURL()\n              , false\n\n              fileWriter.write(blob)\n",
      "type": "blob"
    }
  },
  "distribution": {
    "command": {
      "path": "command",
      "content": "(function() {\n  module.exports = {\n    ChangePixel: function(data, editor) {\n      var previous;\n      previous = editor.getPixel(data);\n      return {\n        execute: function() {\n          return editor.changePixel(data);\n        },\n        undo: function() {\n          return editor.changePixel(previous);\n        }\n      };\n    },\n    Composite: function() {\n      var commands;\n      commands = [];\n      return {\n        execute: function() {\n          return commands.invoke(\"execute\");\n        },\n        undo: function() {\n          return commands.copy().reverse().invoke(\"undo\");\n        },\n        push: function(command, noExecute) {\n          commands.push(command);\n          if (!noExecute) {\n            return command.execute();\n          }\n        }\n      };\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=command.coffee",
      "type": "blob"
    },
    "editor": {
      "path": "editor",
      "content": "(function() {\n  var Command, Editor, Grid, Hotkeys, Palette, Size, Tools, TouchCanvas, Undo, debugTemplate, download, runtime, saveAs, template, _ref;\n\n  require(\"jquery-utils\");\n\n  require(\"./lib/canvas-to-blob\");\n\n  saveAs = require(\"./lib/file_saver\");\n\n  runtime = require(\"runtime\")(PACKAGE);\n\n  runtime.boot();\n\n  runtime.applyStyleSheet(require('./style'));\n\n  TouchCanvas = require(\"touch-canvas\");\n\n  Command = require(\"./command\");\n\n  Undo = require(\"./undo\");\n\n  Hotkeys = require(\"./hotkeys\");\n\n  Tools = require(\"./tools\");\n\n  Palette = require(\"./palette\");\n\n  template = require(\"./templates/editor\");\n\n  debugTemplate = require(\"./templates/debug\");\n\n  _ref = require(\"./util\"), Grid = _ref.Grid, Size = _ref.Size, download = _ref.download;\n\n  Editor = function(I, self) {\n    var activeIndex, activeTool, canvas, canvasSize, lastCommand, palette, pixelExtent, pixelSize, pixels, previewCanvas, updateActiveColor;\n    if (I == null) {\n      I = {};\n    }\n    activeIndex = Observable(1);\n    pixelExtent = Size(16, 16);\n    pixelSize = 20;\n    canvasSize = pixelExtent.scale(pixelSize);\n    palette = Palette.defaults;\n    canvas = null;\n    lastCommand = null;\n    if (self == null) {\n      self = Model(I);\n    }\n    self.include(Undo);\n    self.include(Hotkeys);\n    self.include(Tools);\n    activeTool = self.activeTool;\n    pixels = Grid(pixelExtent.width, pixelExtent.height, 0);\n    self.extend({\n      activeIndex: activeIndex,\n      outputCanvas: function() {\n        var outputCanvas;\n        outputCanvas = TouchCanvas(pixelExtent);\n        pixels.each(function(index, x, y) {\n          return outputCanvas.drawRect({\n            x: x,\n            y: y,\n            width: 1,\n            height: 1,\n            color: palette[index]\n          });\n        });\n        return outputCanvas.element();\n      },\n      download: function() {\n        return self.outputCanvas().toBlob(function(blob) {\n          return saveAs(blob, prompt(\"File name\", \"image.png\"));\n        });\n      },\n      toDataURL: function() {\n        return console.log(self.outputCanvas().toDataURL(\"image/png\"));\n      },\n      draw: function(_arg) {\n        var x, y;\n        x = _arg.x, y = _arg.y;\n        return lastCommand.push(Command.ChangePixel({\n          x: x,\n          y: y,\n          index: activeIndex()\n        }, self));\n      },\n      changePixel: function(_arg) {\n        var color, index, x, y;\n        x = _arg.x, y = _arg.y, index = _arg.index;\n        if (canvas !== previewCanvas) {\n          pixels.set(x, y, index);\n        }\n        color = palette[index];\n        if (color === \"transparent\") {\n          return canvas.clear({\n            x: x * pixelSize,\n            y: y * pixelSize,\n            width: pixelSize,\n            height: pixelSize\n          });\n        } else {\n          return canvas.drawRect({\n            x: x * pixelSize,\n            y: y * pixelSize,\n            width: pixelSize,\n            height: pixelSize,\n            color: color\n          });\n        }\n      },\n      getPixel: function(_arg) {\n        var x, y;\n        x = _arg.x, y = _arg.y;\n        return {\n          x: x,\n          y: y,\n          index: pixels.get(x, y)\n        };\n      },\n      palette: Observable(palette),\n      preview: function(fn) {\n        var realCanvas, realCommand;\n        realCommand = lastCommand;\n        lastCommand = Command.Composite();\n        realCanvas = canvas;\n        canvas = previewCanvas;\n        canvas.clear();\n        fn();\n        canvas = realCanvas;\n        return lastCommand = realCommand;\n      }\n    });\n    $('body').append(template(self));\n    canvas = TouchCanvas(canvasSize);\n    previewCanvas = TouchCanvas(canvasSize);\n    updateActiveColor = function(newIndex) {\n      var color;\n      color = palette[newIndex];\n      return $(\".palette .current\").css({\n        backgroundColor: color\n      });\n    };\n    updateActiveColor(activeIndex());\n    activeIndex.observe(updateActiveColor);\n    $('.viewport').append(canvas.element());\n    $(\".viewport\").append($(previewCanvas.element()).addClass(\"preview\"));\n    previewCanvas.on(\"touch\", function(position) {\n      lastCommand = Command.Composite();\n      self.execute(lastCommand);\n      return activeTool().touch({\n        position: position.scale(pixelExtent).floor(),\n        editor: self\n      });\n    });\n    previewCanvas.on(\"move\", function(position) {\n      return activeTool().move({\n        position: position.scale(pixelExtent).floor(),\n        editor: self\n      });\n    });\n    previewCanvas.on(\"release\", function(position) {\n      activeTool().release({\n        position: position.scale(pixelExtent).floor(),\n        editor: self\n      });\n      return previewCanvas.clear();\n    });\n    return self;\n  };\n\n  Editor();\n\n}).call(this);\n\n//# sourceURL=editor.coffee",
      "type": "blob"
    },
    "hotkeys": {
      "path": "hotkeys",
      "content": "(function() {\n  module.exports = function(I, self) {\n    var hotkeys;\n    if (I == null) {\n      I = {};\n    }\n    self.extend({\n      addHotkey: function(key, method) {\n        return $(document).bind(\"keydown\", key, function() {\n          return self[method]();\n        });\n      }\n    });\n    hotkeys = {\n      \"ctrl+z\": \"undo\",\n      \"ctrl+y\": \"redo\",\n      \"ctrl+s\": \"download\",\n      \"ctrl+b\": \"toDataURL\"\n    };\n    Object.keys(hotkeys).forEach(function(key) {\n      return self.addHotkey(key, hotkeys[key]);\n    });\n    return self;\n  };\n\n}).call(this);\n\n//# sourceURL=hotkeys.coffee",
      "type": "blob"
    },
    "lib/canvas-to-blob": {
      "path": "lib/canvas-to-blob",
      "content": "/* canvas-toBlob.js\n * A canvas.toBlob() implementation.\n * 2011-07-13\n * \n * By Eli Grey, http://eligrey.com and Devin Samarin, https://github.com/eboyjr\n * License: X11/MIT\n *   See LICENSE.md\n */\n\n/*global self */\n/*jslint bitwise: true, regexp: true, confusion: true, es5: true, vars: true, white: true,\n  plusplus: true */\n\n/*! @source http://purl.eligrey.com/github/canvas-toBlob.js/blob/master/canvas-toBlob.js */\n\n(function(view) {\n\"use strict\";\nvar\n    Uint8Array = view.Uint8Array\n\t, HTMLCanvasElement = view.HTMLCanvasElement\n\t, is_base64_regex = /\\s*;\\s*base64\\s*(?:;|$)/i\n\t, base64_ranks\n\t, decode_base64 = function(base64) {\n\t\tvar\n\t\t\t  len = base64.length\n\t\t\t, buffer = new Uint8Array(len / 4 * 3 | 0)\n\t\t\t, i = 0\n\t\t\t, outptr = 0\n\t\t\t, last = [0, 0]\n\t\t\t, state = 0\n\t\t\t, save = 0\n\t\t\t, rank\n\t\t\t, code\n\t\t\t, undef\n\t\t;\n\t\twhile (len--) {\n\t\t\tcode = base64.charCodeAt(i++);\n\t\t\trank = base64_ranks[code-43];\n\t\t\tif (rank !== 255 && rank !== undef) {\n\t\t\t\tlast[1] = last[0];\n\t\t\t\tlast[0] = code;\n\t\t\t\tsave = (save << 6) | rank;\n\t\t\t\tstate++;\n\t\t\t\tif (state === 4) {\n\t\t\t\t\tbuffer[outptr++] = save >>> 16;\n\t\t\t\t\tif (last[1] !== 61 /* padding character */) {\n\t\t\t\t\t\tbuffer[outptr++] = save >>> 8;\n\t\t\t\t\t}\n\t\t\t\t\tif (last[0] !== 61 /* padding character */) {\n\t\t\t\t\t\tbuffer[outptr++] = save;\n\t\t\t\t\t}\n\t\t\t\t\tstate = 0;\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t\t// 2/3 chance there's going to be some null bytes at the end, but that\n\t\t// doesn't really matter with most image formats.\n\t\t// If it somehow matters for you, truncate the buffer up outptr.\n\t\treturn buffer;\n\t}\n;\nif (Uint8Array) {\n\tbase64_ranks = new Uint8Array([\n\t\t  62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1\n\t\t, -1, -1,  0, -1, -1, -1,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9\n\t\t, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25\n\t\t, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35\n\t\t, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51\n\t]);\n}\nif (HTMLCanvasElement && !HTMLCanvasElement.prototype.toBlob) {\n\tHTMLCanvasElement.prototype.toBlob = function(callback, type /*, ...args*/) {\n\t\t  if (!type) {\n\t\t\ttype = \"image/png\";\n\t\t} if (this.mozGetAsFile) {\n\t\t\tcallback(this.mozGetAsFile(\"canvas\", type));\n\t\t\treturn;\n\t\t}\n\t\tvar\n\t\t\t  args = Array.prototype.slice.call(arguments, 1)\n\t\t\t, dataURI = this.toDataURL.apply(this, args)\n\t\t\t, header_end = dataURI.indexOf(\",\")\n\t\t\t, data = dataURI.substring(header_end + 1)\n\t\t\t, is_base64 = is_base64_regex.test(dataURI.substring(0, header_end))\n\t\t\t, blob\n\t\t;\n\t\tif (Blob.fake) {\n\t\t\t// no reason to decode a data: URI that's just going to become a data URI again\n\t\t\tblob = new Blob\n\t\t\tif (is_base64) {\n\t\t\t\tblob.encoding = \"base64\";\n\t\t\t} else {\n\t\t\t\tblob.encoding = \"URI\";\n\t\t\t}\n\t\t\tblob.data = data;\n\t\t\tblob.size = data.length;\n\t\t} else if (Uint8Array) {\n\t\t\tif (is_base64) {\n\t\t\t\tblob = new Blob([decode_base64(data)], {type: type});\n\t\t\t} else {\n\t\t\t\tblob = new Blob([decodeURIComponent(data)], {type: type});\n\t\t\t}\n\t\t}\n\t\tcallback(blob);\n\t};\n}\n}(self));\n",
      "type": "blob"
    },
    "lib/file_saver": {
      "path": "lib/file_saver",
      "content": "/* FileSaver.js\n * A saveAs() FileSaver implementation.\n * 2013-10-21\n *\n * By Eli Grey, http://eligrey.com\n * License: X11/MIT\n *   See LICENSE.md\n */\n\n/*global self */\n/*jslint bitwise: true, regexp: true, confusion: true, es5: true, vars: true, white: true,\n  plusplus: true */\n\n/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */\n\nvar saveAs = saveAs\n  || (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob && navigator.msSaveOrOpenBlob.bind(navigator))\n  || (function(view) {\n  \"use strict\";\n\tvar\n\t\t  doc = view.document\n\t\t  // only get URL when necessary in case BlobBuilder.js hasn't overridden it yet\n\t\t, get_URL = function() {\n\t\t\treturn view.URL || view.webkitURL || view;\n\t\t}\n\t\t, URL = view.URL || view.webkitURL || view\n\t\t, save_link = doc.createElementNS(\"http://www.w3.org/1999/xhtml\", \"a\")\n\t\t, can_use_save_link =  !view.externalHost && \"download\" in save_link\n\t\t, click = function(node) {\n\t\t\tvar event = doc.createEvent(\"MouseEvents\");\n\t\t\tevent.initMouseEvent(\n\t\t\t\t\"click\", true, false, view, 0, 0, 0, 0, 0\n\t\t\t\t, false, false, false, false, 0, null\n\t\t\t);\n\t\t\tnode.dispatchEvent(event);\n\t\t}\n\t\t, webkit_req_fs = view.webkitRequestFileSystem\n\t\t, req_fs = view.requestFileSystem || webkit_req_fs || view.mozRequestFileSystem\n\t\t, throw_outside = function (ex) {\n\t\t\t(view.setImmediate || view.setTimeout)(function() {\n\t\t\t\tthrow ex;\n\t\t\t}, 0);\n\t\t}\n\t\t, force_saveable_type = \"application/octet-stream\"\n\t\t, fs_min_size = 0\n\t\t, deletion_queue = []\n\t\t, process_deletion_queue = function() {\n\t\t\tvar i = deletion_queue.length;\n\t\t\twhile (i--) {\n\t\t\t\tvar file = deletion_queue[i];\n\t\t\t\tif (typeof file === \"string\") { // file is an object URL\n\t\t\t\t\tURL.revokeObjectURL(file);\n\t\t\t\t} else { // file is a File\n\t\t\t\t\tfile.remove();\n\t\t\t\t}\n\t\t\t}\n\t\t\tdeletion_queue.length = 0; // clear queue\n\t\t}\n\t\t, dispatch = function(filesaver, event_types, event) {\n\t\t\tevent_types = [].concat(event_types);\n\t\t\tvar i = event_types.length;\n\t\t\twhile (i--) {\n\t\t\t\tvar listener = filesaver[\"on\" + event_types[i]];\n\t\t\t\tif (typeof listener === \"function\") {\n\t\t\t\t\ttry {\n\t\t\t\t\t\tlistener.call(filesaver, event || filesaver);\n\t\t\t\t\t} catch (ex) {\n\t\t\t\t\t\tthrow_outside(ex);\n\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t}\n\t\t, FileSaver = function(blob, name) {\n\t\t\t// First try a.download, then web filesystem, then object URLs\n\t\t\tvar\n\t\t\t\t  filesaver = this\n\t\t\t\t, type = blob.type\n\t\t\t\t, blob_changed = false\n\t\t\t\t, object_url\n\t\t\t\t, target_view\n\t\t\t\t, get_object_url = function() {\n\t\t\t\t\tvar object_url = get_URL().createObjectURL(blob);\n\t\t\t\t\tdeletion_queue.push(object_url);\n\t\t\t\t\treturn object_url;\n\t\t\t\t}\n\t\t\t\t, dispatch_all = function() {\n\t\t\t\t\tdispatch(filesaver, \"writestart progress write writeend\".split(\" \"));\n\t\t\t\t}\n\t\t\t\t// on any filesys errors revert to saving with object URLs\n\t\t\t\t, fs_error = function() {\n\t\t\t\t\t// don't create more object URLs than needed\n\t\t\t\t\tif (blob_changed || !object_url) {\n\t\t\t\t\t\tobject_url = get_object_url(blob);\n\t\t\t\t\t}\n\t\t\t\t\tif (target_view) {\n\t\t\t\t\t\ttarget_view.location.href = object_url;\n\t\t\t\t\t} else {\n                        window.open(object_url, \"_blank\");\n                    }\n\t\t\t\t\tfilesaver.readyState = filesaver.DONE;\n\t\t\t\t\tdispatch_all();\n\t\t\t\t}\n\t\t\t\t, abortable = function(func) {\n\t\t\t\t\treturn function() {\n\t\t\t\t\t\tif (filesaver.readyState !== filesaver.DONE) {\n\t\t\t\t\t\t\treturn func.apply(this, arguments);\n\t\t\t\t\t\t}\n\t\t\t\t\t};\n\t\t\t\t}\n\t\t\t\t, create_if_not_found = {create: true, exclusive: false}\n\t\t\t\t, slice\n\t\t\t;\n\t\t\tfilesaver.readyState = filesaver.INIT;\n\t\t\tif (!name) {\n\t\t\t\tname = \"download\";\n\t\t\t}\n\t\t\tif (can_use_save_link) {\n\t\t\t\tobject_url = get_object_url(blob);\n\t\t\t\t// FF for Android has a nasty garbage collection mechanism\n\t\t\t\t// that turns all objects that are not pure javascript into 'deadObject'\n\t\t\t\t// this means `doc` and `save_link` are unusable and need to be recreated\n\t\t\t\t// `view` is usable though:\n\t\t\t\tdoc = view.document;\n\t\t\t\tsave_link = doc.createElementNS(\"http://www.w3.org/1999/xhtml\", \"a\");\n\t\t\t\tsave_link.href = object_url;\n\t\t\t\tsave_link.download = name;\n\t\t\t\tvar event = doc.createEvent(\"MouseEvents\");\n\t\t\t\tevent.initMouseEvent(\n\t\t\t\t\t\"click\", true, false, view, 0, 0, 0, 0, 0\n\t\t\t\t\t, false, false, false, false, 0, null\n\t\t\t\t);\n\t\t\t\tsave_link.dispatchEvent(event);\n\t\t\t\tfilesaver.readyState = filesaver.DONE;\n\t\t\t\tdispatch_all();\n\t\t\t\treturn;\n\t\t\t}\n\t\t\t// Object and web filesystem URLs have a problem saving in Google Chrome when\n\t\t\t// viewed in a tab, so I force save with application/octet-stream\n\t\t\t// http://code.google.com/p/chromium/issues/detail?id=91158\n\t\t\tif (view.chrome && type && type !== force_saveable_type) {\n\t\t\t\tslice = blob.slice || blob.webkitSlice;\n\t\t\t\tblob = slice.call(blob, 0, blob.size, force_saveable_type);\n\t\t\t\tblob_changed = true;\n\t\t\t}\n\t\t\t// Since I can't be sure that the guessed media type will trigger a download\n\t\t\t// in WebKit, I append .download to the filename.\n\t\t\t// https://bugs.webkit.org/show_bug.cgi?id=65440\n\t\t\tif (webkit_req_fs && name !== \"download\") {\n\t\t\t\tname += \".download\";\n\t\t\t}\n\t\t\tif (type === force_saveable_type || webkit_req_fs) {\n\t\t\t\ttarget_view = view;\n\t\t\t}\n\t\t\tif (!req_fs) {\n\t\t\t\tfs_error();\n\t\t\t\treturn;\n\t\t\t}\n\t\t\tfs_min_size += blob.size;\n\t\t\treq_fs(view.TEMPORARY, fs_min_size, abortable(function(fs) {\n\t\t\t\tfs.root.getDirectory(\"saved\", create_if_not_found, abortable(function(dir) {\n\t\t\t\t\tvar save = function() {\n\t\t\t\t\t\tdir.getFile(name, create_if_not_found, abortable(function(file) {\n\t\t\t\t\t\t\tfile.createWriter(abortable(function(writer) {\n\t\t\t\t\t\t\t\twriter.onwriteend = function(event) {\n\t\t\t\t\t\t\t\t\ttarget_view.location.href = file.toURL();\n\t\t\t\t\t\t\t\t\tdeletion_queue.push(file);\n\t\t\t\t\t\t\t\t\tfilesaver.readyState = filesaver.DONE;\n\t\t\t\t\t\t\t\t\tdispatch(filesaver, \"writeend\", event);\n\t\t\t\t\t\t\t\t};\n\t\t\t\t\t\t\t\twriter.onerror = function() {\n\t\t\t\t\t\t\t\t\tvar error = writer.error;\n\t\t\t\t\t\t\t\t\tif (error.code !== error.ABORT_ERR) {\n\t\t\t\t\t\t\t\t\t\tfs_error();\n\t\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t\t};\n\t\t\t\t\t\t\t\t\"writestart progress write abort\".split(\" \").forEach(function(event) {\n\t\t\t\t\t\t\t\t\twriter[\"on\" + event] = filesaver[\"on\" + event];\n\t\t\t\t\t\t\t\t});\n\t\t\t\t\t\t\t\twriter.write(blob);\n\t\t\t\t\t\t\t\tfilesaver.abort = function() {\n\t\t\t\t\t\t\t\t\twriter.abort();\n\t\t\t\t\t\t\t\t\tfilesaver.readyState = filesaver.DONE;\n\t\t\t\t\t\t\t\t};\n\t\t\t\t\t\t\t\tfilesaver.readyState = filesaver.WRITING;\n\t\t\t\t\t\t\t}), fs_error);\n\t\t\t\t\t\t}), fs_error);\n\t\t\t\t\t};\n\t\t\t\t\tdir.getFile(name, {create: false}, abortable(function(file) {\n\t\t\t\t\t\t// delete file if it already exists\n\t\t\t\t\t\tfile.remove();\n\t\t\t\t\t\tsave();\n\t\t\t\t\t}), abortable(function(ex) {\n\t\t\t\t\t\tif (ex.code === ex.NOT_FOUND_ERR) {\n\t\t\t\t\t\t\tsave();\n\t\t\t\t\t\t} else {\n\t\t\t\t\t\t\tfs_error();\n\t\t\t\t\t\t}\n\t\t\t\t\t}));\n\t\t\t\t}), fs_error);\n\t\t\t}), fs_error);\n\t\t}\n\t\t, FS_proto = FileSaver.prototype\n\t\t, saveAs = function(blob, name) {\n\t\t\treturn new FileSaver(blob, name);\n\t\t}\n\t;\n\tFS_proto.abort = function() {\n\t\tvar filesaver = this;\n\t\tfilesaver.readyState = filesaver.DONE;\n\t\tdispatch(filesaver, \"abort\");\n\t};\n\tFS_proto.readyState = FS_proto.INIT = 0;\n\tFS_proto.WRITING = 1;\n\tFS_proto.DONE = 2;\n\n\tFS_proto.error =\n\tFS_proto.onwritestart =\n\tFS_proto.onprogress =\n\tFS_proto.onwrite =\n\tFS_proto.onabort =\n\tFS_proto.onerror =\n\tFS_proto.onwriteend =\n\t\tnull;\n\n\tview.addEventListener(\"unload\", process_deletion_queue, false);\n\treturn saveAs;\n}(window));\n\nif (typeof module !== 'undefined') module.exports = saveAs;\n",
      "type": "blob"
    },
    "palette": {
      "path": "palette",
      "content": "(function() {\n  var Palette;\n\n  Palette = {\n    defaults: [\"transparent\", \"#000000\", \"#FFFFFF\", \"#666666\", \"#DCDCDC\", \"#EB070E\", \"#F69508\", \"#FFDE49\", \"#388326\", \"#0246E3\", \"#563495\", \"#58C4F5\", \"#E5AC99\", \"#5B4635\", \"#FFFEE9\"]\n  };\n\n  module.exports = Palette;\n\n}).call(this);\n\n//# sourceURL=palette.coffee",
      "type": "blob"
    },
    "pixie": {
      "path": "pixie",
      "content": "module.exports = {\"version\":\"0.1.0\",\"entryPoint\":\"editor\",\"remoteDependencies\":[\"//code.jquery.com/jquery-1.10.1.min.js\",\"http://strd6.github.io/tempest/javascripts/envweb.js\",\"http://strd6.github.io/require/v0.2.2.js\"],\"dependencies\":{\"jquery-utils\":\"STRd6/jquery-utils:v0.1.2\",\"runtime\":\"STRd6/runtime:v0.1.1\",\"touch-canvas\":\"STRd6/touch-canvas:v0.2.0\",\"commando\":\"STRd6/commando:v0.9.0\"},\"width\":480,\"height\":320};",
      "type": "blob"
    },
    "style": {
      "path": "style",
      "content": "module.exports = \"html,\\nbody {\\n  margin: 0;\\n  height: 100%;\\n}\\n\\n.editor {\\n  background-color: lightgray;\\n  height: 100%;\\n  padding: 0 40px;\\n  position: relative;\\n  overflow: hidden;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n  -ms-user-select: none;\\n  -moz-user-select: none;\\n  -webkit-user-select: none;\\n  user-select: none;\\n}\\n\\n.toolbar {\\n  background-color: white;\\n  height: 100%;\\n  width: 40px;\\n  position: absolute;\\n  top: 0;\\n  left: 0;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n}\\n\\n.toolbar .tool.active {\\n  background-color: white;\\n  border-color: green;\\n}\\n\\n.toolbar .tool {\\n  background-color: lightgray;\\n  background-position: center;\\n  background-repeat: no-repeat;\\n  width: 36px;\\n  height: 36px;\\n  border: 1px solid rgba(0, 0, 0, 0.5);\\n  border-radius: 2px;\\n  margin: 2px;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n}\\n\\n.palette {\\n  background-color: white;\\n  height: 100%;\\n  width: 40px;\\n  position: absolute;\\n  top: 0;\\n  right: 0;\\n  font-size: 0;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n}\\n\\n.palette .color.current {\\n  float: none;\\n  width: 36px;\\n  height: 36px;\\n}\\n\\n.palette .color {\\n  border: 1px solid rgba(0, 0, 0, 0.5);\\n  border-radius: 2px;\\n  float: left;\\n  width: 16px;\\n  height: 16px;\\n  margin: 2px;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n}\\n\\n.viewport {\\n  background-color: white;\\n  border: 1px solid gray;\\n  height: 320px;\\n  width: 320px;\\n  position: absolute;\\n  top: 0;\\n  bottom: 0;\\n  left: 0;\\n  right: 0;\\n  margin: auto;\\n}\\n\\n.viewport canvas {\\n  background-color: transparent;\\n  position: absolute;\\n}\\n\\n.debug {\\n  background-color: white;\\n  position: absolute;\\n  width: 100%;\\n  height: 100px;\\n  bottom: 0;\\n  margin: 0;\\n  padding: 1em;\\n  -ms-box-sizing: border-box;\\n  -moz-box-sizing: border-box;\\n  -webkit-box-sizing: border-box;\\n  box-sizing: border-box;\\n}\";",
      "type": "blob"
    },
    "templates/debug": {
      "path": "templates/debug",
      "content": "module.exports = (function(data) {\n  return (function() {\n    var __attribute, __each, __element, __filter, __on, __pop, __push, __render, __text, __with, _ref;\n    _ref = HAMLjr.Runtime(this), __push = _ref.__push, __pop = _ref.__pop, __attribute = _ref.__attribute, __filter = _ref.__filter, __text = _ref.__text, __on = _ref.__on, __each = _ref.__each, __with = _ref.__with, __render = _ref.__render;\n    __push(document.createDocumentFragment());\n    __element = document.createElement(\"pre\");\n    __push(__element);\n    __attribute(__element, \"class\", \"debug\");\n    __each(this.items, function(item) {\n      __element = document.createTextNode('');\n      __text(__element, item);\n      __push(__element);\n      return __pop();\n    });\n    __pop();\n    return __pop();\n  }).call(data);\n});\n;",
      "type": "blob"
    },
    "templates/editor": {
      "path": "templates/editor",
      "content": "module.exports = (function(data) {\n  return (function() {\n    var activeIndex, activeTool, __attribute, __each, __element, __filter, __on, __pop, __push, __render, __text, __with, _ref;\n    _ref = HAMLjr.Runtime(this), __push = _ref.__push, __pop = _ref.__pop, __attribute = _ref.__attribute, __filter = _ref.__filter, __text = _ref.__text, __on = _ref.__on, __each = _ref.__each, __with = _ref.__with, __render = _ref.__render;\n    __push(document.createDocumentFragment());\n    activeIndex = this.activeIndex;\n    activeTool = this.activeTool;\n    __element = document.createElement(\"div\");\n    __push(__element);\n    __attribute(__element, \"class\", \"editor\");\n    __element = document.createElement(\"div\");\n    __push(__element);\n    __attribute(__element, \"class\", \"toolbar\");\n    __each(this.tools, function(tool) {\n      __element = document.createElement(\"div\");\n      __push(__element);\n      __attribute(__element, \"class\", \"tool\");\n      __attribute(__element, \"style\", \"background-image: url(\" + tool.iconUrl + \")\");\n      __on(\"click\", function(e) {\n        activeTool(tool);\n        return $(e.currentTarget).takeClass(\"active\");\n      });\n      return __pop();\n    });\n    __pop();\n    __element = document.createElement(\"div\");\n    __push(__element);\n    __attribute(__element, \"class\", \"viewport\");\n    __pop();\n    __element = document.createElement(\"div\");\n    __push(__element);\n    __attribute(__element, \"class\", \"palette\");\n    __element = document.createElement(\"div\");\n    __push(__element);\n    __attribute(__element, \"class\", \"color current\");\n    __pop();\n    __each(this.palette, function(color, index) {\n      __element = document.createElement(\"div\");\n      __push(__element);\n      __attribute(__element, \"class\", \"color\");\n      __attribute(__element, \"style\", \"background-color: \" + color);\n      __on(\"click\", function() {\n        return activeIndex(index);\n      });\n      return __pop();\n    });\n    __pop();\n    __pop();\n    return __pop();\n  }).call(data);\n});\n;",
      "type": "blob"
    },
    "test/editor": {
      "path": "test/editor",
      "content": "(function() {\n  require(\"../editor\");\n\n  describe(\"editor\", function() {\n    return it(\"should be radical\", function() {\n      return assert(true);\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/editor.coffee",
      "type": "blob"
    },
    "tools": {
      "path": "tools",
      "content": "(function() {\n  var TOOLS, circle, line, line2, neighbors, rect, rectOutline, shapeTool, _ref;\n\n  _ref = require(\"./util\"), line = _ref.line, circle = _ref.circle, rect = _ref.rect, rectOutline = _ref.rectOutline;\n\n  line2 = function(start, end, fn) {\n    fn(start);\n    return line(start, end, fn);\n  };\n\n  neighbors = function(point) {\n    return [Point(point.x, point.y - 1), Point(point.x - 1, point.y), Point(point.x + 1, point.y), Point(point.x, point.y + 1)];\n  };\n\n  shapeTool = function(fn, icon) {\n    var start;\n    start = null;\n    return {\n      iconUrl: icon,\n      touch: function(_arg) {\n        var position;\n        position = _arg.position;\n        return start = position;\n      },\n      move: function(_arg) {\n        var editor, position;\n        editor = _arg.editor, position = _arg.position;\n        return editor.preview(function() {\n          return fn(start, position, editor.draw);\n        });\n      },\n      release: function(_arg) {\n        var editor, position;\n        position = _arg.position, editor = _arg.editor;\n        return fn(start, position, editor.draw);\n      }\n    };\n  };\n\n  TOOLS = {\n    pencil: (function() {\n      var previousPosition;\n      previousPosition = null;\n      return {\n        iconUrl: \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA5klEQVQ4T5VTuw2DMBB9LmkZg54ZGCDpHYkJYBBYATcUSKnSwAy0iDFoKR0fDgiMDc5JLvy59969OzPchzSesP3+sLFgySoMweMYou/xmWe81VKx5d0CyCQBoghoGgiV/JombwDNzjkwjsAw/A8gswwgBWm6VPdU7L4laPa6BsrSyX6oxTBQ7munO1v9LgCv2ldCWxcWgDV4EDjZbQq0dDKv65ytuxokKdtWO08AagkhTr2/BiD2otBv8hyMurCbPHNaTQ8OBjJScZFs9eChTKMwB8byT5ajkwIC8E22AvyY7j7ZJugLVIZ5EV8R1SQAAAAASUVORK5CYII=\",\n        touch: function(_arg) {\n          var editor, position;\n          position = _arg.position, editor = _arg.editor;\n          editor.draw(position);\n          return previousPosition = position;\n        },\n        move: function(_arg) {\n          var editor, position;\n          editor = _arg.editor, position = _arg.position;\n          line(previousPosition, position, editor.draw);\n          return previousPosition = position;\n        },\n        release: function() {}\n      };\n    })(),\n    fill: {\n      iconUrl: \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABCklEQVQ4T52TPRKCMBCFX0pbj+HY0tJKY+UB8AqchCuYXofCRs9gy3ADW1rKmLeQTIBEZ0wTwu779idZhfQygUml3FIGikPb8ux5MUDM+S9AWAIjRrNNZYDLdov7MEiqx80G576PQqIAJ75NgJMFXPMc6vlcQZYAI842unq/YQ4HoKrGho1iqLqeQWadZuSyLKG1FmeWwMjY7QDCJlAIcQAj4iyDfr1kp4gggVgb9nsPUkXhs1gBJBpX1wFtC20BrpmSjS0pDbD1h8uJeQu+pKaJAmgfy5icQzH/sani9HgkAWLnLTAi0+YeiFmu+QXwEH5EHpAx7EFwld+GybVjOVTJdzBrYOKwGqoP9IV4EbRDWfEAAAAASUVORK5CYII=\",\n      touch: function(_arg) {\n        var editor, index, position, queue, targetIndex;\n        position = _arg.position, editor = _arg.editor;\n        index = editor.activeIndex();\n        targetIndex = editor.getPixel(position).index;\n        if (index === targetIndex) {\n          return;\n        }\n        queue = [position];\n        editor.draw(position);\n        while (queue.length) {\n          position = queue.pop();\n          neighbors(position).forEach(function(position) {\n            var _ref1;\n            if (((_ref1 = editor.getPixel(position)) != null ? _ref1.index : void 0) === targetIndex) {\n              editor.draw(position);\n              return queue.push(position);\n            }\n          });\n        }\n      },\n      move: function() {},\n      release: function() {}\n    },\n    circle: shapeTool(circle, \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAVklEQVQ4T2NkwA7+YxFmxKYUXRCmEZtirHLICkEKsNqCZjOKOpgGYjXDzIKrp4oBpNqO4gqQC0YNgAQJqeFA3WjESBw48gdWdVTNC8gWk50bCbgeUxoAvXwcEQnwKSYAAAAASUVORK5CYII=\"),\n    rect: shapeTool(rect, \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAK0lEQVQ4T2NkoBAwUqifYfAY8J9MrzDCvDBqAAPDMAgDMpMBwyBKymR7AQAp1wgR44q8HgAAAABJRU5ErkJggg==\"),\n    rectOutline: shapeTool(rectOutline, \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAN0lEQVQ4T2NkoBAwUqifgWoG/CfTJYwwF4AMINU1YD2jBgy7MCAnLcHTATmawXpITX0YFlFsAADRBBIRAZEL0wAAAABJRU5ErkJggg==\"),\n    line2: shapeTool(line2, \"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAV0lEQVQ4T6XSyQ0AIAgEQOm/aIWHxoNzJTG+GASk9hnE+Z2P3FDMRBjZK0PI/fQyovVeQqzhpRFv+ikkWl+IRID8DRfJAC6SBUykAqhIFXgQBDgQFFjIAMAADxGQlO+iAAAAAElFTkSuQmCC\")\n  };\n\n  module.exports = function(I, self) {\n    if (I == null) {\n      I = {};\n    }\n    if (self == null) {\n      self = Core(I);\n    }\n    self.extend({\n      addTool: function(tool) {\n        return self.tools.push(tool);\n      },\n      activeTool: Observable(),\n      tools: Observable([])\n    });\n    Object.keys(TOOLS).forEach(function(name) {\n      return self.addTool(TOOLS[name]);\n    });\n    self.activeTool(self.tools()[0]);\n    return self;\n  };\n\n}).call(this);\n\n//# sourceURL=tools.coffee",
      "type": "blob"
    },
    "undo": {
      "path": "undo",
      "content": "(function() {\n  var CommandStack;\n\n  CommandStack = require(\"commando\");\n\n  module.exports = function(I, self) {\n    var commandStack, dirty, lastClean, updateDirtyState;\n    if (I == null) {\n      I = {};\n    }\n    if (self == null) {\n      self = Core(I);\n    }\n    if (!self.on) {\n      self.include(Bindable);\n    }\n    commandStack = CommandStack();\n    lastClean = void 0;\n    dirty = function(newDirty) {\n      if (newDirty === false) {\n        lastClean = commandStack.current();\n        self.trigger('clean');\n        return self;\n      } else {\n        return lastClean !== commandStack.current();\n      }\n    };\n    updateDirtyState = function() {\n      if (dirty()) {\n        return self.trigger('dirty');\n      } else {\n        return self.trigger('clean');\n      }\n    };\n    self.on('save', function() {\n      return dirty(false);\n    });\n    self.extend({\n      execute: function(command) {\n        commandStack.execute(command);\n        updateDirtyState();\n        return self;\n      },\n      undo: function() {\n        commandStack.undo();\n        updateDirtyState();\n        return self;\n      },\n      redo: function() {\n        commandStack.redo();\n        updateDirtyState();\n        return self;\n      }\n    });\n    return self;\n  };\n\n}).call(this);\n\n//# sourceURL=undo.coffee",
      "type": "blob"
    },
    "util": {
      "path": "util",
      "content": "(function() {\n  var Size, isObject;\n\n  isObject = function(object) {\n    return Object.prototype.toString.call(object) === \"[object Object]\";\n  };\n\n  Size = function(width, height) {\n    return {\n      width: width,\n      height: height,\n      __proto__: Size.prototype\n    };\n  };\n\n  Size.prototype = {\n    scale: function(scalar) {\n      return Size(this.width * scalar, this.height * scalar);\n    },\n    toString: function() {\n      return \"Size(\" + this.width + \", \" + this.height + \")\";\n    },\n    each: function(iterator) {\n      var _i, _ref, _results;\n      return (function() {\n        _results = [];\n        for (var _i = 0, _ref = this.height; 0 <= _ref ? _i < _ref : _i > _ref; 0 <= _ref ? _i++ : _i--){ _results.push(_i); }\n        return _results;\n      }).apply(this).forEach(function(y) {\n        var _i, _ref, _results;\n        return (function() {\n          _results = [];\n          for (var _i = 0, _ref = this.width; 0 <= _ref ? _i < _ref : _i > _ref; 0 <= _ref ? _i++ : _i--){ _results.push(_i); }\n          return _results;\n        }).apply(this).forEach(function(x) {\n          return iterator(x, y);\n        });\n      });\n    }\n  };\n\n  Point.prototype.scale = function(scalar) {\n    if (isObject(scalar)) {\n      return Point(this.x * scalar.width, this.y * scalar.height);\n    } else {\n      return Point(this.x * scalar, this.y * scalar);\n    }\n  };\n\n  module.exports = {\n    Size: Size,\n    Grid: function(width, height, defaultValue) {\n      var grid, self, _i, _results;\n      grid = (function() {\n        _results = [];\n        for (var _i = 0; 0 <= height ? _i < height : _i > height; 0 <= height ? _i++ : _i--){ _results.push(_i); }\n        return _results;\n      }).apply(this).map(function(y) {\n        var _i, _results;\n        return (function() {\n          _results = [];\n          for (var _i = 0; 0 <= width ? _i < width : _i > width; 0 <= width ? _i++ : _i--){ _results.push(_i); }\n          return _results;\n        }).apply(this).map(function(x) {\n          if (typeof defaultValue === \"function\") {\n            return defaultValue(x, y);\n          } else {\n            return defaultValue;\n          }\n        });\n      });\n      self = {\n        copy: function() {\n          return Grid(width, height, self.get);\n        },\n        get: function(x, y) {\n          var _ref;\n          return (_ref = grid[y]) != null ? _ref[x] : void 0;\n        },\n        set: function(x, y, value) {\n          if (x < 0 || x >= width) {\n            return;\n          }\n          if (y < 0 || y >= height) {\n            return;\n          }\n          return grid[y][x] = value;\n        },\n        each: function(iterator) {\n          grid.forEach(function(row, y) {\n            return row.forEach(function(value, x) {\n              return iterator(value, x, y);\n            });\n          });\n          return self;\n        }\n      };\n      return self;\n    },\n    line: function(p0, p1, iterator) {\n      var dx, dy, e2, err, sx, sy, x0, x1, y0, y1, _results;\n      x0 = p0.x, y0 = p0.y;\n      x1 = p1.x, y1 = p1.y;\n      dx = (x1 - x0).abs();\n      dy = (y1 - y0).abs();\n      sx = (x1 - x0).sign();\n      sy = (y1 - y0).sign();\n      err = dx - dy;\n      _results = [];\n      while (!(x0 === x1 && y0 === y1)) {\n        e2 = 2 * err;\n        if (e2 > -dy) {\n          err -= dy;\n          x0 += sx;\n        }\n        if (e2 < dx) {\n          err += dx;\n          y0 += sy;\n        }\n        _results.push(iterator({\n          x: x0,\n          y: y0\n        }));\n      }\n      return _results;\n    },\n    rect: function(start, end, iterator) {\n      var _i, _ref, _ref1, _results;\n      return (function() {\n        _results = [];\n        for (var _i = _ref = start.y, _ref1 = end.y; _ref <= _ref1 ? _i <= _ref1 : _i >= _ref1; _ref <= _ref1 ? _i++ : _i--){ _results.push(_i); }\n        return _results;\n      }).apply(this).forEach(function(y) {\n        var _i, _ref, _ref1, _results;\n        return (function() {\n          _results = [];\n          for (var _i = _ref = start.x, _ref1 = end.x; _ref <= _ref1 ? _i <= _ref1 : _i >= _ref1; _ref <= _ref1 ? _i++ : _i--){ _results.push(_i); }\n          return _results;\n        }).apply(this).forEach(function(x) {\n          return iterator({\n            x: x,\n            y: y\n          });\n        });\n      });\n    },\n    rectOutline: function(start, end, iterator) {\n      var _i, _ref, _ref1, _results;\n      return (function() {\n        _results = [];\n        for (var _i = _ref = start.y, _ref1 = end.y; _ref <= _ref1 ? _i <= _ref1 : _i >= _ref1; _ref <= _ref1 ? _i++ : _i--){ _results.push(_i); }\n        return _results;\n      }).apply(this).forEach(function(y) {\n        var _i, _ref, _ref1, _results;\n        if (y === start.y || y === end.y) {\n          return (function() {\n            _results = [];\n            for (var _i = _ref = start.x, _ref1 = end.x; _ref <= _ref1 ? _i <= _ref1 : _i >= _ref1; _ref <= _ref1 ? _i++ : _i--){ _results.push(_i); }\n            return _results;\n          }).apply(this).forEach(function(x) {\n            return iterator({\n              x: x,\n              y: y\n            });\n          });\n        } else {\n          iterator({\n            x: start.x,\n            y: y\n          });\n          return iterator({\n            x: end.x,\n            y: y\n          });\n        }\n      });\n    },\n    circle: function(center, endPoint, iterator) {\n      var ddFx, ddFy, f, radius, x, x0, x1, y, y0, y1, _results;\n      x0 = center.x, y0 = center.y;\n      x1 = endPoint.x, y1 = endPoint.y;\n      radius = endPoint.subtract(center).magnitude().floor();\n      f = 1 - radius;\n      ddFx = 1;\n      ddFy = -2 * radius;\n      x = 0;\n      y = radius;\n      iterator(Point(x0, y0 + radius));\n      iterator(Point(x0, y0 - radius));\n      iterator(Point(x0 + radius, y0));\n      iterator(Point(x0 - radius, y0));\n      _results = [];\n      while (x < y) {\n        if (f > 0) {\n          y--;\n          ddFy += 2;\n          f += ddFy;\n        }\n        x++;\n        ddFx += 2;\n        f += ddFx;\n        iterator(Point(x0 + x, y0 + y));\n        iterator(Point(x0 - x, y0 + y));\n        iterator(Point(x0 + x, y0 - y));\n        iterator(Point(x0 - x, y0 - y));\n        iterator(Point(x0 + y, y0 + x));\n        iterator(Point(x0 - y, y0 + x));\n        iterator(Point(x0 + y, y0 - x));\n        _results.push(iterator(Point(x0 - y, y0 - x)));\n      }\n      return _results;\n    },\n    download: function(extension, type) {\n      var name;\n      if (extension == null) {\n        extension = \"png\";\n      }\n      if (type == null) {\n        type = \"image/png\";\n      }\n      if (typeof webkitRequestFileSystem === \"undefined\" || webkitRequestFileSystem === null) {\n        return;\n      }\n      name = prompt(\"File name\", \"\" + name + \".\" + extension);\n      return webkitRequestFileSystem(TEMPORARY, 5 * 1024 * 1024, function(fs) {\n        return fs.root.getFile(name, {\n          create: true\n        }, function(fileEntry) {\n          return fileEntry.createWriter(function(fileWriter) {\n            var arr, blob;\n            arr = new Uint8Array(3);\n            arr[0] = 97;\n            arr[1] = 98;\n            arr[2] = 99;\n            blob = new Blob([arr], {\n              type: type\n            });\n            fileWriter.addEventListener(\"writeend\", function() {\n              return location.href = fileEntry.toURL();\n            }, false);\n            return fileWriter.write(blob);\n          });\n        });\n      });\n    }\n  };\n\n}).call(this);\n\n//# sourceURL=util.coffee",
      "type": "blob"
    }
  },
  "entryPoint": "editor",
  "dependencies": {
    "jquery-utils": {
      "version": "0.1.2",
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "jquery-utils\n============\n",
          "type": "blob"
        },
        "main.coffee.md": {
          "path": "main.coffee.md",
          "mode": "100644",
          "content": "    require \"hotkeys\"\n    require \"image-reader\"\n    require \"./take_class\"\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.1.2\"\nremoteDependencies: [\n  \"//code.jquery.com/jquery-1.10.1.min.js\"\n  \"http://strd6.github.io/tempest/javascripts/envweb.js\"\n  \"http://strd6.github.io/require/v0.2.2.js\"\n]\ndependencies:\n  hotkeys: \"STRd6/jquery.hotkeys:v0.9.0\"\n  \"image-reader\": \"STRd6/jquery-image_reader:v0.1.3\"\n",
          "type": "blob"
        },
        "take_class.coffee.md": {
          "path": "take_class.coffee.md",
          "mode": "100644",
          "content": "Take Class\n==========\n\nTake the named class from all the sibling elements. Perfect for something like\nradio buttons.\n\n    (($) ->\n      $.fn.takeClass = (name) ->\n        @addClass(name).siblings().removeClass(name)\n\n        return this\n    )(jQuery)\n",
          "type": "blob"
        },
        "test/take_class.coffee": {
          "path": "test/take_class.coffee",
          "mode": "100644",
          "content": "require \"../main\"\n\ndescribe \"jQuery#takeClass\", ->\n  it \"should exist\", ->\n    assert $.fn.takeClass\n",
          "type": "blob"
        },
        "test/image_reader.coffee": {
          "path": "test/image_reader.coffee",
          "mode": "100644",
          "content": "require \"../main\"\n\ndescribe \"jQuery#pasteImageReader\", ->\n  it \"should exist\", ->\n    assert $.fn.pasteImageReader\n\ndescribe \"jQuery#dropImageReader\", ->\n  it \"should exist\", ->\n    assert $.fn.dropImageReader\n",
          "type": "blob"
        }
      },
      "distribution": {
        "main": {
          "path": "main",
          "content": "(function() {\n  require(\"hotkeys\");\n\n  require(\"image-reader\");\n\n  require(\"./take_class\");\n\n}).call(this);\n\n//# sourceURL=main.coffee",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.1.2\",\"remoteDependencies\":[\"//code.jquery.com/jquery-1.10.1.min.js\",\"http://strd6.github.io/tempest/javascripts/envweb.js\",\"http://strd6.github.io/require/v0.2.2.js\"],\"dependencies\":{\"hotkeys\":\"STRd6/jquery.hotkeys:v0.9.0\",\"image-reader\":\"STRd6/jquery-image_reader:v0.1.3\"}};",
          "type": "blob"
        },
        "take_class": {
          "path": "take_class",
          "content": "(function() {\n  (function($) {\n    return $.fn.takeClass = function(name) {\n      this.addClass(name).siblings().removeClass(name);\n      return this;\n    };\n  })(jQuery);\n\n}).call(this);\n\n//# sourceURL=take_class.coffee",
          "type": "blob"
        },
        "test/take_class": {
          "path": "test/take_class",
          "content": "(function() {\n  require(\"../main\");\n\n  describe(\"jQuery#takeClass\", function() {\n    return it(\"should exist\", function() {\n      return assert($.fn.takeClass);\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/take_class.coffee",
          "type": "blob"
        },
        "test/image_reader": {
          "path": "test/image_reader",
          "content": "(function() {\n  require(\"../main\");\n\n  describe(\"jQuery#pasteImageReader\", function() {\n    return it(\"should exist\", function() {\n      return assert($.fn.pasteImageReader);\n    });\n  });\n\n  describe(\"jQuery#dropImageReader\", function() {\n    return it(\"should exist\", function() {\n      return assert($.fn.dropImageReader);\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/image_reader.coffee",
          "type": "blob"
        }
      },
      "entryPoint": "main",
      "dependencies": {
        "hotkeys": {
          "version": "0.9.0",
          "source": {
            "LICENSE": {
              "path": "LICENSE",
              "mode": "100644",
              "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
              "type": "blob"
            },
            "README.md": {
              "path": "README.md",
              "mode": "100644",
              "content": "jquery.hotkeys\n==============\n\njQuery hotkeys plugin\n",
              "type": "blob"
            },
            "hotkeys.coffee.md": {
              "path": "hotkeys.coffee.md",
              "mode": "100644",
              "content": "jQuery Hotkeys Plugin\n=====================\n\nCopyright 2010, John Resig\nDual licensed under the MIT or GPL Version 2 licenses.\n\nBased upon the plugin by Tzury Bar Yochay:\nhttp://github.com/tzuryby/hotkeys\n\nOriginal idea by:\nBinny V A, http://www.openjs.com/scripts/events/keyboard_shortcuts/\n\n    if jQuery? \n      ((jQuery) ->\n        isTextAcceptingInput = (element) ->\n          /textarea|select/i.test(element.nodeName) or element.type is \"text\" or element.type is \"password\"\n\n        isFunctionKey = (event) ->\n          (event.type != \"keypress\") && (112 <= event.which <= 123)\n\n        jQuery.hotkeys =\n          version: \"0.9.0\"\n\n          specialKeys:\n            8: \"backspace\"\n            9: \"tab\"\n            13: \"return\"\n            16: \"shift\"\n            17: \"ctrl\"\n            18: \"alt\"\n            19: \"pause\"\n            20: \"capslock\"\n            27: \"esc\"\n            32: \"space\"\n            33: \"pageup\"\n            34: \"pagedown\"\n            35: \"end\"\n            36: \"home\"\n            37: \"left\"\n            38: \"up\"\n            39: \"right\"\n            40: \"down\"\n            45: \"insert\"\n            46: \"del\"\n            96: \"0\"\n            97: \"1\"\n            98: \"2\"\n            99: \"3\"\n            100: \"4\"\n            101: \"5\"\n            102: \"6\"\n            103: \"7\"\n            104: \"8\"\n            105: \"9\"\n            106: \"*\"\n            107: \"+\"\n            109: \"-\"\n            110: \".\"\n            111 : \"/\"\n            112: \"f1\"\n            113: \"f2\"\n            114: \"f3\"\n            115: \"f4\"\n            116: \"f5\"\n            117: \"f6\"\n            118: \"f7\"\n            119: \"f8\"\n            120: \"f9\"\n            121: \"f10\"\n            122: \"f11\"\n            123: \"f12\"\n            144: \"numlock\"\n            145: \"scroll\"\n            186: \";\"\n            187: \"=\"\n            188: \",\"\n            189: \"-\"\n            190: \".\"\n            191: \"/\"\n            219: \"[\"\n            220: \"\\\\\"\n            221: \"]\"\n            222: \"'\"\n            224: \"meta\"\n\n          shiftNums:\n            \"`\": \"~\"\n            \"1\": \"!\"\n            \"2\": \"@\"\n            \"3\": \"#\"\n            \"4\": \"$\"\n            \"5\": \"%\"\n            \"6\": \"^\"\n            \"7\": \"&\"\n            \"8\": \"*\"\n            \"9\": \"(\"\n            \"0\": \")\"\n            \"-\": \"_\"\n            \"=\": \"+\"\n            \";\": \":\"\n            \"'\": \"\\\"\"\n            \",\": \"<\"\n            \".\": \">\"\n            \"/\": \"?\"\n            \"\\\\\": \"|\"\n\n        keyHandler = (handleObj) ->\n          # Only care when a possible input has been specified\n          if typeof handleObj.data != \"string\"\n            return\n\n          origHandler = handleObj.handler\n          keys = handleObj.data.toLowerCase().split(\" \")\n\n          handleObj.handler = (event) ->          \n            # Keypress represents characters, not special keys\n            special = event.type != \"keypress\" && jQuery.hotkeys.specialKeys[ event.which ]\n            character = String.fromCharCode( event.which ).toLowerCase()\n            modif = \"\"\n            possible = {}\n            target = event.target\n\n            # check combinations (alt|ctrl|shift+anything)\n            if event.altKey && special != \"alt\"\n              modif += \"alt+\"\n\n            if event.ctrlKey && special != \"ctrl\"\n              modif += \"ctrl+\"\n\n            # TODO: Need to make sure this works consistently across platforms\n            if event.metaKey && !event.ctrlKey && special != \"meta\"\n              modif += \"meta+\"\n\n            # Don't fire in text-accepting inputs that we didn't directly bind to\n            # unless a non-shift modifier key or function key is pressed\n            unless this == target\n              if isTextAcceptingInput(target) && !modif && !isFunctionKey(event)\n                return\n\n            if event.shiftKey && special != \"shift\"\n              modif += \"shift+\"\n\n            if special\n              possible[ modif + special ] = true\n            else\n              possible[ modif + character ] = true\n              possible[ modif + jQuery.hotkeys.shiftNums[ character ] ] = true\n      \n              # \"$\" can be triggered as \"Shift+4\" or \"Shift+$\" or just \"$\"\n              if modif == \"shift+\"\n                possible[ jQuery.hotkeys.shiftNums[ character ] ] = true\n\n            for key in keys\n              if possible[key]\n                return origHandler.apply( this, arguments )\n\n        jQuery.each [ \"keydown\", \"keyup\", \"keypress\" ], ->\n          jQuery.event.special[ this ] = { add: keyHandler }\n\n      )(jQuery)\n    else\n      console.warn \"jQuery not found, no hotkeys added :(\"\n",
              "type": "blob"
            },
            "pixie.cson": {
              "path": "pixie.cson",
              "mode": "100644",
              "content": "version: \"0.9.0\"\nentryPoint: \"hotkeys\"\nremoteDependencies: [\n  \"//code.jquery.com/jquery-1.10.1.min.js\"\n  \"http://strd6.github.io/tempest/javascripts/envweb.js\"\n  \"http://strd6.github.io/require/v0.1.0.js\"\n]\n",
              "type": "blob"
            },
            "test/hotkeys.coffee": {
              "path": "test/hotkeys.coffee",
              "mode": "100644",
              "content": "require \"../hotkeys\"\n\ndescribe \"hotkeys binding\", ->\n  it \"should bind a hotkey\", (done) ->\n    $(document).bind \"keydown\", \"a\", ->\n      done()\n\n    $(document).trigger $.Event \"keydown\",\n      which: 65 # a\n      keyCode: 65\n",
              "type": "blob"
            }
          },
          "distribution": {
            "hotkeys": {
              "path": "hotkeys",
              "content": "(function() {\n  if (typeof jQuery !== \"undefined\" && jQuery !== null) {\n    (function(jQuery) {\n      var isFunctionKey, isTextAcceptingInput, keyHandler;\n      isTextAcceptingInput = function(element) {\n        return /textarea|select/i.test(element.nodeName) || element.type === \"text\" || element.type === \"password\";\n      };\n      isFunctionKey = function(event) {\n        var _ref;\n        return (event.type !== \"keypress\") && ((112 <= (_ref = event.which) && _ref <= 123));\n      };\n      jQuery.hotkeys = {\n        version: \"0.9.0\",\n        specialKeys: {\n          8: \"backspace\",\n          9: \"tab\",\n          13: \"return\",\n          16: \"shift\",\n          17: \"ctrl\",\n          18: \"alt\",\n          19: \"pause\",\n          20: \"capslock\",\n          27: \"esc\",\n          32: \"space\",\n          33: \"pageup\",\n          34: \"pagedown\",\n          35: \"end\",\n          36: \"home\",\n          37: \"left\",\n          38: \"up\",\n          39: \"right\",\n          40: \"down\",\n          45: \"insert\",\n          46: \"del\",\n          96: \"0\",\n          97: \"1\",\n          98: \"2\",\n          99: \"3\",\n          100: \"4\",\n          101: \"5\",\n          102: \"6\",\n          103: \"7\",\n          104: \"8\",\n          105: \"9\",\n          106: \"*\",\n          107: \"+\",\n          109: \"-\",\n          110: \".\",\n          111: \"/\",\n          112: \"f1\",\n          113: \"f2\",\n          114: \"f3\",\n          115: \"f4\",\n          116: \"f5\",\n          117: \"f6\",\n          118: \"f7\",\n          119: \"f8\",\n          120: \"f9\",\n          121: \"f10\",\n          122: \"f11\",\n          123: \"f12\",\n          144: \"numlock\",\n          145: \"scroll\",\n          186: \";\",\n          187: \"=\",\n          188: \",\",\n          189: \"-\",\n          190: \".\",\n          191: \"/\",\n          219: \"[\",\n          220: \"\\\\\",\n          221: \"]\",\n          222: \"'\",\n          224: \"meta\"\n        },\n        shiftNums: {\n          \"`\": \"~\",\n          \"1\": \"!\",\n          \"2\": \"@\",\n          \"3\": \"#\",\n          \"4\": \"$\",\n          \"5\": \"%\",\n          \"6\": \"^\",\n          \"7\": \"&\",\n          \"8\": \"*\",\n          \"9\": \"(\",\n          \"0\": \")\",\n          \"-\": \"_\",\n          \"=\": \"+\",\n          \";\": \":\",\n          \"'\": \"\\\"\",\n          \",\": \"<\",\n          \".\": \">\",\n          \"/\": \"?\",\n          \"\\\\\": \"|\"\n        }\n      };\n      keyHandler = function(handleObj) {\n        var keys, origHandler;\n        if (typeof handleObj.data !== \"string\") {\n          return;\n        }\n        origHandler = handleObj.handler;\n        keys = handleObj.data.toLowerCase().split(\" \");\n        return handleObj.handler = function(event) {\n          var character, key, modif, possible, special, target, _i, _len;\n          special = event.type !== \"keypress\" && jQuery.hotkeys.specialKeys[event.which];\n          character = String.fromCharCode(event.which).toLowerCase();\n          modif = \"\";\n          possible = {};\n          target = event.target;\n          if (event.altKey && special !== \"alt\") {\n            modif += \"alt+\";\n          }\n          if (event.ctrlKey && special !== \"ctrl\") {\n            modif += \"ctrl+\";\n          }\n          if (event.metaKey && !event.ctrlKey && special !== \"meta\") {\n            modif += \"meta+\";\n          }\n          if (this !== target) {\n            if (isTextAcceptingInput(target) && !modif && !isFunctionKey(event)) {\n              return;\n            }\n          }\n          if (event.shiftKey && special !== \"shift\") {\n            modif += \"shift+\";\n          }\n          if (special) {\n            possible[modif + special] = true;\n          } else {\n            possible[modif + character] = true;\n            possible[modif + jQuery.hotkeys.shiftNums[character]] = true;\n            if (modif === \"shift+\") {\n              possible[jQuery.hotkeys.shiftNums[character]] = true;\n            }\n          }\n          for (_i = 0, _len = keys.length; _i < _len; _i++) {\n            key = keys[_i];\n            if (possible[key]) {\n              return origHandler.apply(this, arguments);\n            }\n          }\n        };\n      };\n      return jQuery.each([\"keydown\", \"keyup\", \"keypress\"], function() {\n        return jQuery.event.special[this] = {\n          add: keyHandler\n        };\n      });\n    })(jQuery);\n  } else {\n    console.warn(\"jQuery not found, no hotkeys added :(\");\n  }\n\n}).call(this);\n",
              "type": "blob"
            },
            "pixie": {
              "path": "pixie",
              "content": "module.exports = {\"version\":\"0.9.0\",\"entryPoint\":\"hotkeys\",\"remoteDependencies\":[\"//code.jquery.com/jquery-1.10.1.min.js\",\"http://strd6.github.io/tempest/javascripts/envweb.js\",\"http://strd6.github.io/require/v0.1.0.js\"]};",
              "type": "blob"
            },
            "test/hotkeys": {
              "path": "test/hotkeys",
              "content": "(function() {\n  require(\"../hotkeys\");\n\n  describe(\"hotkeys binding\", function() {\n    return it(\"should bind a hotkey\", function(done) {\n      $(document).bind(\"keydown\", \"a\", function() {\n        return done();\n      });\n      return $(document).trigger($.Event(\"keydown\", {\n        which: 65,\n        keyCode: 65\n      }));\n    });\n  });\n\n}).call(this);\n",
              "type": "blob"
            }
          },
          "entryPoint": "hotkeys",
          "dependencies": {},
          "remoteDependencies": [
            "//code.jquery.com/jquery-1.10.1.min.js",
            "http://strd6.github.io/tempest/javascripts/envweb.js",
            "http://strd6.github.io/require/v0.1.0.js"
          ],
          "repository": {
            "id": 13182272,
            "name": "jquery.hotkeys",
            "full_name": "STRd6/jquery.hotkeys",
            "owner": {
              "login": "STRd6",
              "id": 18894,
              "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png",
              "gravatar_id": "33117162fff8a9cf50544a604f60c045",
              "url": "https://api.github.com/users/STRd6",
              "html_url": "https://github.com/STRd6",
              "followers_url": "https://api.github.com/users/STRd6/followers",
              "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
              "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
              "organizations_url": "https://api.github.com/users/STRd6/orgs",
              "repos_url": "https://api.github.com/users/STRd6/repos",
              "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
              "received_events_url": "https://api.github.com/users/STRd6/received_events",
              "type": "User"
            },
            "private": false,
            "html_url": "https://github.com/STRd6/jquery.hotkeys",
            "description": "jQuery hotkeys plugin",
            "fork": false,
            "url": "https://api.github.com/repos/STRd6/jquery.hotkeys",
            "forks_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/forks",
            "keys_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/keys{/key_id}",
            "collaborators_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/collaborators{/collaborator}",
            "teams_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/teams",
            "hooks_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/hooks",
            "issue_events_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/issues/events{/number}",
            "events_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/events",
            "assignees_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/assignees{/user}",
            "branches_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/branches{/branch}",
            "tags_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/tags",
            "blobs_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/git/blobs{/sha}",
            "git_tags_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/git/tags{/sha}",
            "git_refs_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/git/refs{/sha}",
            "trees_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/git/trees{/sha}",
            "statuses_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/statuses/{sha}",
            "languages_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/languages",
            "stargazers_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/stargazers",
            "contributors_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/contributors",
            "subscribers_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/subscribers",
            "subscription_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/subscription",
            "commits_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/commits{/sha}",
            "git_commits_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/git/commits{/sha}",
            "comments_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/comments{/number}",
            "issue_comment_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/issues/comments/{number}",
            "contents_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/contents/{+path}",
            "compare_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/compare/{base}...{head}",
            "merges_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/merges",
            "archive_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/{archive_format}{/ref}",
            "downloads_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/downloads",
            "issues_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/issues{/number}",
            "pulls_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/pulls{/number}",
            "milestones_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/milestones{/number}",
            "notifications_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/notifications{?since,all,participating}",
            "labels_url": "https://api.github.com/repos/STRd6/jquery.hotkeys/labels{/name}",
            "created_at": "2013-09-28T22:58:08Z",
            "updated_at": "2013-09-28T22:58:08Z",
            "pushed_at": "2013-09-28T22:58:08Z",
            "git_url": "git://github.com/STRd6/jquery.hotkeys.git",
            "ssh_url": "git@github.com:STRd6/jquery.hotkeys.git",
            "clone_url": "https://github.com/STRd6/jquery.hotkeys.git",
            "svn_url": "https://github.com/STRd6/jquery.hotkeys",
            "homepage": null,
            "size": 0,
            "watchers_count": 0,
            "language": null,
            "has_issues": true,
            "has_downloads": true,
            "has_wiki": true,
            "forks_count": 0,
            "mirror_url": null,
            "open_issues_count": 0,
            "forks": 0,
            "open_issues": 0,
            "watchers": 0,
            "master_branch": "master",
            "default_branch": "master",
            "permissions": {
              "admin": true,
              "push": true,
              "pull": true
            },
            "network_count": 0,
            "branch": "v0.9.0",
            "defaultBranch": "master",
            "includedModules": [
              "Bindable"
            ]
          },
          "progenitor": {
            "url": "http://strd6.github.io/editor/"
          }
        },
        "image-reader": {
          "version": "0.1.3",
          "source": {
            "LICENSE": {
              "path": "LICENSE",
              "mode": "100644",
              "content": "Copyright (c) 2012 Daniel X. Moore\n\nMIT License\n\nPermission is hereby granted, free of charge, to any person obtaining\na copy of this software and associated documentation files (the\n\"Software\"), to deal in the Software without restriction, including\nwithout limitation the rights to use, copy, modify, merge, publish,\ndistribute, sublicense, and/or sell copies of the Software, and to\npermit persons to whom the Software is furnished to do so, subject to\nthe following conditions:\n\nThe above copyright notice and this permission notice shall be\nincluded in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND\nNONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE\nLIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION\nOF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION\nWITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.",
              "type": "blob"
            },
            "README.md": {
              "path": "README.md",
              "mode": "100644",
              "content": "# Jquery::ImageReader\n\nHelpful jQuery plugins for dropping and pasting image data.\n\n## Usage\n\n```coffeescript\n$(\"html\").pasteImageReader ({name, dataURL, file, event}) ->\n  $(\"body\").css\n    backgroundImage: \"url(#{dataURL})\"\n\n$(\"html\").dropImageReader ({name, dataURL, file, event}) ->\n  $(\"body\").css\n    backgroundImage: \"url(#{dataURL})\"\n```\n\n## Contributing\n\n1. Fork it\n2. Create your feature branch (`git checkout -b my-new-feature`)\n3. Commit your changes (`git commit -am 'Added some feature'`)\n4. Push to the branch (`git push origin my-new-feature`)\n5. Create new Pull Request\n",
              "type": "blob"
            },
            "test/image_reader.coffee": {
              "path": "test/image_reader.coffee",
              "mode": "100644",
              "content": "require \"../main\"\n\n$(\"html\").pasteImageReader ({name, dataURL, file, event}) ->\n  $(\"body\").css\n    backgroundImage: \"url(#{dataURL})\"\n\n$(\"html\").dropImageReader ({name, dataURL, file, event}) ->\n  $(\"body\").css\n    backgroundImage: \"url(#{dataURL})\"\n",
              "type": "blob"
            },
            "paste.coffee.md": {
              "path": "paste.coffee.md",
              "mode": "100644",
              "content": "Paste\n=====\n\n    (($) ->\n      $.event.fix = ((originalFix) ->\n        (event) ->\n          event = originalFix.apply(this, arguments)\n    \n          if event.type.indexOf('copy') == 0 || event.type.indexOf('paste') == 0\n            event.clipboardData = event.originalEvent.clipboardData\n    \n          return event\n    \n      )($.event.fix)\n    \n      defaults =\n        callback: $.noop\n        matchType: /image.*/\n    \n      $.fn.pasteImageReader = (options) ->\n        if typeof options == \"function\"\n          options =\n            callback: options\n    \n        options = $.extend({}, defaults, options)\n    \n        @each ->\n          element = this\n          $this = $(this)\n    \n          $this.bind 'paste', (event) ->\n            found = false\n            clipboardData = event.clipboardData\n    \n            Array::forEach.call clipboardData.types, (type, i) ->\n              return if found\n    \n              if type.match(options.matchType) or (clipboardData.items && clipboardData.items[i].type.match(options.matchType))\n                file = clipboardData.items[i].getAsFile()\n    \n                reader = new FileReader()\n    \n                reader.onload = (evt) ->\n                  options.callback.call element,\n                    dataURL: evt.target.result\n                    event: evt\n                    file: file\n                    name: file.name\n    \n                reader.readAsDataURL(file)\n    \n                found = true\n    \n    )(jQuery)\n",
              "type": "blob"
            },
            "drop.coffee.md": {
              "path": "drop.coffee.md",
              "mode": "100644",
              "content": "Drop\n====\n\n    (($) ->\n      $.event.fix = ((originalFix) ->\n        (event) ->\n          event = originalFix.apply(this, arguments)\n    \n          if event.type.indexOf('drag') == 0 || event.type.indexOf('drop') == 0\n            event.dataTransfer = event.originalEvent.dataTransfer\n    \n          event\n    \n      )($.event.fix)\n    \n      defaults =\n        callback: $.noop\n        matchType: /image.*/\n    \n      $.fn.dropImageReader = (options) ->\n        if typeof options == \"function\"\n          options =\n            callback: options\n    \n        options = $.extend({}, defaults, options)\n    \n        stopFn = (event) ->\n          event.stopPropagation()\n          event.preventDefault()\n    \n        this.each ->\n          element = this\n          $this = $(this)\n    \n          $this.bind 'dragenter dragover dragleave', stopFn\n    \n          $this.bind 'drop', (event) ->\n            stopFn(event)\n    \n            Array::forEach.call event.dataTransfer.files, (file) ->\n              return unless file.type.match(options.matchType)\n    \n              reader = new FileReader()\n    \n              reader.onload = (evt) ->\n                options.callback.call element,\n                  dataURL: evt.target.result\n                  event: evt\n                  file: file\n                  name: file.name\n    \n              reader.readAsDataURL(file)\n    \n    )(jQuery)\n",
              "type": "blob"
            },
            "main.coffee.md": {
              "path": "main.coffee.md",
              "mode": "100644",
              "content": "\n    require \"./paste\"\n    require \"./drop\"\n",
              "type": "blob"
            },
            "pixie.cson": {
              "path": "pixie.cson",
              "mode": "100644",
              "content": "version: \"0.1.3\"\nentryPoint: \"main\"\nremoteDependencies: [\n  \"//code.jquery.com/jquery-1.10.1.min.js\"\n  \"http://strd6.github.io/require/v0.2.2.js\"\n]\n",
              "type": "blob"
            }
          },
          "distribution": {
            "test/image_reader": {
              "path": "test/image_reader",
              "content": "(function() {\n  require(\"../main\");\n\n  $(\"html\").pasteImageReader(function(_arg) {\n    var dataURL, event, file, name;\n    name = _arg.name, dataURL = _arg.dataURL, file = _arg.file, event = _arg.event;\n    return $(\"body\").css({\n      backgroundImage: \"url(\" + dataURL + \")\"\n    });\n  });\n\n  $(\"html\").dropImageReader(function(_arg) {\n    var dataURL, event, file, name;\n    name = _arg.name, dataURL = _arg.dataURL, file = _arg.file, event = _arg.event;\n    return $(\"body\").css({\n      backgroundImage: \"url(\" + dataURL + \")\"\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/image_reader.coffee",
              "type": "blob"
            },
            "paste": {
              "path": "paste",
              "content": "(function() {\n  (function($) {\n    var defaults;\n    $.event.fix = (function(originalFix) {\n      return function(event) {\n        event = originalFix.apply(this, arguments);\n        if (event.type.indexOf('copy') === 0 || event.type.indexOf('paste') === 0) {\n          event.clipboardData = event.originalEvent.clipboardData;\n        }\n        return event;\n      };\n    })($.event.fix);\n    defaults = {\n      callback: $.noop,\n      matchType: /image.*/\n    };\n    return $.fn.pasteImageReader = function(options) {\n      if (typeof options === \"function\") {\n        options = {\n          callback: options\n        };\n      }\n      options = $.extend({}, defaults, options);\n      return this.each(function() {\n        var $this, element;\n        element = this;\n        $this = $(this);\n        return $this.bind('paste', function(event) {\n          var clipboardData, found;\n          found = false;\n          clipboardData = event.clipboardData;\n          return Array.prototype.forEach.call(clipboardData.types, function(type, i) {\n            var file, reader;\n            if (found) {\n              return;\n            }\n            if (type.match(options.matchType) || (clipboardData.items && clipboardData.items[i].type.match(options.matchType))) {\n              file = clipboardData.items[i].getAsFile();\n              reader = new FileReader();\n              reader.onload = function(evt) {\n                return options.callback.call(element, {\n                  dataURL: evt.target.result,\n                  event: evt,\n                  file: file,\n                  name: file.name\n                });\n              };\n              reader.readAsDataURL(file);\n              return found = true;\n            }\n          });\n        });\n      });\n    };\n  })(jQuery);\n\n}).call(this);\n\n//# sourceURL=paste.coffee",
              "type": "blob"
            },
            "drop": {
              "path": "drop",
              "content": "(function() {\n  (function($) {\n    var defaults;\n    $.event.fix = (function(originalFix) {\n      return function(event) {\n        event = originalFix.apply(this, arguments);\n        if (event.type.indexOf('drag') === 0 || event.type.indexOf('drop') === 0) {\n          event.dataTransfer = event.originalEvent.dataTransfer;\n        }\n        return event;\n      };\n    })($.event.fix);\n    defaults = {\n      callback: $.noop,\n      matchType: /image.*/\n    };\n    return $.fn.dropImageReader = function(options) {\n      var stopFn;\n      if (typeof options === \"function\") {\n        options = {\n          callback: options\n        };\n      }\n      options = $.extend({}, defaults, options);\n      stopFn = function(event) {\n        event.stopPropagation();\n        return event.preventDefault();\n      };\n      return this.each(function() {\n        var $this, element;\n        element = this;\n        $this = $(this);\n        $this.bind('dragenter dragover dragleave', stopFn);\n        return $this.bind('drop', function(event) {\n          stopFn(event);\n          return Array.prototype.forEach.call(event.dataTransfer.files, function(file) {\n            var reader;\n            if (!file.type.match(options.matchType)) {\n              return;\n            }\n            reader = new FileReader();\n            reader.onload = function(evt) {\n              return options.callback.call(element, {\n                dataURL: evt.target.result,\n                event: evt,\n                file: file,\n                name: file.name\n              });\n            };\n            return reader.readAsDataURL(file);\n          });\n        });\n      });\n    };\n  })(jQuery);\n\n}).call(this);\n\n//# sourceURL=drop.coffee",
              "type": "blob"
            },
            "main": {
              "path": "main",
              "content": "(function() {\n  require(\"./paste\");\n\n  require(\"./drop\");\n\n}).call(this);\n\n//# sourceURL=main.coffee",
              "type": "blob"
            },
            "pixie": {
              "path": "pixie",
              "content": "module.exports = {\"version\":\"0.1.3\",\"entryPoint\":\"main\",\"remoteDependencies\":[\"//code.jquery.com/jquery-1.10.1.min.js\",\"http://strd6.github.io/require/v0.2.2.js\"]};",
              "type": "blob"
            }
          },
          "entryPoint": "main",
          "dependencies": {},
          "remoteDependencies": [
            "//code.jquery.com/jquery-1.10.1.min.js",
            "http://strd6.github.io/require/v0.2.2.js"
          ],
          "progenitor": {
            "url": "http://strd6.github.io/editor/"
          },
          "repository": {
            "id": 4527535,
            "name": "jquery-image_reader",
            "full_name": "STRd6/jquery-image_reader",
            "owner": {
              "login": "STRd6",
              "id": 18894,
              "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
              "gravatar_id": "33117162fff8a9cf50544a604f60c045",
              "url": "https://api.github.com/users/STRd6",
              "html_url": "https://github.com/STRd6",
              "followers_url": "https://api.github.com/users/STRd6/followers",
              "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
              "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
              "organizations_url": "https://api.github.com/users/STRd6/orgs",
              "repos_url": "https://api.github.com/users/STRd6/repos",
              "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
              "received_events_url": "https://api.github.com/users/STRd6/received_events",
              "type": "User",
              "site_admin": false
            },
            "private": false,
            "html_url": "https://github.com/STRd6/jquery-image_reader",
            "description": "Paste and Drop images into web apps",
            "fork": false,
            "url": "https://api.github.com/repos/STRd6/jquery-image_reader",
            "forks_url": "https://api.github.com/repos/STRd6/jquery-image_reader/forks",
            "keys_url": "https://api.github.com/repos/STRd6/jquery-image_reader/keys{/key_id}",
            "collaborators_url": "https://api.github.com/repos/STRd6/jquery-image_reader/collaborators{/collaborator}",
            "teams_url": "https://api.github.com/repos/STRd6/jquery-image_reader/teams",
            "hooks_url": "https://api.github.com/repos/STRd6/jquery-image_reader/hooks",
            "issue_events_url": "https://api.github.com/repos/STRd6/jquery-image_reader/issues/events{/number}",
            "events_url": "https://api.github.com/repos/STRd6/jquery-image_reader/events",
            "assignees_url": "https://api.github.com/repos/STRd6/jquery-image_reader/assignees{/user}",
            "branches_url": "https://api.github.com/repos/STRd6/jquery-image_reader/branches{/branch}",
            "tags_url": "https://api.github.com/repos/STRd6/jquery-image_reader/tags",
            "blobs_url": "https://api.github.com/repos/STRd6/jquery-image_reader/git/blobs{/sha}",
            "git_tags_url": "https://api.github.com/repos/STRd6/jquery-image_reader/git/tags{/sha}",
            "git_refs_url": "https://api.github.com/repos/STRd6/jquery-image_reader/git/refs{/sha}",
            "trees_url": "https://api.github.com/repos/STRd6/jquery-image_reader/git/trees{/sha}",
            "statuses_url": "https://api.github.com/repos/STRd6/jquery-image_reader/statuses/{sha}",
            "languages_url": "https://api.github.com/repos/STRd6/jquery-image_reader/languages",
            "stargazers_url": "https://api.github.com/repos/STRd6/jquery-image_reader/stargazers",
            "contributors_url": "https://api.github.com/repos/STRd6/jquery-image_reader/contributors",
            "subscribers_url": "https://api.github.com/repos/STRd6/jquery-image_reader/subscribers",
            "subscription_url": "https://api.github.com/repos/STRd6/jquery-image_reader/subscription",
            "commits_url": "https://api.github.com/repos/STRd6/jquery-image_reader/commits{/sha}",
            "git_commits_url": "https://api.github.com/repos/STRd6/jquery-image_reader/git/commits{/sha}",
            "comments_url": "https://api.github.com/repos/STRd6/jquery-image_reader/comments{/number}",
            "issue_comment_url": "https://api.github.com/repos/STRd6/jquery-image_reader/issues/comments/{number}",
            "contents_url": "https://api.github.com/repos/STRd6/jquery-image_reader/contents/{+path}",
            "compare_url": "https://api.github.com/repos/STRd6/jquery-image_reader/compare/{base}...{head}",
            "merges_url": "https://api.github.com/repos/STRd6/jquery-image_reader/merges",
            "archive_url": "https://api.github.com/repos/STRd6/jquery-image_reader/{archive_format}{/ref}",
            "downloads_url": "https://api.github.com/repos/STRd6/jquery-image_reader/downloads",
            "issues_url": "https://api.github.com/repos/STRd6/jquery-image_reader/issues{/number}",
            "pulls_url": "https://api.github.com/repos/STRd6/jquery-image_reader/pulls{/number}",
            "milestones_url": "https://api.github.com/repos/STRd6/jquery-image_reader/milestones{/number}",
            "notifications_url": "https://api.github.com/repos/STRd6/jquery-image_reader/notifications{?since,all,participating}",
            "labels_url": "https://api.github.com/repos/STRd6/jquery-image_reader/labels{/name}",
            "created_at": "2012-06-02T07:12:27Z",
            "updated_at": "2013-08-29T08:31:21Z",
            "pushed_at": "2013-04-17T16:28:05Z",
            "git_url": "git://github.com/STRd6/jquery-image_reader.git",
            "ssh_url": "git@github.com:STRd6/jquery-image_reader.git",
            "clone_url": "https://github.com/STRd6/jquery-image_reader.git",
            "svn_url": "https://github.com/STRd6/jquery-image_reader",
            "homepage": null,
            "size": 160,
            "watchers_count": 4,
            "language": "JavaScript",
            "has_issues": true,
            "has_downloads": true,
            "has_wiki": true,
            "forks_count": 1,
            "mirror_url": null,
            "open_issues_count": 0,
            "forks": 1,
            "open_issues": 0,
            "watchers": 4,
            "master_branch": "master",
            "default_branch": "master",
            "permissions": {
              "admin": true,
              "push": true,
              "pull": true
            },
            "network_count": 1,
            "branch": "v0.1.3",
            "defaultBranch": "master"
          }
        }
      },
      "remoteDependencies": [
        "//code.jquery.com/jquery-1.10.1.min.js",
        "http://strd6.github.io/tempest/javascripts/envweb.js",
        "http://strd6.github.io/require/v0.2.2.js"
      ],
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "repository": {
        "id": 13183366,
        "name": "jquery-utils",
        "full_name": "STRd6/jquery-utils",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/jquery-utils",
        "description": "",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/jquery-utils",
        "forks_url": "https://api.github.com/repos/STRd6/jquery-utils/forks",
        "keys_url": "https://api.github.com/repos/STRd6/jquery-utils/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/jquery-utils/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/jquery-utils/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/jquery-utils/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/jquery-utils/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/jquery-utils/events",
        "assignees_url": "https://api.github.com/repos/STRd6/jquery-utils/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/jquery-utils/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/jquery-utils/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/jquery-utils/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/jquery-utils/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/jquery-utils/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/jquery-utils/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/jquery-utils/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/jquery-utils/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/jquery-utils/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/jquery-utils/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/jquery-utils/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/jquery-utils/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/jquery-utils/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/jquery-utils/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/jquery-utils/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/jquery-utils/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/jquery-utils/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/jquery-utils/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/jquery-utils/merges",
        "archive_url": "https://api.github.com/repos/STRd6/jquery-utils/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/jquery-utils/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/jquery-utils/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/jquery-utils/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/jquery-utils/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/jquery-utils/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/jquery-utils/labels{/name}",
        "created_at": "2013-09-29T00:25:09Z",
        "updated_at": "2013-10-25T00:40:45Z",
        "pushed_at": "2013-10-25T00:40:42Z",
        "git_url": "git://github.com/STRd6/jquery-utils.git",
        "ssh_url": "git@github.com:STRd6/jquery-utils.git",
        "clone_url": "https://github.com/STRd6/jquery-utils.git",
        "svn_url": "https://github.com/STRd6/jquery-utils",
        "homepage": null,
        "size": 376,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "master_branch": "master",
        "default_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "branch": "v0.1.2",
        "defaultBranch": "master"
      }
    },
    "runtime": {
      "version": "0.1.1",
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "runtime\n=======\n",
          "type": "blob"
        },
        "runtime.coffee.md": {
          "path": "runtime.coffee.md",
          "mode": "100644",
          "content": "The runtime holds utilities to assist with an apps running environment.\n\nIt should me moved into it's own component one day.\n\n    Runtime = (pkg) ->\n\nHold on to a reference to our root node.\n\n      root = null\n\nReturns the node that is the parent of the script element that contains the code\nthat calls this function. If `document.write` has been called before this then the\nresults may not be accurate. Therefore be sure to call currentNode before\nwriting anything to the document.\n\n      currentNode = ->\n        target = document.documentElement\n\n        while (target.childNodes.length and target.lastChild.nodeType == 1)\n          target = target.lastChild\n\n        return target.parentNode\n\nDisplay a promo in the console linking back to the creator of this app.\n\n      promo = ->\n        console.log(\"%c You should meet my creator #{pkg.progenitor.url}\", \"\"\"\n          background: #000;\n          color: white;\n          font-size: 2em;\n          line-height: 2em;\n          padding: 10px 100px;\n          margin-bottom: 1em;\n          text-shadow:\n            0 0 0.05em #fff,\n            0 0 0.1em #fff,\n            0 0 0.15em #fff,\n            0 0 0.2em #ff00de,\n            0 0 0.35em #ff00de,\n            0 0 0.4em #ff00de,\n            0 0 0.5em #ff00de,\n            0 0 0.75em #ff00de;'\n        \"\"\")\n\nCall on start to boot up the runtime, get the root node, add styles, display a\npromo.\n\n      boot: ->\n        root = currentNode()\n\n        promo()\n\n        return root\n\nApply the stylesheet to the root node.\n\n      applyStyleSheet: (style) ->\n        styleNode = document.createElement(\"style\")\n        styleNode.innerHTML = style\n\n        root.appendChild(styleNode)\n\nExport\n\n    module.exports = Runtime\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.1.1\"\nentryPoint: \"runtime\"\nremoteDependencies: [\n  \"http://strd6.github.io/require/v0.2.0.js\"\n]\n",
          "type": "blob"
        },
        "test/runtime.coffee": {
          "path": "test/runtime.coffee",
          "mode": "100644",
          "content": "Runtime = require \"../runtime\"\n\ndescribe \"Runtime\", ->\n  it \"should be created from a package and provide a boot method\", ->\n    assert Runtime(PACKAGE).boot\n",
          "type": "blob"
        }
      },
      "distribution": {
        "runtime": {
          "path": "runtime",
          "content": "(function() {\n  var Runtime;\n\n  Runtime = function(pkg) {\n    var currentNode, promo, root;\n    root = null;\n    currentNode = function() {\n      var target;\n      target = document.documentElement;\n      while (target.childNodes.length && target.lastChild.nodeType === 1) {\n        target = target.lastChild;\n      }\n      return target.parentNode;\n    };\n    promo = function() {\n      return console.log(\"%c You should meet my creator \" + pkg.progenitor.url, \"background: #000;\\ncolor: white;\\nfont-size: 2em;\\nline-height: 2em;\\npadding: 10px 100px;\\nmargin-bottom: 1em;\\ntext-shadow:\\n  0 0 0.05em #fff,\\n  0 0 0.1em #fff,\\n  0 0 0.15em #fff,\\n  0 0 0.2em #ff00de,\\n  0 0 0.35em #ff00de,\\n  0 0 0.4em #ff00de,\\n  0 0 0.5em #ff00de,\\n  0 0 0.75em #ff00de;'\");\n    };\n    return {\n      boot: function() {\n        root = currentNode();\n        promo();\n        return root;\n      },\n      applyStyleSheet: function(style) {\n        var styleNode;\n        styleNode = document.createElement(\"style\");\n        styleNode.innerHTML = style;\n        return root.appendChild(styleNode);\n      }\n    };\n  };\n\n  module.exports = Runtime;\n\n}).call(this);\n",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.1.1\",\"entryPoint\":\"runtime\",\"remoteDependencies\":[\"http://strd6.github.io/require/v0.2.0.js\"]};",
          "type": "blob"
        },
        "test/runtime": {
          "path": "test/runtime",
          "content": "(function() {\n  var Runtime;\n\n  Runtime = require(\"../runtime\");\n\n  describe(\"Runtime\", function() {\n    return it(\"should be created from a package and provide a boot method\", function() {\n      return assert(Runtime(PACKAGE).boot);\n    });\n  });\n\n}).call(this);\n",
          "type": "blob"
        }
      },
      "entryPoint": "runtime",
      "dependencies": {},
      "remoteDependencies": [
        "http://strd6.github.io/require/v0.2.0.js"
      ],
      "repository": {
        "id": 13202878,
        "name": "runtime",
        "full_name": "STRd6/runtime",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://0.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User"
        },
        "private": false,
        "html_url": "https://github.com/STRd6/runtime",
        "description": "",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/runtime",
        "forks_url": "https://api.github.com/repos/STRd6/runtime/forks",
        "keys_url": "https://api.github.com/repos/STRd6/runtime/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/runtime/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/runtime/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/runtime/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/runtime/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/runtime/events",
        "assignees_url": "https://api.github.com/repos/STRd6/runtime/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/runtime/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/runtime/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/runtime/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/runtime/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/runtime/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/runtime/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/runtime/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/runtime/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/runtime/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/runtime/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/runtime/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/runtime/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/runtime/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/runtime/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/runtime/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/runtime/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/runtime/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/runtime/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/runtime/merges",
        "archive_url": "https://api.github.com/repos/STRd6/runtime/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/runtime/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/runtime/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/runtime/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/runtime/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/runtime/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/runtime/labels{/name}",
        "created_at": "2013-09-30T00:44:37Z",
        "updated_at": "2013-09-30T00:44:37Z",
        "pushed_at": "2013-09-30T00:44:37Z",
        "git_url": "git://github.com/STRd6/runtime.git",
        "ssh_url": "git@github.com:STRd6/runtime.git",
        "clone_url": "https://github.com/STRd6/runtime.git",
        "svn_url": "https://github.com/STRd6/runtime",
        "homepage": null,
        "size": 0,
        "watchers_count": 0,
        "language": null,
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "master_branch": "master",
        "default_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "branch": "v0.1.1",
        "defaultBranch": "master",
        "includedModules": [
          "Bindable"
        ]
      },
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "name": "runtime"
    },
    "touch-canvas": {
      "version": "0.2.0",
      "source": {
        "LICENSE": {
          "path": "LICENSE",
          "mode": "100644",
          "content": "The MIT License (MIT)\n\nCopyright (c) 2013 Daniel X Moore\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of\nthis software and associated documentation files (the \"Software\"), to deal in\nthe Software without restriction, including without limitation the rights to\nuse, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of\nthe Software, and to permit persons to whom the Software is furnished to do so,\nsubject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS\nFOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR\nCOPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER\nIN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN\nCONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n",
          "type": "blob"
        },
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "touch-canvas\n============\n\nA canvas you can touch\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "entryPoint: \"touch_canvas\"\nversion: \"0.2.0\"\nremoteDependencies: [\n  \"//code.jquery.com/jquery-1.10.1.min.js\"\n  \"http://strd6.github.io/tempest/javascripts/envweb.js\"\n  \"http://strd6.github.io/require/v0.2.2.js\"\n]\ndependencies:\n  \"pixie-canvas\": \"STRd6/pixie-canvas:v0.8.1\"\n",
          "type": "blob"
        },
        "touch_canvas.coffee.md": {
          "path": "touch_canvas.coffee.md",
          "mode": "100644",
          "content": "Touch Canvas\n============\n\nA canvas element that reports mouse and touch events in the range [0, 1].\n\n    PixieCanvas = require \"pixie-canvas\"\n\nA number really close to 1. We should never actually return 1, but move events\nmay get a little fast and loose with exiting the canvas, so let's play it safe.\n\n    MAX = 0.999999999999\n\n    TouchCanvas = (I={}) ->\n      self = PixieCanvas I\n\n      Core(I, self)\n\n      self.include Bindable\n\n      element = self.element()\n\n      # Keep track of if the mouse is active in the element\n      active = false\n\nWhen we click within the canvas set the value for the position we clicked at.\n\n      $(element).on \"mousedown\", (e) ->\n        active = true\n\n        self.trigger \"touch\", localPosition(e)\n\nHandle touch starts\n\n      $(element).on \"touchstart\", (e) ->\n        # Global `event`\n        processTouches event, (touch) ->\n          self.trigger \"touch\", localPosition(touch)\n\nWhen the mouse moves apply a change for each x value in the intervening positions.\n\n      $(element).on \"mousemove\", (e) ->\n        if active\n          self.trigger \"move\", localPosition(e)\n\nHandle moves outside of the element.\n\n      $(document).on \"mousemove\", (e) ->\n        if active\n          self.trigger \"move\", localPosition(e)\n\nHandle touch moves.\n\n      $(element).on \"touchmove\", (e) ->\n        # Global `event`\n        processTouches event, (touch) ->\n          self.trigger \"move\", localPosition(touch)\n\nHandle releases.\n\n      $(element).on \"mouseup\", (e) ->\n        self.trigger \"release\", localPosition(e)\n        active = false\n\n        return\n\nHandle touch ends.\n\n      $(element).on \"touchend\", (e) ->\n        # Global `event`\n        processTouches event, (touch) ->\n          self.trigger \"release\", localPosition(touch)\n\nWhenever the mouse button is released from anywhere, deactivate. Be sure to\ntrigger the release event if the mousedown started within the element.\n\n      $(document).on \"mouseup\", (e) ->\n        if active\n          self.trigger \"release\", localPosition(e)\n\n        active = false\n\n        return\n\nHelpers\n-------\n\nProcess touches\n\n      processTouches = (event, fn) ->\n        event.preventDefault()\n\n        if event.type is \"touchend\"\n          # touchend doesn't have any touches, but does have changed touches\n          touches = event.changedTouches\n        else\n          touches = event.touches\n\n        self.debug? Array::map.call touches, ({identifier, pageX, pageY}) ->\n          \"[#{identifier}: #{pageX}, #{pageY} (#{event.type})]\\n\"\n\n        Array::forEach.call touches, fn\n\nLocal event position.\n\n      localPosition = (e) ->\n        $currentTarget = $(element)\n        offset = $currentTarget.offset()\n\n        width = $currentTarget.width()\n        height = $currentTarget.height()\n\n        point = Point(\n          ((e.pageX - offset.left) / width).clamp(0, MAX)\n          ((e.pageY - offset.top) / height).clamp(0, MAX)\n        )\n\n        # Add mouse into touch identifiers as 0\n        point.identifier = (e.identifier + 1) or 0\n\n        return point\n\nReturn self\n\n      return self\n\nExport\n\n    module.exports = TouchCanvas\n",
          "type": "blob"
        }
      },
      "distribution": {
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"entryPoint\":\"touch_canvas\",\"version\":\"0.2.0\",\"remoteDependencies\":[\"//code.jquery.com/jquery-1.10.1.min.js\",\"http://strd6.github.io/tempest/javascripts/envweb.js\",\"http://strd6.github.io/require/v0.2.2.js\"],\"dependencies\":{\"pixie-canvas\":\"STRd6/pixie-canvas:v0.8.1\"}};",
          "type": "blob"
        },
        "touch_canvas": {
          "path": "touch_canvas",
          "content": "(function() {\n  var MAX, PixieCanvas, TouchCanvas;\n\n  PixieCanvas = require(\"pixie-canvas\");\n\n  MAX = 0.999999999999;\n\n  TouchCanvas = function(I) {\n    var active, element, localPosition, processTouches, self;\n    if (I == null) {\n      I = {};\n    }\n    self = PixieCanvas(I);\n    Core(I, self);\n    self.include(Bindable);\n    element = self.element();\n    active = false;\n    $(element).on(\"mousedown\", function(e) {\n      active = true;\n      return self.trigger(\"touch\", localPosition(e));\n    });\n    $(element).on(\"touchstart\", function(e) {\n      return processTouches(event, function(touch) {\n        return self.trigger(\"touch\", localPosition(touch));\n      });\n    });\n    $(element).on(\"mousemove\", function(e) {\n      if (active) {\n        return self.trigger(\"move\", localPosition(e));\n      }\n    });\n    $(document).on(\"mousemove\", function(e) {\n      if (active) {\n        return self.trigger(\"move\", localPosition(e));\n      }\n    });\n    $(element).on(\"touchmove\", function(e) {\n      return processTouches(event, function(touch) {\n        return self.trigger(\"move\", localPosition(touch));\n      });\n    });\n    $(element).on(\"mouseup\", function(e) {\n      self.trigger(\"release\", localPosition(e));\n      active = false;\n    });\n    $(element).on(\"touchend\", function(e) {\n      return processTouches(event, function(touch) {\n        return self.trigger(\"release\", localPosition(touch));\n      });\n    });\n    $(document).on(\"mouseup\", function(e) {\n      if (active) {\n        self.trigger(\"release\", localPosition(e));\n      }\n      active = false;\n    });\n    processTouches = function(event, fn) {\n      var touches;\n      event.preventDefault();\n      if (event.type === \"touchend\") {\n        touches = event.changedTouches;\n      } else {\n        touches = event.touches;\n      }\n      if (typeof self.debug === \"function\") {\n        self.debug(Array.prototype.map.call(touches, function(_arg) {\n          var identifier, pageX, pageY;\n          identifier = _arg.identifier, pageX = _arg.pageX, pageY = _arg.pageY;\n          return \"[\" + identifier + \": \" + pageX + \", \" + pageY + \" (\" + event.type + \")]\\n\";\n        }));\n      }\n      return Array.prototype.forEach.call(touches, fn);\n    };\n    localPosition = function(e) {\n      var $currentTarget, height, offset, point, width;\n      $currentTarget = $(element);\n      offset = $currentTarget.offset();\n      width = $currentTarget.width();\n      height = $currentTarget.height();\n      point = Point(((e.pageX - offset.left) / width).clamp(0, MAX), ((e.pageY - offset.top) / height).clamp(0, MAX));\n      point.identifier = (e.identifier + 1) || 0;\n      return point;\n    };\n    return self;\n  };\n\n  module.exports = TouchCanvas;\n\n}).call(this);\n\n//# sourceURL=touch_canvas.coffee",
          "type": "blob"
        }
      },
      "entryPoint": "touch_canvas",
      "dependencies": {
        "pixie-canvas": {
          "version": "0.8.1",
          "source": {
            "pixie.cson": {
              "path": "pixie.cson",
              "mode": "100644",
              "content": "entryPoint: \"pixie_canvas\"\nversion: \"0.8.1\"\nremoteDependencies: [\n  \"http://strd6.github.io/require/v0.2.1.js\"\n]\n",
              "type": "blob"
            },
            "pixie_canvas.coffee.md": {
              "path": "pixie_canvas.coffee.md",
              "mode": "100644",
              "content": "Pixie Canvas\n============\n\nPixieCanvas provides a convenient wrapper for working with Context2d.\n\nMethods try to be as flexible as possible as to what arguments they take.\n\nNon-getter methods return `this` for method chaining.\n\n    TAU = 2 * Math.PI\n\n    module.exports = (options={}) ->\n        defaults options,\n          width: 400\n          height: 400\n          init: ->\n\n        canvas = document.createElement \"canvas\"\n        canvas.width = options.width\n        canvas.height = options.height\n\n        context = undefined\n\n        self =\n\n`clear` clears the entire canvas (or a portion of it).\n\nTo clear the entire canvas use `canvas.clear()`\n\n>     #! paint\n>     # Set up: Fill canvas with blue\n>     canvas.fill(\"blue\")\n>\n>     # Clear a portion of the canvas\n>     canvas.clear\n>       x: 50\n>       y: 50\n>       width: 50\n>       height: 50\n\n          clear: ({x, y, width, height}={}) ->\n            x ?= 0\n            y ?= 0\n            width = canvas.width unless width?\n            height = canvas.height unless height?\n\n            context.clearRect(x, y, width, height)\n\n            return this\n\nFills the entire canvas (or a specified section of it) with\nthe given color.\n\n>     #! paint\n>     # Paint the town (entire canvas) red\n>     canvas.fill \"red\"\n>\n>     # Fill a section of the canvas white (#FFF)\n>     canvas.fill\n>       x: 50\n>       y: 50\n>       width: 50\n>       height: 50\n>       color: \"#FFF\"\n\n          fill: (color={}) ->\n            unless (typeof color is \"string\") or color.channels\n              {x, y, width, height, bounds, color} = color\n\n            {x, y, width, height} = bounds if bounds\n\n            x ||= 0\n            y ||= 0\n            width = canvas.width unless width?\n            height = canvas.height unless height?\n\n            @fillColor(color)\n            context.fillRect(x, y, width, height)\n\n            return this\n\nA direct map to the Context2d draw image. `GameObject`s\nthat implement drawable will have this wrapped up nicely,\nso there is a good chance that you will not have to deal with\nit directly.\n\n>     #! paint\n>     $ \"<img>\",\n>       src: \"https://secure.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045\"\n>       load: ->\n>         canvas.drawImage(this, 25, 25)\n\n          drawImage: (args...) ->\n            context.drawImage(args...)\n\n            return this\n\nDraws a circle at the specified position with the specified\nradius and color.\n\n>     #! paint\n>     # Draw a large orange circle\n>     canvas.drawCircle\n>       radius: 30\n>       position: Point(100, 75)\n>       color: \"orange\"\n>\n>     # You may also set a stroke\n>     canvas.drawCircle\n>       x: 25\n>       y: 50\n>       radius: 10\n>       color: \"blue\"\n>       stroke:\n>         color: \"red\"\n>         width: 1\n\nYou can pass in circle objects as well.\n\n>     #! paint\n>     # Create a circle object to set up the next examples\n>     circle =\n>       radius: 20\n>       x: 50\n>       y: 50\n>\n>     # Draw a given circle in yellow\n>     canvas.drawCircle\n>       circle: circle\n>       color: \"yellow\"\n>\n>     # Draw the circle in green at a different position\n>     canvas.drawCircle\n>       circle: circle\n>       position: Point(25, 75)\n>       color: \"green\"\n\nYou may set a stroke, or even pass in only a stroke to draw an unfilled circle.\n\n>     #! paint\n>     # Draw an outline circle in purple.\n>     canvas.drawCircle\n>       x: 50\n>       y: 75\n>       radius: 10\n>       stroke:\n>         color: \"purple\"\n>         width: 2\n>\n\n          drawCircle: ({x, y, radius, position, color, stroke, circle}) ->\n            {x, y, radius} = circle if circle\n            {x, y} = position if position\n\n            radius = 0 if radius < 0\n\n            context.beginPath()\n            context.arc(x, y, radius, 0, TAU, true)\n            context.closePath()\n\n            if color\n              @fillColor(color)\n              context.fill()\n\n            if stroke\n              @strokeColor(stroke.color)\n              @lineWidth(stroke.width)\n              context.stroke()\n\n            return this\n\nDraws a rectangle at the specified position with given\nwidth and height. Optionally takes a position, bounds\nand color argument.\n\n\n          drawRect: ({x, y, width, height, position, bounds, color, stroke}) ->\n            {x, y, width, height} = bounds if bounds\n            {x, y} = position if position\n\n            if color\n              @fillColor(color)\n              context.fillRect(x, y, width, height)\n\n            if stroke\n              @strokeColor(stroke.color)\n              @lineWidth(stroke.width)\n              context.strokeRect(x, y, width, height)\n\n            return @\n\n>     #! paint\n>     # Draw a red rectangle using x, y, width and height\n>     canvas.drawRect\n>       x: 50\n>       y: 50\n>       width: 50\n>       height: 50\n>       color: \"#F00\"\n\n----\n\nYou can mix and match position, witdth and height.\n\n>     #! paint\n>     canvas.drawRect\n>       position: Point(0, 0)\n>       width: 50\n>       height: 50\n>       color: \"blue\"\n>       stroke:\n>         color: \"orange\"\n>         width: 3\n\n----\n\nA bounds can be reused to draw multiple rectangles.\n\n>     #! paint\n>     bounds =\n>       x: 100\n>       y: 0\n>       width: 100\n>       height: 100\n>\n>     # Draw a purple rectangle using bounds\n>     canvas.drawRect\n>       bounds: bounds\n>       color: \"green\"\n>\n>     # Draw the outline of the same bounds, but at a different position\n>     canvas.drawRect\n>       bounds: bounds\n>       position: Point(0, 50)\n>       stroke:\n>         color: \"purple\"\n>         width: 2\n\n----\n\nDraw a line from `start` to `end`.\n\n>     #! paint\n>     # Draw a sweet diagonal\n>     canvas.drawLine\n>       start: Point(0, 0)\n>       end: Point(200, 200)\n>       color: \"purple\"\n>\n>     # Draw another sweet diagonal\n>     canvas.drawLine\n>       start: Point(200, 0)\n>       end: Point(0, 200)\n>       color: \"red\"\n>       width: 6\n>\n>     # Now draw a sweet horizontal with a direction and a length\n>     canvas.drawLine\n>       start: Point(0, 100)\n>       length: 200\n>       direction: Point(1, 0)\n>       color: \"orange\"\n\n          drawLine: ({start, end, width, color, direction, length}) ->\n            width ||= 3\n\n            if direction\n              end = direction.norm(length).add(start)\n\n            @lineWidth(width)\n            @strokeColor(color)\n\n            context.beginPath()\n            context.moveTo(start.x, start.y)\n            context.lineTo(end.x, end.y)\n            context.closePath()\n            context.stroke()\n\n            return this\n\nDraw a polygon.\n\n>     #! paint\n>     # Draw a sweet rhombus\n>     canvas.drawPoly\n>       points: [\n>         Point(50, 25)\n>         Point(75, 50)\n>         Point(50, 75)\n>         Point(25, 50)\n>       ]\n>       color: \"purple\"\n>       stroke:\n>         color: \"red\"\n>         width: 2\n\n          drawPoly: ({points, color, stroke}) ->\n            context.beginPath()\n            points.forEach (point, i) ->\n              if i == 0\n                context.moveTo(point.x, point.y)\n              else\n                context.lineTo(point.x, point.y)\n            context.lineTo points[0].x, points[0].y\n\n            if color\n              @fillColor(color)\n              context.fill()\n\n            if stroke\n              @strokeColor(stroke.color)\n              @lineWidth(stroke.width)\n              context.stroke()\n\n            return @\n\nDraw a rounded rectangle.\n\nAdapted from http://js-bits.blogspot.com/2010/07/canvas-rounded-corner-rectangles.html\n\n>     #! paint\n>     # Draw a purple rounded rectangle with a red outline\n>     canvas.drawRoundRect\n>       position: Point(25, 25)\n>       radius: 10\n>       width: 150\n>       height: 100\n>       color: \"purple\"\n>       stroke:\n>         color: \"red\"\n>         width: 2\n\n          drawRoundRect: ({x, y, width, height, radius, position, bounds, color, stroke}) ->\n            radius = 5 unless radius?\n\n            {x, y, width, height} = bounds if bounds\n            {x, y} = position if position\n\n            context.beginPath()\n            context.moveTo(x + radius, y)\n            context.lineTo(x + width - radius, y)\n            context.quadraticCurveTo(x + width, y, x + width, y + radius)\n            context.lineTo(x + width, y + height - radius)\n            context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)\n            context.lineTo(x + radius, y + height)\n            context.quadraticCurveTo(x, y + height, x, y + height - radius)\n            context.lineTo(x, y + radius)\n            context.quadraticCurveTo(x, y, x + radius, y)\n            context.closePath()\n\n            if color\n              @fillColor(color)\n              context.fill()\n\n            if stroke\n              @lineWidth(stroke.width)\n              @strokeColor(stroke.color)\n              context.stroke()\n\n            return this\n\nDraws text on the canvas at the given position, in the given color.\nIf no color is given then the previous fill color is used.\n\n>     #! paint\n>     # Fill canvas to indicate bounds\n>     canvas.fill\n>       color: '#eee'\n>\n>     # A line to indicate the baseline\n>     canvas.drawLine\n>       start: Point(25, 50)\n>       end: Point(125, 50)\n>       color: \"#333\"\n>       width: 1\n>\n>     # Draw some text, note the position of the baseline\n>     canvas.drawText\n>       position: Point(25, 50)\n>       color: \"red\"\n>       text: \"It's dangerous to go alone\"\n\n\n          drawText: ({x, y, text, position, color, font}) ->\n            {x, y} = position if position\n\n            @fillColor(color)\n            @font(font) if font\n            context.fillText(text, x, y)\n\n            return this\n\nCenters the given text on the canvas at the given y position. An x position\nor point position can also be given in which case the text is centered at the\nx, y or position value specified.\n\n>     #! paint\n>     # Fill canvas to indicate bounds\n>     canvas.fill\n>       color: \"#eee\"\n>\n>     # Center text on the screen at y value 25\n>     canvas.centerText\n>       y: 25\n>       color: \"red\"\n>       text: \"It's dangerous to go alone\"\n>\n>     # Center text at point (75, 75)\n>     canvas.centerText\n>       position: Point(75, 75)\n>       color: \"green\"\n>       text: \"take this\"\n\n          centerText: ({text, x, y, position, color, font}) ->\n            {x, y} = position if position\n\n            x = canvas.width / 2 unless x?\n\n            textWidth = @measureText(text)\n\n            @drawText {\n              text\n              color\n              font\n              x: x - (textWidth) / 2\n              y\n            }\n\nSetting the fill color:\n\n`canvas.fillColor(\"#FF0000\")`\n\nPassing no arguments returns the fillColor:\n\n`canvas.fillColor() # => \"#FF000000\"`\n\nYou can also pass a Color object:\n\n`canvas.fillColor(Color('sky blue'))`\n\n          fillColor: (color) ->\n            if color\n              if color.channels\n                context.fillStyle = color.toString()\n              else\n                context.fillStyle = color\n\n              return @\n            else\n              return context.fillStyle\n\nSetting the stroke color:\n\n`canvas.strokeColor(\"#FF0000\")`\n\nPassing no arguments returns the strokeColor:\n\n`canvas.strokeColor() # => \"#FF0000\"`\n\nYou can also pass a Color object:\n\n`canvas.strokeColor(Color('sky blue'))`\n\n          strokeColor: (color) ->\n            if color\n              if color.channels\n                context.strokeStyle = color.toString()\n              else\n                context.strokeStyle = color\n\n              return this\n            else\n              return context.strokeStyle\n\nDetermine how wide some text is.\n\n`canvas.measureText('Hello World!') # => 55`\n\nIt may have accuracy issues depending on the font used.\n\n          measureText: (text) ->\n            context.measureText(text).width\n\nPasses this canvas to the block with the given matrix transformation\napplied. All drawing methods called within the block will draw\ninto the canvas with the transformation applied. The transformation\nis removed at the end of the block, even if the block throws an error.\n\n          withTransform: (matrix, block) ->\n            context.save()\n\n            context.transform(\n              matrix.a,\n              matrix.b,\n              matrix.c,\n              matrix.d,\n              matrix.tx,\n              matrix.ty\n            )\n\n            try\n              block(this)\n            finally\n              context.restore()\n\n            return this\n\nStraight proxy to context `putImageData` method.\n\n          putImageData: (args...) ->\n            context.putImageData(args...)\n\n            return this\n\nContext getter.\n\n          context: ->\n            context\n\nGetter for the actual html canvas element.\n\n          element: ->\n            canvas\n\nStraight proxy to context pattern creation.\n\n          createPattern: (image, repitition) ->\n            context.createPattern(image, repitition)\n\nSet a clip rectangle.\n\n          clip: (x, y, width, height) ->\n            context.beginPath()\n            context.rect(x, y, width, height)\n            context.clip()\n\n            return this\n\nGenerate accessors that get properties from the context object.\n\n        contextAttrAccessor = (attrs...) ->\n          attrs.forEach (attr) ->\n            self[attr] = (newVal) ->\n              if newVal?\n                context[attr] = newVal\n                return @\n              else\n                context[attr]\n\n        contextAttrAccessor(\n          \"font\",\n          \"globalAlpha\",\n          \"globalCompositeOperation\",\n          \"lineWidth\",\n          \"textAlign\",\n        )\n\nGenerate accessors that get properties from the canvas object.\n\n        canvasAttrAccessor = (attrs...) ->\n          attrs.forEach (attr) ->\n            self[attr] = (newVal) ->\n              if newVal?\n                canvas[attr] = newVal\n                return @\n              else\n                canvas[attr]\n\n        canvasAttrAccessor(\n          \"height\",\n          \"width\",\n        )\n\n        context = canvas.getContext('2d')\n\n        options.init(self)\n\n        return self\n\nDepend on either jQuery or Zepto for now (TODO: Don't depend on either)\n\nHelpers\n-------\n\nFill in default properties for an object, setting them only if they are not\nalready present.\n\n    defaults = (target, objects...) ->\n      for object in objects\n        for name of object\n          unless target.hasOwnProperty(name)\n            target[name] = object[name]\n\n      return target\n\nInteractive Examples\n--------------------\n\n>     #! setup\n>     Canvas = require \"/pixie_canvas\"\n>\n>     window.Point ?= (x, y) ->\n>       x: x\n>       y: y\n>\n>     Interactive.register \"paint\", ({source, runtimeElement}) ->\n>       canvas = Canvas\n>         width: 400\n>         height: 200\n>\n>       code = CoffeeScript.compile(source)\n>\n>       runtimeElement.empty().append canvas.element()\n>       Function(\"canvas\", code)(canvas)\n",
              "type": "blob"
            },
            "test/test.coffee": {
              "path": "test/test.coffee",
              "mode": "100644",
              "content": "Canvas = require \"../pixie_canvas\"\n\ndescribe \"pixie canvas\", ->\n  it \"Should create a canvas\", ->\n    canvas = Canvas\n      width: 400\n      height: 150\n\n    assert canvas\n    \n    assert canvas.width() is 400\n",
              "type": "blob"
            }
          },
          "distribution": {
            "pixie": {
              "path": "pixie",
              "content": "module.exports = {\"entryPoint\":\"pixie_canvas\",\"version\":\"0.8.1\",\"remoteDependencies\":[\"http://strd6.github.io/require/v0.2.1.js\"]};",
              "type": "blob"
            },
            "pixie_canvas": {
              "path": "pixie_canvas",
              "content": "(function() {\n  var TAU, defaults,\n    __slice = [].slice;\n\n  TAU = 2 * Math.PI;\n\n  module.exports = function(options) {\n    var canvas, canvasAttrAccessor, context, contextAttrAccessor, self;\n    if (options == null) {\n      options = {};\n    }\n    defaults(options, {\n      width: 400,\n      height: 400,\n      init: function() {}\n    });\n    canvas = document.createElement(\"canvas\");\n    canvas.width = options.width;\n    canvas.height = options.height;\n    context = void 0;\n    self = {\n      clear: function(_arg) {\n        var height, width, x, y, _ref;\n        _ref = _arg != null ? _arg : {}, x = _ref.x, y = _ref.y, width = _ref.width, height = _ref.height;\n        if (x == null) {\n          x = 0;\n        }\n        if (y == null) {\n          y = 0;\n        }\n        if (width == null) {\n          width = canvas.width;\n        }\n        if (height == null) {\n          height = canvas.height;\n        }\n        context.clearRect(x, y, width, height);\n        return this;\n      },\n      fill: function(color) {\n        var bounds, height, width, x, y, _ref;\n        if (color == null) {\n          color = {};\n        }\n        if (!((typeof color === \"string\") || color.channels)) {\n          _ref = color, x = _ref.x, y = _ref.y, width = _ref.width, height = _ref.height, bounds = _ref.bounds, color = _ref.color;\n        }\n        if (bounds) {\n          x = bounds.x, y = bounds.y, width = bounds.width, height = bounds.height;\n        }\n        x || (x = 0);\n        y || (y = 0);\n        if (width == null) {\n          width = canvas.width;\n        }\n        if (height == null) {\n          height = canvas.height;\n        }\n        this.fillColor(color);\n        context.fillRect(x, y, width, height);\n        return this;\n      },\n      drawImage: function() {\n        var args;\n        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];\n        context.drawImage.apply(context, args);\n        return this;\n      },\n      drawCircle: function(_arg) {\n        var circle, color, position, radius, stroke, x, y;\n        x = _arg.x, y = _arg.y, radius = _arg.radius, position = _arg.position, color = _arg.color, stroke = _arg.stroke, circle = _arg.circle;\n        if (circle) {\n          x = circle.x, y = circle.y, radius = circle.radius;\n        }\n        if (position) {\n          x = position.x, y = position.y;\n        }\n        if (radius < 0) {\n          radius = 0;\n        }\n        context.beginPath();\n        context.arc(x, y, radius, 0, TAU, true);\n        context.closePath();\n        if (color) {\n          this.fillColor(color);\n          context.fill();\n        }\n        if (stroke) {\n          this.strokeColor(stroke.color);\n          this.lineWidth(stroke.width);\n          context.stroke();\n        }\n        return this;\n      },\n      drawRect: function(_arg) {\n        var bounds, color, height, position, stroke, width, x, y;\n        x = _arg.x, y = _arg.y, width = _arg.width, height = _arg.height, position = _arg.position, bounds = _arg.bounds, color = _arg.color, stroke = _arg.stroke;\n        if (bounds) {\n          x = bounds.x, y = bounds.y, width = bounds.width, height = bounds.height;\n        }\n        if (position) {\n          x = position.x, y = position.y;\n        }\n        if (color) {\n          this.fillColor(color);\n          context.fillRect(x, y, width, height);\n        }\n        if (stroke) {\n          this.strokeColor(stroke.color);\n          this.lineWidth(stroke.width);\n          context.strokeRect(x, y, width, height);\n        }\n        return this;\n      },\n      drawLine: function(_arg) {\n        var color, direction, end, length, start, width;\n        start = _arg.start, end = _arg.end, width = _arg.width, color = _arg.color, direction = _arg.direction, length = _arg.length;\n        width || (width = 3);\n        if (direction) {\n          end = direction.norm(length).add(start);\n        }\n        this.lineWidth(width);\n        this.strokeColor(color);\n        context.beginPath();\n        context.moveTo(start.x, start.y);\n        context.lineTo(end.x, end.y);\n        context.closePath();\n        context.stroke();\n        return this;\n      },\n      drawPoly: function(_arg) {\n        var color, points, stroke;\n        points = _arg.points, color = _arg.color, stroke = _arg.stroke;\n        context.beginPath();\n        points.forEach(function(point, i) {\n          if (i === 0) {\n            return context.moveTo(point.x, point.y);\n          } else {\n            return context.lineTo(point.x, point.y);\n          }\n        });\n        context.lineTo(points[0].x, points[0].y);\n        if (color) {\n          this.fillColor(color);\n          context.fill();\n        }\n        if (stroke) {\n          this.strokeColor(stroke.color);\n          this.lineWidth(stroke.width);\n          context.stroke();\n        }\n        return this;\n      },\n      drawRoundRect: function(_arg) {\n        var bounds, color, height, position, radius, stroke, width, x, y;\n        x = _arg.x, y = _arg.y, width = _arg.width, height = _arg.height, radius = _arg.radius, position = _arg.position, bounds = _arg.bounds, color = _arg.color, stroke = _arg.stroke;\n        if (radius == null) {\n          radius = 5;\n        }\n        if (bounds) {\n          x = bounds.x, y = bounds.y, width = bounds.width, height = bounds.height;\n        }\n        if (position) {\n          x = position.x, y = position.y;\n        }\n        context.beginPath();\n        context.moveTo(x + radius, y);\n        context.lineTo(x + width - radius, y);\n        context.quadraticCurveTo(x + width, y, x + width, y + radius);\n        context.lineTo(x + width, y + height - radius);\n        context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);\n        context.lineTo(x + radius, y + height);\n        context.quadraticCurveTo(x, y + height, x, y + height - radius);\n        context.lineTo(x, y + radius);\n        context.quadraticCurveTo(x, y, x + radius, y);\n        context.closePath();\n        if (color) {\n          this.fillColor(color);\n          context.fill();\n        }\n        if (stroke) {\n          this.lineWidth(stroke.width);\n          this.strokeColor(stroke.color);\n          context.stroke();\n        }\n        return this;\n      },\n      drawText: function(_arg) {\n        var color, font, position, text, x, y;\n        x = _arg.x, y = _arg.y, text = _arg.text, position = _arg.position, color = _arg.color, font = _arg.font;\n        if (position) {\n          x = position.x, y = position.y;\n        }\n        this.fillColor(color);\n        if (font) {\n          this.font(font);\n        }\n        context.fillText(text, x, y);\n        return this;\n      },\n      centerText: function(_arg) {\n        var color, font, position, text, textWidth, x, y;\n        text = _arg.text, x = _arg.x, y = _arg.y, position = _arg.position, color = _arg.color, font = _arg.font;\n        if (position) {\n          x = position.x, y = position.y;\n        }\n        if (x == null) {\n          x = canvas.width / 2;\n        }\n        textWidth = this.measureText(text);\n        return this.drawText({\n          text: text,\n          color: color,\n          font: font,\n          x: x - textWidth / 2,\n          y: y\n        });\n      },\n      fillColor: function(color) {\n        if (color) {\n          if (color.channels) {\n            context.fillStyle = color.toString();\n          } else {\n            context.fillStyle = color;\n          }\n          return this;\n        } else {\n          return context.fillStyle;\n        }\n      },\n      strokeColor: function(color) {\n        if (color) {\n          if (color.channels) {\n            context.strokeStyle = color.toString();\n          } else {\n            context.strokeStyle = color;\n          }\n          return this;\n        } else {\n          return context.strokeStyle;\n        }\n      },\n      measureText: function(text) {\n        return context.measureText(text).width;\n      },\n      withTransform: function(matrix, block) {\n        context.save();\n        context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty);\n        try {\n          block(this);\n        } finally {\n          context.restore();\n        }\n        return this;\n      },\n      putImageData: function() {\n        var args;\n        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];\n        context.putImageData.apply(context, args);\n        return this;\n      },\n      context: function() {\n        return context;\n      },\n      element: function() {\n        return canvas;\n      },\n      createPattern: function(image, repitition) {\n        return context.createPattern(image, repitition);\n      },\n      clip: function(x, y, width, height) {\n        context.beginPath();\n        context.rect(x, y, width, height);\n        context.clip();\n        return this;\n      }\n    };\n    contextAttrAccessor = function() {\n      var attrs;\n      attrs = 1 <= arguments.length ? __slice.call(arguments, 0) : [];\n      return attrs.forEach(function(attr) {\n        return self[attr] = function(newVal) {\n          if (newVal != null) {\n            context[attr] = newVal;\n            return this;\n          } else {\n            return context[attr];\n          }\n        };\n      });\n    };\n    contextAttrAccessor(\"font\", \"globalAlpha\", \"globalCompositeOperation\", \"lineWidth\", \"textAlign\");\n    canvasAttrAccessor = function() {\n      var attrs;\n      attrs = 1 <= arguments.length ? __slice.call(arguments, 0) : [];\n      return attrs.forEach(function(attr) {\n        return self[attr] = function(newVal) {\n          if (newVal != null) {\n            canvas[attr] = newVal;\n            return this;\n          } else {\n            return canvas[attr];\n          }\n        };\n      });\n    };\n    canvasAttrAccessor(\"height\", \"width\");\n    context = canvas.getContext('2d');\n    options.init(self);\n    return self;\n  };\n\n  defaults = function() {\n    var name, object, objects, target, _i, _len;\n    target = arguments[0], objects = 2 <= arguments.length ? __slice.call(arguments, 1) : [];\n    for (_i = 0, _len = objects.length; _i < _len; _i++) {\n      object = objects[_i];\n      for (name in object) {\n        if (!target.hasOwnProperty(name)) {\n          target[name] = object[name];\n        }\n      }\n    }\n    return target;\n  };\n\n}).call(this);\n",
              "type": "blob"
            },
            "test/test": {
              "path": "test/test",
              "content": "(function() {\n  var Canvas;\n\n  Canvas = require(\"../pixie_canvas\");\n\n  describe(\"pixie canvas\", function() {\n    return it(\"Should create a canvas\", function() {\n      var canvas;\n      canvas = Canvas({\n        width: 400,\n        height: 150\n      });\n      assert(canvas);\n      return assert(canvas.width() === 400);\n    });\n  });\n\n}).call(this);\n",
              "type": "blob"
            }
          },
          "entryPoint": "pixie_canvas",
          "dependencies": {},
          "remoteDependencies": [
            "http://strd6.github.io/require/v0.2.1.js"
          ],
          "repository": {
            "id": 12096899,
            "name": "pixie-canvas",
            "full_name": "STRd6/pixie-canvas",
            "owner": {
              "login": "STRd6",
              "id": 18894,
              "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png",
              "gravatar_id": "33117162fff8a9cf50544a604f60c045",
              "url": "https://api.github.com/users/STRd6",
              "html_url": "https://github.com/STRd6",
              "followers_url": "https://api.github.com/users/STRd6/followers",
              "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
              "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
              "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
              "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
              "organizations_url": "https://api.github.com/users/STRd6/orgs",
              "repos_url": "https://api.github.com/users/STRd6/repos",
              "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
              "received_events_url": "https://api.github.com/users/STRd6/received_events",
              "type": "User"
            },
            "private": false,
            "html_url": "https://github.com/STRd6/pixie-canvas",
            "description": "A pretty ok HTML5 canvas wrapper",
            "fork": false,
            "url": "https://api.github.com/repos/STRd6/pixie-canvas",
            "forks_url": "https://api.github.com/repos/STRd6/pixie-canvas/forks",
            "keys_url": "https://api.github.com/repos/STRd6/pixie-canvas/keys{/key_id}",
            "collaborators_url": "https://api.github.com/repos/STRd6/pixie-canvas/collaborators{/collaborator}",
            "teams_url": "https://api.github.com/repos/STRd6/pixie-canvas/teams",
            "hooks_url": "https://api.github.com/repos/STRd6/pixie-canvas/hooks",
            "issue_events_url": "https://api.github.com/repos/STRd6/pixie-canvas/issues/events{/number}",
            "events_url": "https://api.github.com/repos/STRd6/pixie-canvas/events",
            "assignees_url": "https://api.github.com/repos/STRd6/pixie-canvas/assignees{/user}",
            "branches_url": "https://api.github.com/repos/STRd6/pixie-canvas/branches{/branch}",
            "tags_url": "https://api.github.com/repos/STRd6/pixie-canvas/tags",
            "blobs_url": "https://api.github.com/repos/STRd6/pixie-canvas/git/blobs{/sha}",
            "git_tags_url": "https://api.github.com/repos/STRd6/pixie-canvas/git/tags{/sha}",
            "git_refs_url": "https://api.github.com/repos/STRd6/pixie-canvas/git/refs{/sha}",
            "trees_url": "https://api.github.com/repos/STRd6/pixie-canvas/git/trees{/sha}",
            "statuses_url": "https://api.github.com/repos/STRd6/pixie-canvas/statuses/{sha}",
            "languages_url": "https://api.github.com/repos/STRd6/pixie-canvas/languages",
            "stargazers_url": "https://api.github.com/repos/STRd6/pixie-canvas/stargazers",
            "contributors_url": "https://api.github.com/repos/STRd6/pixie-canvas/contributors",
            "subscribers_url": "https://api.github.com/repos/STRd6/pixie-canvas/subscribers",
            "subscription_url": "https://api.github.com/repos/STRd6/pixie-canvas/subscription",
            "commits_url": "https://api.github.com/repos/STRd6/pixie-canvas/commits{/sha}",
            "git_commits_url": "https://api.github.com/repos/STRd6/pixie-canvas/git/commits{/sha}",
            "comments_url": "https://api.github.com/repos/STRd6/pixie-canvas/comments{/number}",
            "issue_comment_url": "https://api.github.com/repos/STRd6/pixie-canvas/issues/comments/{number}",
            "contents_url": "https://api.github.com/repos/STRd6/pixie-canvas/contents/{+path}",
            "compare_url": "https://api.github.com/repos/STRd6/pixie-canvas/compare/{base}...{head}",
            "merges_url": "https://api.github.com/repos/STRd6/pixie-canvas/merges",
            "archive_url": "https://api.github.com/repos/STRd6/pixie-canvas/{archive_format}{/ref}",
            "downloads_url": "https://api.github.com/repos/STRd6/pixie-canvas/downloads",
            "issues_url": "https://api.github.com/repos/STRd6/pixie-canvas/issues{/number}",
            "pulls_url": "https://api.github.com/repos/STRd6/pixie-canvas/pulls{/number}",
            "milestones_url": "https://api.github.com/repos/STRd6/pixie-canvas/milestones{/number}",
            "notifications_url": "https://api.github.com/repos/STRd6/pixie-canvas/notifications{?since,all,participating}",
            "labels_url": "https://api.github.com/repos/STRd6/pixie-canvas/labels{/name}",
            "created_at": "2013-08-14T01:15:34Z",
            "updated_at": "2013-10-01T17:16:30Z",
            "pushed_at": "2013-10-01T17:16:30Z",
            "git_url": "git://github.com/STRd6/pixie-canvas.git",
            "ssh_url": "git@github.com:STRd6/pixie-canvas.git",
            "clone_url": "https://github.com/STRd6/pixie-canvas.git",
            "svn_url": "https://github.com/STRd6/pixie-canvas",
            "homepage": null,
            "size": 1520,
            "watchers_count": 0,
            "language": "CoffeeScript",
            "has_issues": true,
            "has_downloads": true,
            "has_wiki": true,
            "forks_count": 0,
            "mirror_url": null,
            "open_issues_count": 2,
            "forks": 0,
            "open_issues": 2,
            "watchers": 0,
            "master_branch": "master",
            "default_branch": "master",
            "permissions": {
              "admin": true,
              "push": true,
              "pull": true
            },
            "network_count": 0,
            "branch": "v0.8.1",
            "defaultBranch": "master",
            "includedModules": [
              "Bindable"
            ]
          },
          "progenitor": {
            "url": "http://strd6.github.io/editor/"
          }
        }
      },
      "remoteDependencies": [
        "//code.jquery.com/jquery-1.10.1.min.js",
        "http://strd6.github.io/tempest/javascripts/envweb.js",
        "http://strd6.github.io/require/v0.2.2.js"
      ],
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "repository": {
        "id": 13783983,
        "name": "touch-canvas",
        "full_name": "STRd6/touch-canvas",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/touch-canvas",
        "description": "A canvas you can touch",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/touch-canvas",
        "forks_url": "https://api.github.com/repos/STRd6/touch-canvas/forks",
        "keys_url": "https://api.github.com/repos/STRd6/touch-canvas/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/touch-canvas/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/touch-canvas/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/touch-canvas/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/touch-canvas/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/touch-canvas/events",
        "assignees_url": "https://api.github.com/repos/STRd6/touch-canvas/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/touch-canvas/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/touch-canvas/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/touch-canvas/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/touch-canvas/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/touch-canvas/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/touch-canvas/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/touch-canvas/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/touch-canvas/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/touch-canvas/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/touch-canvas/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/touch-canvas/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/touch-canvas/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/touch-canvas/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/touch-canvas/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/touch-canvas/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/touch-canvas/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/touch-canvas/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/touch-canvas/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/touch-canvas/merges",
        "archive_url": "https://api.github.com/repos/STRd6/touch-canvas/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/touch-canvas/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/touch-canvas/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/touch-canvas/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/touch-canvas/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/touch-canvas/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/touch-canvas/labels{/name}",
        "created_at": "2013-10-22T19:46:48Z",
        "updated_at": "2013-10-27T19:12:55Z",
        "pushed_at": "2013-10-27T19:12:55Z",
        "git_url": "git://github.com/STRd6/touch-canvas.git",
        "ssh_url": "git@github.com:STRd6/touch-canvas.git",
        "clone_url": "https://github.com/STRd6/touch-canvas.git",
        "svn_url": "https://github.com/STRd6/touch-canvas",
        "homepage": null,
        "size": 948,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "master_branch": "master",
        "default_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "branch": "v0.2.0",
        "defaultBranch": "master"
      }
    },
    "commando": {
      "version": "0.9.0",
      "source": {
        "README.md": {
          "path": "README.md",
          "mode": "100644",
          "content": "",
          "type": "blob"
        },
        "main.coffee.md": {
          "path": "main.coffee.md",
          "mode": "100644",
          "content": "Command Stack\n=============\n\nA simple stack based implementation of executable and undoable commands.\n\n    CommandStack = ->\n      stack = []\n      index = 0\n\n      execute: (command) ->\n        stack[index] = command\n        command.execute()\n\n        # Be sure to blast obsolete redos\n        stack.length = index += 1\n\n      undo: ->\n        if @canUndo()\n          index -= 1\n\n          command = stack[index]\n          command.undo()\n\n          return command\n\n      redo: ->\n        if @canRedo()\n          command = stack[index]\n          command.execute()\n\n          index += 1\n\n          return command\n\n      current: ->\n        stack[index-1]\n\n      canUndo: ->\n        index > 0\n\n      canRedo: ->\n        stack[index]?\n\n    module.exports = CommandStack\n",
          "type": "blob"
        },
        "package.json": {
          "path": "package.json",
          "mode": "100644",
          "content": "{\n  \"name\": \"commando\",\n  \"version\": \"0.9.0\",\n  \"description\": \"Simple Command Pattern\",\n  \"devDependencies\": {\n    \"coffee-script\": \"~1.6.3\",\n    \"mocha\": \"~1.12.0\",\n    \"uglify-js\": \"~2.3.6\"\n  },\n  \"repository\": {\n    \"type\": \"git\",\n    \"url\": \"https://github.com/STRd6/commando.git\"\n  },\n  \"files\": [\n    \"dist\"\n  ],\n  \"main\": \"dist/commando.js\"\n}\n",
          "type": "blob"
        },
        "pixie.cson": {
          "path": "pixie.cson",
          "mode": "100644",
          "content": "version: \"0.9.0\"\nremoteDependencies: [\n  \"http://strd6.github.io/require/v0.2.2.js\"\n]\n",
          "type": "blob"
        },
        "test/command_stack.coffee": {
          "path": "test/command_stack.coffee",
          "mode": "100644",
          "content": "CommandStack = require \"../main\"\n\nok = assert\nequals = assert.equal\n\ndescribe \"CommandStack\", ->\n  it \"undo on an empty stack returns undefined\", ->\n    commandStack = CommandStack()\n  \n    equals commandStack.undo(), undefined\n  \n  it \"redo on an empty stack returns undefined\", ->\n    commandStack = CommandStack()\n  \n    equals commandStack.redo(), undefined\n  \n  it \"executes commands\", ->\n    command =\n      execute: ->\n        ok true, \"command executed\"\n  \n    commandStack = CommandStack()\n  \n    commandStack.execute command\n  \n  it \"can undo\", ->\n    command =\n      execute: ->\n      undo: ->\n        ok true, \"command executed\"\n  \n    commandStack = CommandStack()\n    commandStack.execute command\n  \n    commandStack.undo()\n  \n  it \"can redo\", ->\n    command =\n      execute: ->\n        ok true, \"command executed\"\n      undo: ->\n  \n    commandStack = CommandStack()\n    commandStack.execute command\n  \n    commandStack.undo()\n    commandStack.redo()\n  \n  it \"executes redone command once on redo\", ->\n    command =\n      execute: ->\n        ok true, \"command executed\"\n      undo: ->\n  \n    commandStack = CommandStack()\n    commandStack.execute command\n  \n    commandStack.undo()\n    commandStack.redo()\n  \n    equals commandStack.redo(), undefined\n    equals commandStack.redo(), undefined\n  \n  it \"command is returned when undone\", ->\n    command =\n      execute: ->\n      undo: ->\n  \n    commandStack = CommandStack()\n    commandStack.execute command\n  \n    equals commandStack.undo(), command, \"Undone command is returned\"\n  \n  it \"command is returned when redone\", ->\n    command =\n      execute: ->\n      undo: ->\n  \n    commandStack = CommandStack()\n    commandStack.execute command\n    commandStack.undo()\n  \n    equals commandStack.redo(), command, \"Redone command is returned\"\n  \n  it \"cannot redo an obsolete future\", ->\n    Command = ->\n      execute: ->\n      undo: ->\n  \n    commandStack = CommandStack()\n    commandStack.execute Command()\n    commandStack.execute Command()\n  \n    commandStack.undo()\n    commandStack.undo()\n  \n    equals commandStack.canRedo(), true\n  \n    commandStack.execute Command()\n  \n    equals commandStack.canRedo(), false\n",
          "type": "blob"
        }
      },
      "distribution": {
        "main": {
          "path": "main",
          "content": "(function() {\n  var CommandStack;\n\n  CommandStack = function() {\n    var index, stack;\n    stack = [];\n    index = 0;\n    return {\n      execute: function(command) {\n        stack[index] = command;\n        command.execute();\n        return stack.length = index += 1;\n      },\n      undo: function() {\n        var command;\n        if (this.canUndo()) {\n          index -= 1;\n          command = stack[index];\n          command.undo();\n          return command;\n        }\n      },\n      redo: function() {\n        var command;\n        if (this.canRedo()) {\n          command = stack[index];\n          command.execute();\n          index += 1;\n          return command;\n        }\n      },\n      current: function() {\n        return stack[index - 1];\n      },\n      canUndo: function() {\n        return index > 0;\n      },\n      canRedo: function() {\n        return stack[index] != null;\n      }\n    };\n  };\n\n  module.exports = CommandStack;\n\n}).call(this);\n\n//# sourceURL=main.coffee",
          "type": "blob"
        },
        "package": {
          "path": "package",
          "content": "module.exports = {\"name\":\"commando\",\"version\":\"0.9.0\",\"description\":\"Simple Command Pattern\",\"devDependencies\":{\"coffee-script\":\"~1.6.3\",\"mocha\":\"~1.12.0\",\"uglify-js\":\"~2.3.6\"},\"repository\":{\"type\":\"git\",\"url\":\"https://github.com/STRd6/commando.git\"},\"files\":[\"dist\"],\"main\":\"dist/commando.js\"};",
          "type": "blob"
        },
        "pixie": {
          "path": "pixie",
          "content": "module.exports = {\"version\":\"0.9.0\",\"remoteDependencies\":[\"http://strd6.github.io/require/v0.2.2.js\"]};",
          "type": "blob"
        },
        "test/command_stack": {
          "path": "test/command_stack",
          "content": "(function() {\n  var CommandStack, equals, ok;\n\n  CommandStack = require(\"../main\");\n\n  ok = assert;\n\n  equals = assert.equal;\n\n  describe(\"CommandStack\", function() {\n    it(\"undo on an empty stack returns undefined\", function() {\n      var commandStack;\n      commandStack = CommandStack();\n      return equals(commandStack.undo(), void 0);\n    });\n    it(\"redo on an empty stack returns undefined\", function() {\n      var commandStack;\n      commandStack = CommandStack();\n      return equals(commandStack.redo(), void 0);\n    });\n    it(\"executes commands\", function() {\n      var command, commandStack;\n      command = {\n        execute: function() {\n          return ok(true, \"command executed\");\n        }\n      };\n      commandStack = CommandStack();\n      return commandStack.execute(command);\n    });\n    it(\"can undo\", function() {\n      var command, commandStack;\n      command = {\n        execute: function() {},\n        undo: function() {\n          return ok(true, \"command executed\");\n        }\n      };\n      commandStack = CommandStack();\n      commandStack.execute(command);\n      return commandStack.undo();\n    });\n    it(\"can redo\", function() {\n      var command, commandStack;\n      command = {\n        execute: function() {\n          return ok(true, \"command executed\");\n        },\n        undo: function() {}\n      };\n      commandStack = CommandStack();\n      commandStack.execute(command);\n      commandStack.undo();\n      return commandStack.redo();\n    });\n    it(\"executes redone command once on redo\", function() {\n      var command, commandStack;\n      command = {\n        execute: function() {\n          return ok(true, \"command executed\");\n        },\n        undo: function() {}\n      };\n      commandStack = CommandStack();\n      commandStack.execute(command);\n      commandStack.undo();\n      commandStack.redo();\n      equals(commandStack.redo(), void 0);\n      return equals(commandStack.redo(), void 0);\n    });\n    it(\"command is returned when undone\", function() {\n      var command, commandStack;\n      command = {\n        execute: function() {},\n        undo: function() {}\n      };\n      commandStack = CommandStack();\n      commandStack.execute(command);\n      return equals(commandStack.undo(), command, \"Undone command is returned\");\n    });\n    it(\"command is returned when redone\", function() {\n      var command, commandStack;\n      command = {\n        execute: function() {},\n        undo: function() {}\n      };\n      commandStack = CommandStack();\n      commandStack.execute(command);\n      commandStack.undo();\n      return equals(commandStack.redo(), command, \"Redone command is returned\");\n    });\n    return it(\"cannot redo an obsolete future\", function() {\n      var Command, commandStack;\n      Command = function() {\n        return {\n          execute: function() {},\n          undo: function() {}\n        };\n      };\n      commandStack = CommandStack();\n      commandStack.execute(Command());\n      commandStack.execute(Command());\n      commandStack.undo();\n      commandStack.undo();\n      equals(commandStack.canRedo(), true);\n      commandStack.execute(Command());\n      return equals(commandStack.canRedo(), false);\n    });\n  });\n\n}).call(this);\n\n//# sourceURL=test/command_stack.coffee",
          "type": "blob"
        }
      },
      "entryPoint": "main",
      "dependencies": {},
      "remoteDependencies": [
        "http://strd6.github.io/require/v0.2.2.js"
      ],
      "progenitor": {
        "url": "http://strd6.github.io/editor/"
      },
      "repository": {
        "id": 11981428,
        "name": "commando",
        "full_name": "STRd6/commando",
        "owner": {
          "login": "STRd6",
          "id": 18894,
          "avatar_url": "https://2.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
          "gravatar_id": "33117162fff8a9cf50544a604f60c045",
          "url": "https://api.github.com/users/STRd6",
          "html_url": "https://github.com/STRd6",
          "followers_url": "https://api.github.com/users/STRd6/followers",
          "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
          "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
          "organizations_url": "https://api.github.com/users/STRd6/orgs",
          "repos_url": "https://api.github.com/users/STRd6/repos",
          "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
          "received_events_url": "https://api.github.com/users/STRd6/received_events",
          "type": "User",
          "site_admin": false
        },
        "private": false,
        "html_url": "https://github.com/STRd6/commando",
        "description": "A simple JS command pattern.",
        "fork": false,
        "url": "https://api.github.com/repos/STRd6/commando",
        "forks_url": "https://api.github.com/repos/STRd6/commando/forks",
        "keys_url": "https://api.github.com/repos/STRd6/commando/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/STRd6/commando/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/STRd6/commando/teams",
        "hooks_url": "https://api.github.com/repos/STRd6/commando/hooks",
        "issue_events_url": "https://api.github.com/repos/STRd6/commando/issues/events{/number}",
        "events_url": "https://api.github.com/repos/STRd6/commando/events",
        "assignees_url": "https://api.github.com/repos/STRd6/commando/assignees{/user}",
        "branches_url": "https://api.github.com/repos/STRd6/commando/branches{/branch}",
        "tags_url": "https://api.github.com/repos/STRd6/commando/tags",
        "blobs_url": "https://api.github.com/repos/STRd6/commando/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/STRd6/commando/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/STRd6/commando/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/STRd6/commando/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/STRd6/commando/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/STRd6/commando/languages",
        "stargazers_url": "https://api.github.com/repos/STRd6/commando/stargazers",
        "contributors_url": "https://api.github.com/repos/STRd6/commando/contributors",
        "subscribers_url": "https://api.github.com/repos/STRd6/commando/subscribers",
        "subscription_url": "https://api.github.com/repos/STRd6/commando/subscription",
        "commits_url": "https://api.github.com/repos/STRd6/commando/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/STRd6/commando/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/STRd6/commando/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/STRd6/commando/issues/comments/{number}",
        "contents_url": "https://api.github.com/repos/STRd6/commando/contents/{+path}",
        "compare_url": "https://api.github.com/repos/STRd6/commando/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/STRd6/commando/merges",
        "archive_url": "https://api.github.com/repos/STRd6/commando/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/STRd6/commando/downloads",
        "issues_url": "https://api.github.com/repos/STRd6/commando/issues{/number}",
        "pulls_url": "https://api.github.com/repos/STRd6/commando/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/STRd6/commando/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/STRd6/commando/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/STRd6/commando/labels{/name}",
        "created_at": "2013-08-08T16:51:40Z",
        "updated_at": "2013-09-29T21:08:02Z",
        "pushed_at": "2013-09-29T21:08:02Z",
        "git_url": "git://github.com/STRd6/commando.git",
        "ssh_url": "git@github.com:STRd6/commando.git",
        "clone_url": "https://github.com/STRd6/commando.git",
        "svn_url": "https://github.com/STRd6/commando",
        "homepage": null,
        "size": 192,
        "watchers_count": 0,
        "language": "CoffeeScript",
        "has_issues": true,
        "has_downloads": true,
        "has_wiki": true,
        "forks_count": 0,
        "mirror_url": null,
        "open_issues_count": 0,
        "forks": 0,
        "open_issues": 0,
        "watchers": 0,
        "master_branch": "master",
        "default_branch": "master",
        "permissions": {
          "admin": true,
          "push": true,
          "pull": true
        },
        "network_count": 0,
        "branch": "v0.9.0",
        "defaultBranch": "master"
      }
    }
  },
  "remoteDependencies": [
    "//code.jquery.com/jquery-1.10.1.min.js",
    "http://strd6.github.io/tempest/javascripts/envweb.js",
    "http://strd6.github.io/require/v0.2.2.js"
  ],
  "progenitor": {
    "url": "http://strd6.github.io/editor/"
  },
  "repository": {
    "id": 13182952,
    "name": "pixel-editor",
    "full_name": "STRd6/pixel-editor",
    "owner": {
      "login": "STRd6",
      "id": 18894,
      "avatar_url": "https://1.gravatar.com/avatar/33117162fff8a9cf50544a604f60c045?d=https%3A%2F%2Fidenticons.github.com%2F39df222bffe39629d904e4883eabc654.png&r=x",
      "gravatar_id": "33117162fff8a9cf50544a604f60c045",
      "url": "https://api.github.com/users/STRd6",
      "html_url": "https://github.com/STRd6",
      "followers_url": "https://api.github.com/users/STRd6/followers",
      "following_url": "https://api.github.com/users/STRd6/following{/other_user}",
      "gists_url": "https://api.github.com/users/STRd6/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/STRd6/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/STRd6/subscriptions",
      "organizations_url": "https://api.github.com/users/STRd6/orgs",
      "repos_url": "https://api.github.com/users/STRd6/repos",
      "events_url": "https://api.github.com/users/STRd6/events{/privacy}",
      "received_events_url": "https://api.github.com/users/STRd6/received_events",
      "type": "User",
      "site_admin": false
    },
    "private": false,
    "html_url": "https://github.com/STRd6/pixel-editor",
    "description": "It edits pixels",
    "fork": false,
    "url": "https://api.github.com/repos/STRd6/pixel-editor",
    "forks_url": "https://api.github.com/repos/STRd6/pixel-editor/forks",
    "keys_url": "https://api.github.com/repos/STRd6/pixel-editor/keys{/key_id}",
    "collaborators_url": "https://api.github.com/repos/STRd6/pixel-editor/collaborators{/collaborator}",
    "teams_url": "https://api.github.com/repos/STRd6/pixel-editor/teams",
    "hooks_url": "https://api.github.com/repos/STRd6/pixel-editor/hooks",
    "issue_events_url": "https://api.github.com/repos/STRd6/pixel-editor/issues/events{/number}",
    "events_url": "https://api.github.com/repos/STRd6/pixel-editor/events",
    "assignees_url": "https://api.github.com/repos/STRd6/pixel-editor/assignees{/user}",
    "branches_url": "https://api.github.com/repos/STRd6/pixel-editor/branches{/branch}",
    "tags_url": "https://api.github.com/repos/STRd6/pixel-editor/tags",
    "blobs_url": "https://api.github.com/repos/STRd6/pixel-editor/git/blobs{/sha}",
    "git_tags_url": "https://api.github.com/repos/STRd6/pixel-editor/git/tags{/sha}",
    "git_refs_url": "https://api.github.com/repos/STRd6/pixel-editor/git/refs{/sha}",
    "trees_url": "https://api.github.com/repos/STRd6/pixel-editor/git/trees{/sha}",
    "statuses_url": "https://api.github.com/repos/STRd6/pixel-editor/statuses/{sha}",
    "languages_url": "https://api.github.com/repos/STRd6/pixel-editor/languages",
    "stargazers_url": "https://api.github.com/repos/STRd6/pixel-editor/stargazers",
    "contributors_url": "https://api.github.com/repos/STRd6/pixel-editor/contributors",
    "subscribers_url": "https://api.github.com/repos/STRd6/pixel-editor/subscribers",
    "subscription_url": "https://api.github.com/repos/STRd6/pixel-editor/subscription",
    "commits_url": "https://api.github.com/repos/STRd6/pixel-editor/commits{/sha}",
    "git_commits_url": "https://api.github.com/repos/STRd6/pixel-editor/git/commits{/sha}",
    "comments_url": "https://api.github.com/repos/STRd6/pixel-editor/comments{/number}",
    "issue_comment_url": "https://api.github.com/repos/STRd6/pixel-editor/issues/comments/{number}",
    "contents_url": "https://api.github.com/repos/STRd6/pixel-editor/contents/{+path}",
    "compare_url": "https://api.github.com/repos/STRd6/pixel-editor/compare/{base}...{head}",
    "merges_url": "https://api.github.com/repos/STRd6/pixel-editor/merges",
    "archive_url": "https://api.github.com/repos/STRd6/pixel-editor/{archive_format}{/ref}",
    "downloads_url": "https://api.github.com/repos/STRd6/pixel-editor/downloads",
    "issues_url": "https://api.github.com/repos/STRd6/pixel-editor/issues{/number}",
    "pulls_url": "https://api.github.com/repos/STRd6/pixel-editor/pulls{/number}",
    "milestones_url": "https://api.github.com/repos/STRd6/pixel-editor/milestones{/number}",
    "notifications_url": "https://api.github.com/repos/STRd6/pixel-editor/notifications{?since,all,participating}",
    "labels_url": "https://api.github.com/repos/STRd6/pixel-editor/labels{/name}",
    "created_at": "2013-09-28T23:51:14Z",
    "updated_at": "2013-10-27T19:13:19Z",
    "pushed_at": "2013-10-27T19:13:19Z",
    "git_url": "git://github.com/STRd6/pixel-editor.git",
    "ssh_url": "git@github.com:STRd6/pixel-editor.git",
    "clone_url": "https://github.com/STRd6/pixel-editor.git",
    "svn_url": "https://github.com/STRd6/pixel-editor",
    "homepage": null,
    "size": 5108,
    "watchers_count": 0,
    "language": "CoffeeScript",
    "has_issues": true,
    "has_downloads": true,
    "has_wiki": true,
    "forks_count": 0,
    "mirror_url": null,
    "open_issues_count": 0,
    "forks": 0,
    "open_issues": 0,
    "watchers": 0,
    "master_branch": "master",
    "default_branch": "master",
    "permissions": {
      "admin": true,
      "push": true,
      "pull": true
    },
    "network_count": 0,
    "branch": "master",
    "defaultBranch": "master"
  }
});