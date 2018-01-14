const { series } = require('async');
const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const which = require('npm-which')(__dirname);
const { exec } = require('child_process');

const PLUGIN_NAME = 'remark-mermaid';

/**
 * Accepts the `source` of the graph as a string, and render an SVG using
 * mermaid.cli. Returns the path to the rendered SVG.
 *
 * @param  {string} source
 * @param  {string} destination
 * @return {string}
 */

function render(source, destination, asString, callback) {
  if (arguments.length === 3) callback = asString
  const unique = crypto.createHmac('sha1', PLUGIN_NAME).update(source).digest('hex');
  const mmdcExecutable = which.sync('mmdc');
  const mmdPath = path.join(destination, `${unique}.mmd`);
  const svgFilename = `${unique}.svg`;
  const svgPath = path.join(destination, svgFilename);

  series([
    // Write temporary file
    cb => fs.outputFile(mmdPath, source, cb),
    // Invoke mermaid.cli
    cb => exec(`${mmdcExecutable} -i ${mmdPath} -o ${svgPath} -b transparent`, cb),
    // Clean up temporary file
    cb => fs.remove(mmdPath, cb),
  ], (err) => {
    if (err) return callback(err);
    if (asString) {
      return fs.readFile(svgPath, (err, content) => {
        if (err) return callback(err);
        return callback(null, content.toString());
      })
    }
    return callback(null, `./${svgFilename}`);
  });
}

/**
 * Accepts the `source` of the graph as a string, and render an SVG using
 * mermaid.cli. Returns the path to the rendered SVG.
 *
 * @param  {string} destination
 * @param  {string} source
 * @return {string}
 */
function renderFromFile(inputFile, destination, callback) {
  const unique = crypto.createHmac('sha1', PLUGIN_NAME).update(inputFile).digest('hex');
  const mmdcExecutable = which.sync('mmdc');
  const svgFilename = `${unique}.svg`;
  const svgPath = path.join(destination, svgFilename);

  // Invoke mermaid.cli
  exec(`${mmdcExecutable} -i ${inputFile} -o ${svgPath} -b transparent`, (err) => {
    if (err) return callback(err);
    return callback(null, `./${svgFilename}`);
  });
}

/**
 * Returns the destination for the SVG to be rendered at, explicity defined
 * using `vFile.data.destinationDir`, or falling back to the file's current
 * directory.
 *
 * @param {vFile} vFile
 * @return {string}
 */
function getDestinationDir(vFile) {
  if (vFile.data.destinationDir) {
    return vFile.data.destinationDir;
  }

  return vFile.dirname;
}

/**
 * Given the contents, returns a MDAST representation of a HTML node.
 *
 * @param  {string} contents
 * @return {object}
 */
function createMermaidDiv(contents) {
  return {
    type: 'html',
    value: `<div class="mermaid">
  ${contents}
</div>`,
  };
}

module.exports = {
  createMermaidDiv,
  getDestinationDir,
  render,
  renderFromFile,
};
