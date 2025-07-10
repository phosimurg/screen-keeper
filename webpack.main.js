const path = require('path');

module.exports = {
  target: 'electron-main',
  entry: './src/main/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js'
  },
  node: {
    __dirname: false,
    __filename: false
  },
  externals: {
    'robotjs': 'commonjs robotjs',
    'electron': 'commonjs electron',
    'electron-store': 'commonjs electron-store',
    'node-cron': 'commonjs node-cron'
  },
  resolve: {
    extensions: ['.js', '.ts']
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      }
    ]
  }
}; 