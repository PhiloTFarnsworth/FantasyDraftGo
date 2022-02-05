import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
  input: ['src/app.js'],
  output: {
    file: 'static/app.js',
    format: 'es', 
    sourcemap: 'inline'
  },
  plugins: [
    terser(),
    replace({'process.env.NODE_ENV': JSON.stringify( 'development' )}), 
    resolve(), 
    commonjs({
      include: 'node_modules/**'
    }),
    babel({ babelHelpers: 'bundled' }) 
  ]
};