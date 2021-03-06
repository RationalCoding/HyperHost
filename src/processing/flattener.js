/*
Copyright (c) 2016 Thomas Mullen. All rights reserved.
MIT License

Flattens the content tree into two arrays of views and assets.

The content tree has the following example structure:

[
    {
        name: 'folder',
        nodes : [
            {
                name : 'nested file',
                content : 'content of file here'
            }
        ]
    },
    {
        name : 'a file',
        content : 'some file content'
    }
]

*/

const util = require('../util/util.js'),
  config = require('../config/config.json')

function Flattener () {
  'use strict'

  let views,
    assets,
    startScript,
    virtualModules,
    jsonFiles,
    foundIndex

  const pushFile = function pushFile (path, item, isRoot) {
      const ext = util.nameToExtension(item.name)

        // Views must not be encoded!
      if (util.contains(config.extensions.view, ext)) {
        if (path + item.name === 'index.html') { // Find the root HTML page
          foundIndex = true
        }

        if (ext === 'json') {
          jsonFiles[path + item.name.split('.')[0]] = JSON.parse(item.content) // JSON files are reserved for the server. If you need them in client, use a virtual backend to serve them
        } else {
          views.push({
            content: item.content,
            path: path + item.name,
            extension: ext,
            isRoot: isRoot
          })
        }
      }

        // Should not be encoded initially, but we will encode them
      else if (util.contains(config.extensions.text, ext)) {
        const dataURI = item.dataURI || util.toDataURI(item.content, util.nameToExtension(item.name))

        if (item.name.substring(0, 3) === 'HH-') {
          if (item.name === 'HH-server.js') { // Virtual server start file
            startScript = dataURI
          } else { // Virtual server module
            const name = item.name.substring(3).slice(0, -3)
            virtualModules[name] = dataURI
          }
        } else {
          assets.push({
            old: path + item.name,
            new: dataURI,
            extension: ext,
            name: item.name,
            isFont: false
          })
        }
      }

        // Misc files should always be encoded
      else {
        const dataURI = item.dataURI || util.toDataURI(item.content, util.nameToExtension(item.name)),
          isFont = util.contains(config.extensions.image, ext) // Identify fonts

        assets.push({
          old: path + item.name,
          new: dataURI,
          extension: ext,
          name: item.name,
          isFont: isFont
        })
      }
    },

    // Traverses an item of unknown type in the content tree
    traverseFileTree = function traverseFileTree (item, path, depth, ancestors) {
      if (item.name[0] === '.' || item.isRemoved) return // Ignore hidden files

      if (!item.nodes) { // No child node array, must be a file
        pushFile(path, item, depth <= 1)
      } else {
            // Recursively traverse folder
        for (let i = 0; i < item.nodes.length; i++) {
          const newPath = path + item.name + '/',
            newAncestors = ancestors.slice(0)
          newAncestors.push(item.name)

          traverseFileTree(item.nodes[i], newPath, depth + 1, newAncestors)
        }
      }
    }

        /*
    Flattens a content tree and returns the result.

    Returns an object containing :
        an array of views,
        an array of assets,
        a virtual server start script (if one exists),
        a dictionary of virtual modules,
        a dictionary of json files.
    */
  this.flatten = function flatten (tree) {
        // Reset working variables
    views = []
    assets = []
    virtualModules = {}
    foundIndex = false
    jsonFiles = {
      package: {
        dependencies: {}
      }
    }

        // Iterate across root level of tree
    for (let i = 0; i < tree.length; i++) {
      traverseFileTree(tree[i], '', 0, [])
    }

    if (!foundIndex) {
      throw new Error('No index.html in root level of content tree.')
    }

    return {
      views,
      assets,
      startScript,
      virtualModules,
      jsonFiles
    }
  }
}

module.exports = Flattener
