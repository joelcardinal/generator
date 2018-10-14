# Generator

Yes, yet another static site generator. This is a Node based generator, the goal is to keep super small one page script, low/no dependancies, and easy to run.

The script is only opinionated in the templating markup (double curly braces), and existance of certain file paths (although directory and file names can be your own).

Directories to be copied (e.g. js, images) are required to be in your input directory.

Script also allows "plugins" or really just includes modules that are passed that app, so your code can take advatange of existing methods.

Plugin should return either null, name of page file, array of page file names that should be skipped for processing.  This would be useful for example when you have a plugin for page file(s) that won't be output itself but serves as a template for your own processing; maybe it's used to create a multitude of similar pages.

## Requirements
configs.json file located in parent diretory of generator repo directory. File must have valid directory paths even if they contain no files (see zipped example project).

Your htmlTop file must contain the following template replacement strings:
```
{{topMetaTags}}
{{topCSS}}
{{topJS}}
```

## To Run
Simply run: ```node index.js```
