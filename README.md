# Generator

Stupid simple Node based static site generator. The goal of this generator is to stay minimal, one page script, low/no dependancies, rediculously easy to run.

Site generator logic uses the following to create output:

* config.json = default meta-data and directory paths.
* pages = content, what will be added in the body of an HTML page.
* components = sub-sections of HTML that can be reused across HTML pages (e.g. headers, footers).
* copyFolders = directories in your input path that will be copied to the output path (e.g. images, css, js).
* plugins = your custom scripts the site generator will run automatically.

Plugins are really just modules that are passed the scripts app object, so your code can take advatange of existing methods of app.

Plugin should return either null, name of page file, or array of page file names that should be skipped for processing.  An example of when you might need a plugin is for a page file that won't be output itself but serves as a template for your own processing; maybe it's used to create a multitude of similar pages.

## Requirements
configs.json file populated with all expected directory paths (example below). File must have valid directory paths even if they contain no files.  Path to configs.json must be provided as argument in script run command.

```
{
  "baseURL" : "https://example.com",
  "metaData" : {
    "lang": "en",
    "title": "Index",
    "charset": "utf-8"
  },
  "metaTags" : {
    "description": "This is a page",
    "keywords": "page, sample",
    "author": "None"
  },
  "copyFolders" : ["images", "css", "js"],
  "filePaths" : {
    "input" : "../input",
    "components" : "../input/components",
    "pages" : "../input/pages",
    "plugins" : "../input/plugins",
    "favicon" :  "../input/favicon.ico", 
    "output" : "../output",
    "mainHtml" : "../input/components/mainHtml.html"
  }

}
```

Directories to be copied "copyFolders" (e.g. js, images) are required to be in the root of your input directory.

Pages have data and HTML. Data defines any JS or CSS files needed, meta-data, meta-tags, and should be JSON structure wrapped with ```<<``` and ```>>```.  Pages can use double-curly c- prefixed ```{{c-myComponent}}``` template notation for component replacement.

Your mainHTML file must contain the following template replacement strings:

```
{{topMetaTags}}
{{topCSS}}
{{topJS}}
```

**See example/ for reference.**

## To Run
Simply run: ```node index.js FULL/PATH/TO/CONFIGS.JSON```
