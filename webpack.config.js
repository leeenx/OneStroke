const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')


const openBrowser = process.argv[3] === '--silence' ? false : true

module.exports = [
  {
    mode: 'development',
    context: __dirname,
    entry: {
      index: [
        './src/script/lib/pixi.js',
        './src/script/lib/gsap/TweenMax.js',
        './src/script/onestroke.es6'
      ],
      plugin: [
        './src/script/plugin.es6'
      ]
    },
    output: {
      path: __dirname + '/dist/script/',
      filename: '[name]-[hash:16].js'
    },
    module: {
      rules: [
        {
          test: function (src) {
            if (
              src.indexOf('script/lib/pixi.js') >= 0 ||
              src.indexOf('script/lib/gsap/TweenMax.js') >= 0
            ) {
              return false
            }
            if (/\.es6$|\.js$/.test(src)) {
              return true
            }
          },
          use: [
            {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/env']
              }
            }
          ]
        }
      ]
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        title: 'H5小游戏100例: 一笔画',
        template: './src/onestroke.html',
        filename: './dist/index.html',
        inject: false
      }),
      new HtmlWebpackPlugin({
        title: 'H5小游戏100例: 生成配置',
        template: './src/plugin.html',
        filename: './dist/plugin.html',
        inject: false
      }),
      new CopyWebpackPlugin([
        {
          from: './src/css/onstroke.css',
          to: './dist/css/onstroke.css'
        }
      ])
    ],
    devServer: {
      contentBase: './dist/',
      open: openBrowser,
      openPage: './dist/index.html'
    },
    watch: true
  }
]
