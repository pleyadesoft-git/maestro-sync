function readPackage(pkg, context) {
  if (pkg.name === 'canvas') {
    pkg.scripts = {}
  }
  return pkg
}

module.exports = {
  hooks: {
    readPackage,
  },
}
