const fs = require('fs');
const path = require('path');
const toVFile = require('to-vfile');
const { render, renderFromFile, getDestinationDir } = require('../src/utils');

const fixturesDir = path.join(__dirname, '/fixtures');
const runtimeDir = path.join(__dirname, '/runtime');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;

// Utility function to add metdata to a vFile.
function addMetadata(vFile, destinationFilePath) {
  vFile.data = {
    destinationFilePath,
    destinationDir: path.dirname(destinationFilePath),
  };
}

describe('remark-mermaid utils', () => {
  it('renders a mermaid graph to SVG', () => {
    const mermaidExample = fs.readFileSync(`${fixturesDir}/example.mmd`, 'utf8');

    render(mermaidExample, runtimeDir, true, (err, renderedSVGString) => {
      expect(renderedSVGString).not.toBeUndefined();
    });
  });

  it('renders a mermaid graph to file', () => {
    const mermaidExample = fs.readFileSync(`${fixturesDir}/example.mmd`, 'utf8');

    render(mermaidExample, runtimeDir, (err, renderedGraphFile) => {
      expect(renderedGraphFile).not.toBeUndefined();
    });
  });

  it('renders from a file a mermaid graph', () => {
    renderFromFile(`${fixturesDir}/example.mmd`, runtimeDir, (err, renderedGraphFile) => {
      expect(renderedGraphFile).not.toBeUndefined();
    });
  });

  it('handles explicity set destination', () => {
    const srcFile = `${fixturesDir}/code-block.md`;
    const destFile = `${runtimeDir}/code-block.md`;
    const vfile = toVFile.readSync(srcFile);
    addMetadata(vfile, destFile);

    expect(getDestinationDir(vfile)).toEqual(runtimeDir);
  });

  it('handles fallback destination', () => {
    const srcFile = `${fixturesDir}/code-block.md`;
    const vfile = toVFile.readSync(srcFile);

    expect(getDestinationDir(vfile)).toEqual(fixturesDir);
  });
});
