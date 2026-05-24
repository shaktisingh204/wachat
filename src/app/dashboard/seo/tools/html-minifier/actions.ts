'use server';

import { minify, Options } from 'html-minifier-terser';

export async function minifyHtml(html: string, options?: Options) {
  if (!html) return '';
  
  try {
    const defaultOptions: Options = {
      collapseWhitespace: true,
      removeComments: true,
      minifyJS: true,
      minifyCSS: true,
      removeAttributeQuotes: false,
      removeEmptyAttributes: false,
      keepClosingSlash: true,
      collapseBooleanAttributes: false,
      decodeEntities: false,
      minifyURLs: false,
      removeRedundantAttributes: false,
      removeScriptTypeAttributes: false,
      removeStyleLinkTypeAttributes: false,
      useShortDoctype: false,
    };

    const minified = await minify(html, { ...defaultOptions, ...options });
    return minified;
  } catch (error) {
    console.error('Failed to minify HTML:', error);
    return html; // fallback to original
  }
}
