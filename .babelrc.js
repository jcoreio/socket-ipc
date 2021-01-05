module.exports = function(api) {
  const plugins = [
    '@babel/proposal-class-properties',
    '@babel/proposal-object-rest-spread',
  ]
  const presets = [
    ['@babel/env', { targets: { node: '8' } }],
    '@babel/typescript',
  ]

  if (api.env(['test', 'coverage'])) {
    plugins.push('@babel/transform-runtime')
  }
  if (api.env('coverage')) {
    plugins.push('babel-plugin-istanbul')
  }

  return { plugins, presets }
}
