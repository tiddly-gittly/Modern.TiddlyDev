module.exports = {
  "globDirectory": "dist/",
  "maximumFileSizeToCacheInBytes": 1024 * 1024 * 256,
  "globPatterns": [
    "**/*.{ico,html,js,json,png,svg,jpg,jpeg,webp,gif,pdf,css,doc,docx,xsl,xslx,ppt,pptx,xml,opml,yaml,bmp,tiff,rtf,txt,heic,heif,woff,woff2,ogg,ogm,ogv,webm,mp4,mp3,m4a,md,tid,enex,bib,epub,octet-stream,multids,tiddler,recipe,htm,hta,m3u8,avi,rm,rmvb,wma,wav,mid,flv,ttf,otf,font,eot,fon,ttc}"
  ],
  "swDest": "dist/service-worker.js",
  "swSrc": "public/service-worker.js"
};
