var fs = require("fs"),
  path = require("path"),
  execSync = require("child_process").execSync,
  process = require("process");

// TODO: more try/catch process.exit(1)
// TODO: disregard input directories that are not provided in configs.json?
// TODO: improve code architecture for method use by plugins
// TODO: default CSS/JS file listed in configs.json used on all pages?
// TODO: min. and add CSS inline (AMP style)? (or plugin?)
// TODO: Search
// TODO: do plugin on init (already have but relabel)
// TODO: do plugin on page creation before running native JS
// TODO: do plugin on page creation after running native JS
// TODO: do plugin after pages made (maybe make sitemap creation a plugin)

(function(){

  var app = {
    data : {
      cssArr : [],
      js : {
        top:[],
        bottom:[]
      },
      configs : {},
      pagesToSkip : []
    },

    init : function(){
      app.data.configs = app.getExternalConfigs();
      app.deleteOutput();
      app.processPlugins();
      app.processPages();
      app.createSitemap();
      app.copyFilesToOutput();
      // Process complete.
      console.log("Done!");
    },

    getExternalConfigs : function(){
      var configPath = process.argv.length > 2 && process.argv[2];
      if(configPath){
        // need to clone or else it gets overwritten
        return JSON.parse(JSON.stringify(require(configPath)));
      }
      console.log("Error config path not provided in command line");
      process.exit(1);
    },

    processPlugins : function (){
      var plugins = fs.readdirSync(app.data.configs.filePaths.plugins, "utf8");
      for (var plugin of plugins){
        var pluginScript = require(path.join(app.data.configs.filePaths.plugins,plugin));
        var toSkip = pluginScript(app);
        if(toSkip){
          if(Array.isArray(toSkip)){
            for(var name of toSkip){
              app.data.pagesToSkip.push(name);
            }
          }else{
            app.data.pagesToSkip.push(toSkip);
          }
        }
      }
    },

    getFinalHtml : function(page){
      // TODO: could remove unnecessary whitespace/line breaks in HTML
      var mainHtml = fs.readFileSync(app.data.configs.filePaths.mainHtml, "utf8");
      // silly to add to metaData, but efficient
      app.data.configs.metaData.topJS = app.getJSHtml("top");
      app.data.configs.metaData.topCSS = app.getCssHtml();
      app.data.configs.metaData.topMetaTags = app.getMetaTags();
      app.data.configs.metaData.page = page;
      app.data.configs.metaData.bottomJS = app.getJSHtml("bottom");
      function replacer() {
        var content = app.data.configs.metaData[arguments[1].trim()];
        return content ? content : "";
      }
      return mainHtml.replace(/{{([^}}]+)?}}/g, replacer);
    },

    setConfigs : function (data){
      if(!data){return;}
      for(var dataKey in data.metaData){
        app.data.configs.metaData[dataKey] = data.metaData[dataKey];
      }
      for(var tagKey in data.metaTags){
        app.data.configs.metaTags[tagKey] = data.metaTags[tagKey];
      }
    },

    getMetaTags : function(){
      var html = "";
      for(var key in app.data.configs.metaTags){
        html += `<meta name="${key}" content="${app.data.configs.metaTags[key]}">\n`;
      }
      return html;
    },

    getJSHtml : function(type){
      var scripts = "";
      var jsArrReversed = app.data.js[type].reverse();
      for(var fileName of jsArrReversed){
        scripts += '<script src="js/'+fileName+'"></script>';
      }
      return scripts;
    },

    getCssHtml : function(){
      var cssIncludes = "";
      var cssArrReversed = app.data.cssArr.reverse();
      for(var fileName of cssArrReversed){
        cssIncludes += '<link rel="styleguide" href="css/'+fileName+'"></link>';
      }
      return cssIncludes;
    },

    removeDataString : function(fileConents){
      return fileConents.replace(/<<([^>>]+)?>>/,"").trim();
    },
  
    getDataObj : function(fileContents){
      try{
        fileContents =  fileContents.match(/<<([^>>]+)?>>/);
        return fileContents && fileContents.length > 1 ? JSON.parse(fileContents[1]) : null;
      }catch(err){
        console.log("Error getDataObj(): "+err);
        console.log(fileContents);
      }
    },
  
    getComponents : function (page){
      function replacer() {
        var component = "";
        var componentName = arguments[1].trim();
        var isValidComponent = /^c-/.test(componentName);
        if(isValidComponent){
          componentName = isValidComponent ? componentName.replace("c-","") : componentName;
          componentName = /\.html/.test(componentName) ? componentName : componentName+".html";
          try{
            var filePath = path.join(app.data.configs.filePaths.components,componentName);
            if(fs.existsSync(filePath)){
              component = fs.readFileSync(filePath, "utf8");
              var componentData = app.getDataObj(component);
              app.addJS(componentData);
              app.addCSS(componentData);        
              component = app.removeDataString(component);
            }
          }catch(err){
            console.log("Error getComponents("+componentName+"): "+err);
          }
          
        }else{
          return '{{ '+arguments[1]+' }}';
        }
        return component;
      }
      return page.replace(/{{([^}}]+)?}}/g, replacer);
    },
  
    addJS : function(data){
      if(!(data && data.js)){return;}
      var arr = ["top","bottom"];
      for(var i in arr){
        var type = arr[i];
        var jsArr = data.js[type];
        if(data.js && jsArr && jsArr.length){
          for(var y in jsArr){
            var jsFileName = jsArr[y];
            jsFileName = /\.js/.test(jsFileName) ? jsFileName : jsFileName+".js";
            if(app.data.js[type].indexOf(jsFileName) === -1){
              app.data.js[type].push(jsFileName);
            }
          }
        }
      }
    },
  
    addCSS : function(data){
      if(!data){return;}
      if(data && data.css && data.css.length){
        for(var w in data.css){
          var cssFileName = data.css[w];
          cssFileName = /\.css/.test(cssFileName) ? cssFileName : cssFileName+".css";
          if(app.data.js.top.indexOf(cssFileName) === -1){
            app.data.cssArr.push(cssFileName);
          }
        }
      }
    },

    deleteOutput : function(){
      // First delete everything in the build directory.
      console.log("Cleaning previous build...");
      try {
        // rm -rf is always dangerous but much simpler than node here
        var outputPath = app.data.configs.filePaths.output;
        if(fs.existsSync(outputPath)){
          execSync(`rm -rf ${outputPath} && mkdir ${outputPath}`);
        }else{
          console.log(`Error during cleanup: directory ${outputPath} not found`);
        }
      }catch(err){
        console.log("Error during cleanup: "+err);
        process.exit(1);
      }
    },

    processPages : function(){
      // handle each page
      var pageFiles = fs.readdirSync(app.data.configs.filePaths.pages,"utf8");
      for (var fileName of pageFiles){
        // just in case a plugin doesn't clean itself up
        app.resetData();
        // Ignore any pages flagged to skip by plugins
        if(app.data.pagesToSkip.indexOf(/\.html/.test(fileName) ? fileName : fileName + ".html") > -1 ||
          app.data.pagesToSkip.indexOf(/\.html/.test(fileName) ? fileName.replace(".html","") : fileName) > -1 ||
          !fs.existsSync(path.join(app.data.configs.filePaths.pages,(/\.html/.test(fileName) ? fileName : fileName + ".html")))
        ){
          console.log("Skipping: "+fileName);
          continue;
        }
        console.log("Adding page: "+fileName);
        // TODO: this assumes page directory has no sub-directories
        var page = fs.readFileSync(path.join(app.data.configs.filePaths.pages,fileName), "utf8");
        var pageData = app.getDataObj(page);
        page = app.getComponents(app.removeDataString(page));
        if(pageData){
          app.addJS(pageData);
          app.addCSS(pageData);
          app.setConfigs(pageData);
        }
        page = app.getFinalHtml(page);
        fs.writeFileSync(path.join(app.data.configs.filePaths.output,fileName),page);
        app.resetData();
      }
    },

    resetData : function(){
      // reset data for next page
      app.data.js = {top:[],bottom:[]};
      app.data.cssArr = [];
      delete app.data.configs;
      app.data.configs = app.getExternalConfigs();
    },

    createSitemap : function(){
      // sitemap
      console.log("Creating sitemap...");
      var dir = fs.readdirSync(app.data.configs.filePaths.output,"utf8");
      var pageNamesArr = [];
      for (var fileName of dir){
        if(/\.html$/.test(fileName) && !/404\.html/.test(fileName)){
          pageNamesArr.push(fileName);
        }
      }
      var sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">'+
        "<url><loc>"+app.data.configs.baseURL+"/"+
        pageNamesArr.reverse().join("</loc><changefreq>weekly</changefreq></url><url><loc>"+app.data.configs.baseURL+"/")+
        "</loc><changefreq>weekly</changefreq></url></urlset>";
        // TODO: this assumes page directory has no sub-directories 
      fs.writeFileSync(path.join(app.data.configs.filePaths.output,"sitemap.xml"), sitemap.replace("/index.html",""));
    },

    copyFilesToOutput : function(){
      // Copy asset folders into build folder.
      // TODO: concat/compress assets
      console.log("Copying folders...");
      try {
        for(var toCopy of app.data.configs.toCopy){
          var src= path.join(app.data.configs.filePaths.input,toCopy);
          var dist= path.join(app.data.configs.filePaths.output,toCopy);
          execSync(`cp -r ${src} ${dist}`);
          // Alternative depending on how cp -r works on different OS's
          // execSync(`mkdir -p ${dist} && cp -r ${src} ${dist}`);
        }
        try {
          execSync(`cp -r ${app.data.configs.filePaths.favicon} ${app.data.configs.filePaths.output}/favicon.ico`);
        }catch(err){/* node will print error*/}
      }catch(err){
        console.log("Error during folder copying: "+err);
        process.exit(1);
      }
    }

  }; // end app

  app.init();

})();