const fs = require('fs-extra');
const visit = require('unist-util-visit');
const {
  render,
  renderFromFile,
  getDestinationDir,
  createMermaidDiv,
} = require('./utils');

const PLUGIN_NAME = 'remark-mermaid';

/**
 * Is this title `mermaid:`?
 *
 * @param  {string} title
 * @return {boolean}
 */
const isMermaid = title => title === 'mermaid:';

/**
 * Given a node which contains a `url` property (eg. Link or Image), follow
 * the link, generate a graph and then replace the link with the link to the
 * generated graph. Checks to ensure node has a title of `mermaid:` before doing.
 *
 * @param   {object}  node
 * @param   {vFile}   vFile
 * @return {object}
 */
function replaceUrlWithGraph(node, vFile) {
  const { title, url, position } = node;
  const { destinationDir } = vFile.data;

  // If the node isn't mermaid, ignore it.
  if (!isMermaid(title)) {
    return node;
  }

  return new Promise((resolve, reject) => {
    renderFromFile(`${vFile.dirname}/${url}`, destinationDir, (err, fileURL) => {
      if (err) {
        vFile.message(err, position, PLUGIN_NAME);
        reject(err);
      }

      node.url = fileURL; // eslint-disable-line no-param-reassign
      vFile.info('mermaid link replaced with link to graph', position, PLUGIN_NAME);
      resolve(node);
    });
  });
}

/**
 * Given a link to a mermaid diagram, grab the contents from the link and put it
 * into a div that Mermaid JS can act upon.
 *
 * @param  {object}   node
 * @param  {integer}  index
 * @param  {object}   parent
 * @param  {vFile}    vFile
 * @return {object}
 */
function replaceLinkWithEmbedded(node, index, parent, vFile) {
  const { title, url, position } = node;
  let newNode;

  // If the node isn't mermaid, ignore it.
  if (!isMermaid(title)) {
    return node;
  }

  try {
    const value = fs.readFileSync(`${vFile.dirname}/${url}`, { encoding: 'utf-8' });

    newNode = createMermaidDiv(value);
    parent.children.splice(index, 1, newNode);
    vFile.info('mermaid link replaced with div', position, PLUGIN_NAME);
  } catch (error) {
    vFile.message(error, position, PLUGIN_NAME);
    return node;
  }

  return node;
}

/**
 * Given the MDAST ast, look for all fenced codeblocks that have a language of
 * `mermaid` and pass that to mermaid.cli to render the image. Replaces the
 * codeblocks with an image of the rendered graph.
 *
 * @param {object}  ast
 * @param {vFile}   vFile
 * @param {boolean} isSimple
 * @return {function}
 */
function visitCodeBlock(ast, vFile, isSimple) {
  const promises = [Promise.resolve()];

  visit(ast, 'code', (node, index, parent) => {
    const { lang, value, position } = node;
    const destinationDir = getDestinationDir(vFile);

    const promise = new Promise((resolve, reject) => {
      let newNode;

      const asString = vFile.data.asString;

      // If this codeblock is not mermaid, bail.
      if (lang !== 'mermaid') {
        return resolve();
      }

      // Are we just transforming to a <div>, or replacing with an image?
      if (isSimple) {
        vFile.info(`${lang} code block replaced with div`, position, PLUGIN_NAME);
        newNode = createMermaidDiv(value);
        parent.children.splice(index, 1, newNode);

        return resolve();
      }

      // Otherwise, let's try and generate a graph!
      return render(value, destinationDir, asString, (err, svg) => {
        if (err) {
          vFile.message(err, position, PLUGIN_NAME);
          reject(err);
        }

        vFile.info(`${lang} code block replaced with graph`, position, PLUGIN_NAME);

        if (asString) {
          newNode = {
            type: 'html',
            value: svg,
          };
        } else {
          newNode = {
            type: 'image',
            title: '`mermaid` image',
            url: svg,
          };
        }

        parent.children.splice(index, 1, newNode);

        resolve();
      });
    });

    promises.push(promise);
  });

  return Promise.all(promises);
}

/**
 * If links have a title attribute called `mermaid:`, follow the link and
 * depending on `isSimple`, either generate and link to the graph, or simply
 * wrap the graph contents in a div.
 *
 * @param {object}  ast
 * @param {vFile}   vFile
 * @param {boolean} isSimple
 * @return {function}
 */
function visitLink(ast, vFile, isSimple) {
  const promises = [Promise.resolve()];

  if (isSimple) {
    visit(ast, 'link', (node, index, parent) => replaceLinkWithEmbedded(node, index, parent, vFile));
  }

  visit(ast, 'link', (node) => {
    promises.push(replaceUrlWithGraph(node, vFile));
  });

  return Promise.all(promises);
}

/**
 * If images have a title attribute called `mermaid:`, follow the link and
 * depending on `isSimple`, either generate and link to the graph, or simply
 * wrap the graph contents in a div.
 *
 * @param {object}  ast
 * @param {vFile}   vFile
 * @param {boolean} isSimple
 * @return {function}
 */
function visitImage(ast, vFile, isSimple) {
  const promises = [Promise.resolve()];

  if (isSimple) {
    visit(ast, 'image', (node, index, parent) => replaceLinkWithEmbedded(node, index, parent, vFile));
  }

  visit(ast, 'image', (node) => {
    promises.push(replaceUrlWithGraph(node, vFile));
  });

  return Promise.all(promises);
}

/**
 * Returns the transformer which acts on the MDAST tree and given VFile.
 *
 * If `options.simple` is passed as a truthy value, the plugin will convert
 * to `<div class="mermaid">` rather than a SVG image.
 *
 * @link https://github.com/unifiedjs/unified#function-transformernode-file-next
 * @link https://github.com/syntax-tree/mdast
 * @link https://github.com/vfile/vfile
 *
 * @param {object} options
 * @return {function}
 */
function mermaid(options = {}) {
  const simpleMode = options.simple || false;

  /**
   * @param {object} ast MDAST
   * @param {vFile} vFile
   * @return {object}
   */
  return function transformer(ast, vFile) {
    return visitCodeBlock(ast, vFile, simpleMode)
      .then(() => visitLink(ast, vFile, simpleMode))
      .then(() => visitImage(ast, vFile, simpleMode))
      .then(() => ast);
  };
}

module.exports = mermaid;
