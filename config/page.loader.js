const compiler = require('riot-compiler')
const { getOptions } = require('loader-utils')
const TAGS_NAMES_REGEX = /riot.tag2\(['|"](.+?)['|"],/g

/**
 * Generate the hmr code depending on the tags generated by the compiler
 * @param   { Array } tags - array of strings
 * @returns { string } the code needed to handle the riot hot reload
 */
function hotReload(tags) {
  return `
  if (module.hot) {
    module.hot.accept()
    if (module.hot.data) {
      ${tags.map(tag => `riot.reload('${tag}')`).join('\n')}
    }
  }`
}

/**
 * Compile using the riot compiler returning always an object with {map, code}
 * @param   { string } source - component source content
 * @param   { Object } opts   - compiler options
 * @param   { string } resourcePath - path to the component file
 * @returns { Object } result containing always the map and code keys
 */
function compile(source, opts, resourcePath) {
  const exec = () => compiler.compile(source, opts, resourcePath)
  return opts.sourcemap ? exec() : { code: exec(), map: false }
}

module.exports = function(source) {

  // replace root tag name for pages
  if (this.resourcePath.includes('/src/pages/')) {
    let tagNewName = this.resourcePath.replace(/(^(.*)\/pages\/|\.tag$)/gi, '');
    tagNewName = tagNewName.replace(/\//gi, '-') + '-front-less-page';
    source = source.trim();
    const rootTag = source.match(/^<(.*)>/gi) [0];
    source = source.replace(rootTag, `<${tagNewName}>`);
    source = source.replace(/<\/(.*)>$/gi, `</${tagNewName}>`);
  }
  // tags collection
  const tags = []

  // parse the user query
  const query = getOptions(this) || {}

  // normalise the query object in case of question marks
  const opts = Object.keys(query).reduce(function(acc, key) {
    acc[key.replace('?', '')] = query[key]
    return acc
  }, {})

  // compile and generate sourcemaps
  const {code, map} = compile(
    source,
    Object.assign(opts, {
      sourcemap: opts.sourcemap !== false && this.sourceMap
    }),
    this.resourcePath
  )

  // detect the tags names
  code.replace(TAGS_NAMES_REGEX, function(_, match) {
    tags.push(match)
  })

  // generate the output code
  const output = `
    var riot = require('riot')
    ${code}
    ${opts.hot ? hotReload(tags) : ''}
  `

  // cache this module
  if (this.cacheable) this.cacheable()

  // return code and sourcemap
  if (map) this.callback(null, output, map.toJSON())

  return output
}