var fs = require("fs"),
  path = require("path"),
  execSync = require("child_process").execSync,
  process = require("process");

// IMPORTANT: requires all file names are unique

// TODO: more try/catch process.exit(1)
// TODO: disregard input directories that are not provided in configs.json?
// TODO: improve code architecture for method use by plugins
// TODO: default CSS/JS file listed in configs.json used on all pages?

(function(){

  var app = {
    data : {
      cssArr : [],
      js : {
        top:[],
        bottom:[]
      },
      configs : {},
      externalConfigs : {},
      pagesToSkip : []
    },

    init : function(){
      app.data.configs = app.getExternalConfigs();
      app.processPlugins();
      app.deleteOutput();
      app.processPages();
      app.createSitemap();
      app.copyFilesToOutput();
      // Process complete.
      console.log("Done!");
    },

    getExternalConfigs : function(){
      var configPath = process.argv.length > 2 && process.argv[2];
      if(configPath){
        app.data.externalConfigs = require(configPath);
        return app.data.externalConfigs;
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
        html += `<meta name="${key}" content="${app.data.configs.metaTags[key]}"></meta>`;
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
        componentName = /^c-/.test(componentName) ? componentName.replace("c-","") : componentName;
        componentName = /\.html/.test(componentName) ? componentName : componentName+".html";
        try{
          component = fs.readFileSync(path.join(app.data.configs.filePaths.components,componentName), "utf8");
          var componentData = app.getDataObj(component);
          app.addJS(componentData);
          app.addCSS(componentData);        
          component = app.removeDataString(component);
        }catch(err){
          console.log("Error getComponents("+componentName+"): "+err);
        }
        return component;
      }
      return page.replace(/{{([^}}]+)?}}/g, replacer);
    },
  
    addJS : function(data){
      if(!data){return;}
      if(data.js && data.js.top.length){
        for(var y in data.js.top){
          var jsFileNameTop = data.js.top[y];
          jsFileNameTop = /\.js/.test(jsFileNameTop) ? jsFileNameTop : jsFileNameTop+".js";
          if(app.data.js.top.indexOf(jsFileNameTop) === -1){
            app.data.js.top.push(jsFileNameTop);
          }
        }
      }
      if(data.js && data.js.bottom.length){
        for(var z in data.js.bottom){
          var jsFileNameBottom = data.js.bottom[z];
          if(app.data.js.top.indexOf(jsFileNameBottom) === -1){
            app.data.js.bottom.push(jsFileNameBottom);
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
        // Ignore any pages flagged to skip by plugins
        if(app.data.pagesToSkip.indexOf(/\.html/.test(fileName) ? fileName : fileName + ".html") > -1 ||
          app.data.pagesToSkip.indexOf(/\.html/.test(fileName) ? fileName.replace(".html","") : fileName) > -1
        ){continue;}
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
        // reset data for next page
        app.data.js = {top:[],bottom:[]};
        app.data.cssArr = [];
        app.data.configs = app.data.externalConfigs;
      }
    },

    createSitemap : function(){
      // sitemap
      console.log("Creating sitemap...");
      var pageNames = fs.readdirSync(app.data.configs.filePaths.output,"utf8");
      var sitemap = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">'+
        "<url><loc>"+app.data.configs.baseURL+"/"+
        pageNames.reverse().join("</loc><changefreq>weekly</changefreq></url><url><loc>"+app.data.configs.baseURL+"/")+
        "</loc><changefreq>weekly</changefreq></url></urlset>";
        // TODO: this assumes page directory has no sub-directories 
      fs.writeFileSync(path.join(app.data.configs.filePaths.output,"sitemap.xml"), sitemap.replace("index.html",""));
    },

    copyFilesToOutput : function(){
      // Copy asset folders into build folder.
      // TODO: concat/compress assets
      console.log("Copying folders...");
      try {
        for(var copyFolder of app.data.configs.copyFolders){
          var src= path.join(app.data.configs.filePaths.input,copyFolder);
          var dist= path.join(app.data.configs.filePaths.output,copyFolder);
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