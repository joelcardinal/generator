var fs = require("fs"),
  path = require("path"),
  execSync = require('child_process').execSync,
  outputPath = "./output",
  copyFolders = ["images", "css", "js"];

// TODO: this all assumes all file names are unique - very bad
// TODO: lots of 'for in' that should or could be 'for of'
// TODO: remove hardcoded paths and use config file
// TODO: add plugin system so that generator won't be site specific
// TODO: add npm hook to run local server for testing output

(function(){
  var cssArr=[],
    js = {top:[],bottom:[]},
    defaultMetaData = {
      "lang": "en",
      "title": "Index",
      "charset": "utf-8",
      "description": "This is a page",
      "keywords": "page, sample",
      "author": "None"
    },
    htmlMetaData = defaultMetaData;

  function getHtmlTop(){
    var page = fs.readFileSync("./input/components/htmlTop.html", "utf8");
    htmlMetaData.topJSHtml = getJSHtml("top");
    htmlMetaData.cssHtml = getCssHtml();
    function replacer() {
      var content = htmlMetaData[arguments[1].trim()];
      return content ? content : "";
    }
    return page.replace(/{{([^}}]+)?}}/g, replacer);
  }

  function getHeaderFooter(type, pageData){
    var headOrFoot = pageData[type],
      header = "";
    if(headOrFoot){
      var fileName = /\.html/.test(headOrFoot) ? headOrFoot : headOrFoot+".html";
      var data = "";
      header = fs.readFileSync(path.join("./input/headers", fileName), "utf8");
      data = getDataObj(header);
      header = getComponents(removeDataString(header));
      if(data){
        addJS(data);
        addCSS(data);
        setHtmlMetaData(data);
      }
    }
    return header;
  }
  function setHtmlMetaData(data){
    for(i in data){
      if(htmlMetaData[data[i]]){
        htmlMetaData[data[i]] = data[i];
      }
    }
  }

  function getJSHtml(type){
    var scripts = "";
    var jsArrReversed = js[type].reverse();
    for(var i in jsArrReversed){
      var fileName = jsArrReversed[i];
      fileName = /\.js/.test(fileName) ? fileName : fileName+".js";
      scripts += '<script src="js/'+fileName+'"></script>';
    }
    return scripts;
  }

  function getCssHtml(){
    var cssIncludes = "";
    var cssArrReversed = cssArr.reverse();
    for(var i in cssArrReversed){
      var fileName = cssArrReversed[i];
      fileName = /\.css/.test(fileName) ? fileName : fileName+".css";
      cssIncludes += '<link rel="styleguide" href="css/'+fileName+'"></link>';
    }
    return cssIncludes;
  }

  function removeDataString(fileConents){
    return fileConents.replace(/<<([^>>]+)?>>/,"").trim();
  }

  function getDataObj(fileContents){
    try{
      fileContents =  fileContents.match(/<<([^>>]+)?>>/);
      return fileContents && fileContents.length > 1 ? JSON.parse(fileContents[1]) : null;
    }catch(err){
      console.log("Error getDataObj(): "+err);
      console.log(fileContents);
    }
  }

  function getComponents (page){
    function replacer() {
      var component = "";
      var componentName = arguments[1].trim();
      componentName = /^c-/.test(componentName) ? componentName.replace("c-","") : componentName;
      componentName = /\.html/.test(componentName) ? componentName : componentName+".html";
      try{
        component = fs.readFileSync(path.join("./input/components",componentName), "utf8");
        var componentData = getDataObj(component);
        addJS(componentData);
        addCSS(componentData);        
        component = removeDataString(component);
      }catch(err){
        console.log("Error getComponents("+componentName+"): "+err);
      }
      return component;
    }
    return page.replace(/{{([^}}]+)?}}/g, replacer);
  }

  function addJS(data){
    if(data.js && data.js.top.length){
      for(var y in data.js.top){
        js.top.push(data.js.top[y]);
      }
    }
    if(data.js && data.js.bottom.length){
      for(var z in data.js.bottom){
        js.bottom.push(data.js.bottom[z]);
      }
    }
  }

  function addCSS(data){
    if(data.css && data.css.length){
      for(var w in data.css){
        cssArr.push(data.css[w]);
      }
    }
  }

  // First delete everything in the build directory.
  console.log("Cleaning previous build...");
  try {
    // rm -rf is always dangerous but much simpler than node here
    // hardcoding "output" to make sure command has specific target,
    // instead of deleting hd
    execSync(`rm -rf output && mkdir output`);
  }catch(err){
    console.log("Error during cleanup: "+err);
    process.exit(1);
  }

  // handle each page
  var pageFiles = fs.readdirSync("./input/pages","utf8");
  for (var i in pageFiles){
    var fileName = pageFiles[i];
    console.log("Adding page: "+fileName);
    // TODO: this assumes page directory has no sub-directories
    var page = fs.readFileSync(path.join("./input/pages",fileName), "utf8");
    var pageData = getDataObj(page);
    var header = "";
    var footer = "";
    page = getComponents(removeDataString(page));
    if(pageData){
      header = getHeaderFooter("header",pageData);
      footer = getHeaderFooter("footer",pageData);
      addJS(pageData);
      addCSS(pageData);
      setHtmlMetaData(pageData);
    }
    page = getHtmlTop() + header + page + footer + getJSHtml('bottom') + "</body></html>";
    fs.writeFileSync(path.join(outputPath,fileName),page);
    // reset data for next page
    js = {top:[],bottom:[]};
    cssArr = [];
    htmlMetaData = defaultMetaData;
  }

  // Copy asset folders into build folder.
  // TODO: concat/compress assets
  console.log("Copying folders...");
  try {
    for(var copyFolder of copyFolders){
      var src= path.join("./input",copyFolder);
      var dist= path.join(outputPath,copyFolder);
      execSync(`cp -r ${src} ${dist}`);
      // Alternative depending on how cp -r works on different OS's
      // execSync(`mkdir -p ${dist} && cp -r ${src} ${dist}`);
    }
  }catch(err){
    console.log("Error during folder copying: "+err);
    process.exit(1);
  }

  // Process complete.
  console.log("Done!");

})();