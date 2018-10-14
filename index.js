var fs = require("fs"),
  path = require("path"),
  execSync = require("child_process").execSync,
  externalConfigs = require("../configs.json");

// IMPORTANT: requires all file names are unique

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
      app.data.configs = externalConfigs;
      app.processPlugins();
      app.deleteOutput();
      app.processPages();
      app.createSitemap();
      app.copyFilesToOutput();
      // Process complete.
      console.log("Done!");
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

    getHtmlTop : function(){
      var page = fs.readFileSync(app.data.configs.filePaths.htmlTop, "utf8");
      // silly to add to metaData, but efficient
      app.data.configs.metaData.topJS = app.getJSHtml("top");
      app.data.configs.metaData.topCSS = app.getCssHtml();
      app.data.configs.metaData.topMetaTags = app.getMetaTags();
      function replacer() {
        var content = app.data.configs.metaData[arguments[1].trim()];
        return content ? content : "";
      }
      return page.replace(/{{([^}}]+)?}}/g, replacer);
    },

    getHeaderFooter : function(type, pageData){
      var headOrFoot = pageData[type],
        header = "";
      if(headOrFoot){
        var fileName = /\.html/.test(headOrFoot) ? headOrFoot : headOrFoot+".html";
        var data = "";
        header = fs.readFileSync(path.join(app.data.configs.filePaths[type], fileName), "utf8");
        data = app.getDataObj(header);
        header = app.getComponents(app.removeDataString(header));
        if(data){
          app.addJS(data);
          app.addCSS(data);
          app.setConfigs(data);
        }
      }
      return header;
    },

    setConfigs : function (data){
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
        fileName = /\.js/.test(fileName) ? fileName : fileName+".js";
        scripts += '<script src="js/'+fileName+'"></script>';
      }
      return scripts;
    },

    getCssHtml : function(){
      var cssIncludes = "";
      var cssArrReversed = app.data.cssArr.reverse();
      for(var fileName of cssArrReversed){
        fileName = /\.css/.test(fileName) ? fileName : fileName+".css";
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
      if(data.js && data.js.top.length){
        for(var y in data.js.top){
          app.data.js.top.push(data.js.top[y]);
        }
      }
      if(data.js && data.js.bottom.length){
        for(var z in data.js.bottom){
          app.data.js.bottom.push(data.js.bottom[z]);
        }
      }
    },
  
    addCSS : function(data){
      if(data.css && data.css.length){
        for(var w in data.css){
          app.data.cssArr.push(data.css[w]);
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
        var header = "";
        var footer = "";
        page = app.getComponents(app.removeDataString(page));
        if(pageData){
          header = app.getHeaderFooter("headers",pageData);
          footer = app.getHeaderFooter("footers",pageData);
          app.addJS(pageData);
          app.addCSS(pageData);
          app.setConfigs(pageData);
        }
        page = app.getHtmlTop() + header + page + footer + app.getJSHtml('bottom') + "</body></html>";
        fs.writeFileSync(path.join(app.data.configs.filePaths.output,fileName),page);
        // reset data for next page
        app.data.js = {top:[],bottom:[]};
        app.data.cssArr = [];
        app.data.configs = externalConfigs;
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
      }catch(err){
        console.log("Error during folder copying: "+err);
        process.exit(1);
      }
    }

  }; // end app

  app.init();

})();